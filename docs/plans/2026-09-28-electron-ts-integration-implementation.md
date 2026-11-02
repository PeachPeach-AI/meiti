# smartstore 原型集成 Electron + TS 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `desktop-shell/static` 的 smartstore 单文件原型集成进 `demo/electron-ts/`——TS 壳（main/preload 严格 TS）+ 数据层 TS 化（data.js → typed data.ts），视图层零改动。

**Architecture:** Electron 主进程加载 `dist/renderer/smartstore-desktop.html`（构建时从 `desktop-shell/static` 正本复制，单一事实来源）；数据由 `data/data.ts` 编译为 CJS 脚本注入 `window.SS`（契约与旧 data.js 完全一致）；`scripts/verify-contract.mjs` 用 node vm 执行新旧两份 data 脚本做深度等价验证，是本计划的回归安全网。

**Tech Stack:** Electron 44.4.5 · TypeScript 5 (strict) · 纯 tsc（无打包器）· node:vm / node:fs 脚本

**沙箱约束（执行者必读）:**
- npm 装包禁止执行 install 脚本（spawn 会 EPERM）：一律 `--ignore-scripts`，electron 二进制用 `node node_modules\electron\install.js` 手动拉（配 `ELECTRON_CACHE`/`ELECTRON_MIRROR`）
- 所有 tsc/node 脚本直接调用，不经过 `npm run`（npm 运行脚本同样走 spawn）
- 代理无法拉起 Electron 窗口（命名管道沙箱边界）：窗口验收由用户双击 `AI智慧门店-TS.lnk` 完成

**兼容契约（不得变更）:**
1. `window.SS = { orgs, stores, employees, accounts, works, contentTypes, topics, recordings, objections, dashboard, diagnoses, script, mixcut, viral, comments, leads, nurture, recAssets, complaints, opportunities, recDevice, insights, fmt, fmtK, dt }`
2. `window.desktopWindow.control(action: 'minimize' | 'toggle-maximize' | 'close')` → IPC `window-control`

---

### Task 1: 脚手架与依赖

**Files:**
- Create: `demo/electron-ts/package.json`
- Create: `demo/electron-ts/tsconfig.json`
- Create: `demo/electron-ts/.gitignore`

**Step 1: 写 package.json**

```json
{
  "name": "smartstore-electron-ts-demo",
  "version": "0.1.0",
  "private": true,
  "description": "AI智慧门店原型 · Electron + TypeScript 集成验证",
  "main": "dist/electron/main.js",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "sync-public": "node scripts/sync-public.mjs",
    "build": "tsc && node scripts/sync-public.mjs",
    "verify-contract": "node scripts/verify-contract.mjs",
    "start": "electron ."
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "electron": "44.4.5",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": false,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["electron/**/*.ts", "data/**/*.ts", "types/**/*.d.ts"]
}
```

**Step 3: 写 .gitignore**

```gitignore
node_modules/
dist/
*.tsbuildinfo
debug.log
```

**Step 4: 安装依赖（沙箱安全配方）**

```powershell
cd E:\BaiduSyncdisk\lab\60smartStore\demo\electron-ts
$env:npm_config_cache = 'E:\BaiduSyncdisk\lab\60smartStore\.npm-cache'
$env:ELECTRON_CACHE   = 'E:\BaiduSyncdisk\lab\60smartStore\.electron-cache'
$env:ELECTRON_MIRROR  = 'https://npmmirror.com/mirrors/electron/'
npm install --ignore-scripts
node node_modules\electron\install.js
```

Expected: `npm install` 无 EPERM；`install.js` exit 0；`Test-Path node_modules\electron\dist\electron.exe` 为 True。

**Step 5: 验证 tsc 可用**

Run: `node node_modules\typescript\bin\tsc --version`
Expected: `Version 5.x.x`

**Step 6: Commit**

```powershell
git add demo/electron-ts/package.json demo/electron-ts/tsconfig.json demo/electron-ts/.gitignore
git commit -m "chore(demo): scaffold electron-ts integration"
```

---

### Task 2: 契约等价测试（先写测试，跑到红）

**Files:**
- Create: `demo/electron-ts/scripts/verify-contract.mjs`

**Step 1: 写测试脚本**

```js
// 契约等价验证：旧 data.js（desktop-shell/static）与新编译产物（dist/renderer/assets/data.js）
// 在同一 node vm 环境执行，深度比对 window.SS 的每个成员。任何差异 = 迁移回归。
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const oldFile = join(root, '..', '..', 'desktop-shell', 'static', 'assets', 'data.js')
const newFile = join(root, 'dist', 'renderer', 'assets', 'data.js')

function loadSS(file) {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file })
  if (!ctx.window.SS) throw new Error(`window.SS not set by ${file}`)
  return ctx.window.SS
}

let failures = 0
const oldSS = loadSS(oldFile)
const newSS = loadSS(newFile)
const keys = Object.keys(oldSS)

for (const k of keys) {
  if (typeof oldSS[k] === 'function') continue // 函数成员单独做行为比对
  if (JSON.stringify(oldSS[k]) !== JSON.stringify(newSS[k])) {
    failures++
    console.error(`MISMATCH ${k}`)
  }
}
for (const [name, args] of [['fmt', [12345]], ['fmtK', [123456]], ['dt', ['2026-09-23T09:12:00+08:00']]]) {
  const a = oldSS[name](...args)
  const b = newSS[name](...args)
  if (a !== b) { failures++; console.error(`MISMATCH ${name}(${args.join(',')}) old=${a} new=${b}`) }
}

if (failures) {
  console.error(`contract verify FAILED: ${failures} mismatch(es) across ${keys.length} keys`)
  process.exit(1)
}
console.log(`contract verify OK: ${keys.length} keys + 3 helpers identical`)
```

**Step 2: 跑测试，确认失败（红）**

Run: `node scripts\verify-contract.mjs`
Expected: FAIL —— `ENOENT ... dist\renderer\assets\data.js`（新产物还不存在）。

**Step 3: Commit**

```powershell
git add demo/electron-ts/scripts/verify-contract.mjs
git commit -m "test(demo): add SS contract equivalence check"
```

---

### Task 3: 实体类型定义 entities.ts

**Files:**
- Create: `demo/electron-ts/data/entities.ts`

**Step 1: 写全部实体接口**

```ts
/** SS 数据包的类型定义。字段口径与样例数据一致；缺失即 null（PRD §5.1.2）。 */

export interface Org {
  id: string
  name: string
  level: 'group' | 'province' | 'city' | 'district' | 'store'
  parentId: string | null
}

export interface Store {
  id: string
  orgId: string
  name: string
  status: string
  accounts: number
  active: number
  published7d: number
  plays7d: number
}

export interface Employee {
  id: string
  storeId: string
  name: string
  role: string
  status: string
}

export interface Account {
  id: string
  platform: string
  nickname: string
  homepage: string
  orgId: string
  employeeId: string
  authStatus: 'authorized' | 'unauthorized'
  followers: number | null
  likes: number | null
  worksCount: number | null
  bio: string | null
  region: string | null
  verified: boolean | null
  avatar: string
  tone: string
  active: 'active' | 'low' | 'silent' | 'unknown'
  lastPublishedAt: string | null
  silentDays: number | null
  status: string
  login: string | null
  syncedAt: string | null
}

export interface WorkMetrics {
  plays: number
  likes: number
  comments: number
  collects: number
  shares: number
}

export interface Work {
  id: string
  accountId: string
  publishedAt: string
  title: string
  contentType: string
  topic: string
  hook: string | null
  format: string
  durationSec: number
  metrics: WorkMetrics
}

export interface ContentTypeStat {
  key: string
  name: string
  count: number
  avgPlays: number
  avgLikes: number
  avgCollects: number
  color: string
}

export interface Topic {
  id: string
  title: string
  source: string
  sourceLabel: string
  type: string
  format: string
  duration: string
  biz: string
  region: string
  reason: string
  risk: string
  hot?: boolean
  hook: string
  say: string
}

export interface RecordingQuestion { q: string; count: number; wow: number; cat: string }

export interface Objection { name: string; count: number; share: number; trend: number }

export interface DashboardCity {
  name: string
  stores: number
  accounts: number
  published: number
  plays: number
  activeRate: number
}

export interface Dashboard {
  stores: number
  storesOnline: number
  accounts: number
  accountsActive: number
  published7d: number
  plays7d: number
  interactions7d: number
  recordingSegments: number
  coverage: number
  activeRate: number
  publishRate: number
  silentAccounts: number
  hotContentRate: number
  avgPlays: number
  trend: number[]
  byCity: DashboardCity[]
}

export interface DiagnosisEvidence { kind: string; refId: string; note: string }

export interface DiagnosisDim { name: string; status: string; note: string }

export interface DiagnosisIssue {
  title: string
  why: string
  evidence: DiagnosisEvidence[]
  suggestion: string
  action: string
}

export interface Diagnosis {
  accountId: string
  createdAt: string
  sampleSize: number
  periodDays: number
  dims: DiagnosisDim[]
  missingData: string[]
  issues: DiagnosisIssue[]
}

export interface CheckItem { name: string; status: string; note: string }

export interface ScriptVariant { name: string; on: boolean }

export interface ScriptDoc {
  topicId: string
  title: string
  hook: string
  body: string
  duration: string
  shooting: string[]
  cover: string
  covers: string[]
  publish: string
  tags: string[]
  cta: string
  variants: ScriptVariant[]
  checks: CheckItem[]
}

export interface MixcutShot { n: number; line: string; visual: string; src: string; voice: string }

export interface MixcutMaterial { name: string; type: string; count: number; licensed: boolean }

export interface MixcutDoc {
  template: string
  ratio: string
  duration: number
  shots: MixcutShot[]
  materials: MixcutMaterial[]
}

export interface Insight { text: string; kind: 'up' | 'warn' | 'flat' }

export interface ViralStructureStep { name: string; line: string; note: string }

export interface ViralRewrite {
  title: string
  hook: string
  body: string
  cover: string
  covers: string[]
  publish: string
  tags: string[]
  cta: string
  checks: CheckItem[]
}

export interface ViralDoc {
  id: string
  platform: string
  platformName: string
  cat: string
  hot?: boolean
  title: string
  author: string
  durationSec: number
  plays: number
  likes: number
  collects: number
  shares: number
  why: string
  risk: string
  structure: ViralStructureStep[]
  rewrite: ViralRewrite
}

export interface CommentItem {
  id: string
  accountId: string
  author: string
  text: string
  work: string
  likes: number
  at: string
  region: string
  douyinId: string
  aiJudge: string
  lead: boolean
}

export interface Lead {
  id: string
  name: string
  source: string
  need: string
  level: string
  contact: string
  status: string
  at: string
}

export interface NurtureAccount { id: string; label: string; on: boolean }

export interface NurtureRun { task: string; round: number; total: number; target: string; watching: string }

export interface NurtureFeedItem { title: string; author: string; plays: string; dur: string; hit: string }

export interface NurtureLog {
  at: string
  acct: string
  type: string
  obj: string
  dwell: string
  like: boolean
  collect: boolean
  note: string
}

export interface Nurture {
  stage: string
  day: number
  target: number
  rate: string
  accounts: NurtureAccount[]
  keywords: string[]
  weights: { feed: number; search: number }
  hitMultiplier: number
  skipIfMiss: boolean
  likeAndCollect: boolean
  dwellVideo: number[]
  dwellLive: number[]
  gap: number[]
  perRound: number[]
  run: NurtureRun
  feed: NurtureFeedItem[]
  logs: NurtureLog[]
}

export interface RecAsset {
  id: string
  name: string
  store: string
  staff: string
  dur: string
  at: string
  asr: string
  topic: string
}

export interface Complaint {
  id: string
  at: string
  store: string
  cust: string
  type: string
  level: string
  status: string
  owner: string
}

export interface Opportunity {
  id: string
  cust: string
  need: string
  from: string
  src: string
  level: string
  value: string
  status: string
}

export interface RecDevice {
  name: string
  ip: string
  todayCount: number
  todayDuration: string
  lastBeat: string
}

export interface SS {
  orgs: Org[]
  stores: Store[]
  employees: Employee[]
  accounts: Account[]
  works: Work[]
  contentTypes: ContentTypeStat[]
  topics: Topic[]
  recordings: RecordingQuestion[]
  objections: Objection[]
  dashboard: Dashboard
  diagnoses: Record<string, Diagnosis>
  script: ScriptDoc
  mixcut: MixcutDoc
  viral: ViralDoc[]
  comments: CommentItem[]
  leads: Lead[]
  nurture: Nurture
  recAssets: RecAsset[]
  complaints: Complaint[]
  opportunities: Opportunity[]
  recDevice: RecDevice
  insights: Insight[]
  fmt: (n: number | null | undefined) => string
  fmtK: (n: number | null | undefined) => string
  dt: (s: string | null | undefined) => string
}
```

**Step 2: 类型检查通过（此时 data/ 只有这一个文件）**

Run: `node node_modules\typescript\bin\tsc --noEmit`
Expected: PASS（无错误输出，exit 0）

**Step 3: Commit**

```powershell
git add demo/electron-ts/data/entities.ts
git commit -m "feat(demo): define SS entity types"
```

---

### Task 4: 迁移 data.ts（让契约测试转绿）

**Files:**
- Create: `demo/electron-ts/data/data.ts`

**Step 1: 机械迁移（保持运行时契约逐字不变）**

以 `desktop-shell/static/assets/data.js`（515 行）为正本，做且只做以下变换：

1. 文件头加 `import type { ... } from './entities'`（仅类型导入，编译后擦除，不产生 require）
2. 每个 `const` 数组/对象追加类型标注：
   - `const orgs: Org[] = [...]`、`const stores: Store[] = [...]`、`const employees: Employee[] = [...]`
   - `const accounts: Account[] = [...]`、`const works: Work[] = [...]`、`const contentTypes: ContentTypeStat[] = [...]`
   - `const topics: Topic[] = [...]`、`const recordings: RecordingQuestion[] = [...]`、`const objections: Objection[] = [...]`
   - `const dashboard: Dashboard = {...}`、`const diagnoses: Record<string, Diagnosis> = {...}`
   - `const script: ScriptDoc = {...}`、`const mixcut: MixcutDoc = {...}`、`const viral: ViralDoc[] = [...]`
   - `const comments: CommentItem[] = [...]`、`const leads: Lead[] = [...]`、`const nurture: Nurture = {...}`
   - `const recAssets: RecAsset[] = [...]`、`const complaints: Complaint[] = [...]`、`const opportunities: Opportunity[] = [...]`
   - `const recDevice: RecDevice = {...}`、`const insights: Insight[] = [...]`
3. 三个工具函数签名：
   - `const fmt = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : new Intl.NumberFormat('zh-CN').format(n))`
   - `const fmtK = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : fmt(n))`
   - `const dt = (s: string | null | undefined): string => (s ? s.slice(0, 10) : '—')`
4. 末行暴露保持逐字一致：`window.SS = { orgs, stores, employees, accounts, works, contentTypes, topics, recordings, objections, dashboard, diagnoses, script, mixcut, viral, comments, leads, nurture, recAssets, complaints, opportunities, recDevice, insights, fmt, fmtK, dt };`
5. **数据值零改动**：所有样例数值、文案、键名原样保留

**Step 2: 类型检查**

Run: `node node_modules\typescript\bin\tsc --noEmit`
Expected: PASS。若报字段类型不符（如把 `active: 'low'` 撞上联合类型），修**接口**以如实反映数据（数据是正本），不改数据值。

**Step 3: 跑契约测试确认仍为红（dist 产物未组装）**

Run: `node scripts\verify-contract.mjs`
Expected: FAIL（`dist\renderer\assets\data.js` 不存在）

**Step 4: Commit**

```powershell
git add demo/electron-ts/data/data.ts
git commit -m "feat(demo): migrate data.js to typed data.ts"
```

---

### Task 5: 组装脚本 + 构建转绿

**Files:**
- Create: `demo/electron-ts/scripts/sync-public.mjs`

**Step 1: 写组装脚本**

```js
// 组装 dist/renderer/：HTML/CSS 取自 desktop-shell/static 正本，data.js 取自编译产物。
// 单一事实来源：原型视图永远与仓库正本一致，demo 不持有第二份漂移副本。
import { copyFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const staticDir = join(root, '..', '..', 'desktop-shell', 'static')
const out = join(root, 'dist', 'renderer')

mkdirSync(join(out, 'assets'), { recursive: true })
copyFileSync(join(staticDir, 'smartstore-desktop.html'), join(out, 'smartstore-desktop.html'))
copyFileSync(join(staticDir, 'assets', 'app.css'), join(out, 'assets', 'app.css'))
copyFileSync(join(root, 'dist', 'data', 'data.js'), join(out, 'assets', 'data.js'))
console.log('sync-public OK: smartstore-desktop.html + app.css + data.js -> dist/renderer/')
```

**Step 2: 构建**

Run: `node node_modules\typescript\bin\tsc` 然后 `node scripts\sync-public.mjs`
Expected: 两者 exit 0；`dist/renderer/` 下有 `smartstore-desktop.html`、`assets/app.css`、`assets/data.js`

**Step 3: 契约测试转绿**

Run: `node scripts\verify-contract.mjs`
Expected: `contract verify OK: 25 keys + 3 helpers identical`，exit 0

**Step 4: Commit**

```powershell
git add demo/electron-ts/scripts/sync-public.mjs
git commit -m "build(demo): assemble renderer from canonical prototype"
```

---

### Task 6: Electron 壳（main.ts + preload.ts + 全局类型）

**Files:**
- Create: `demo/electron-ts/electron/main.ts`
- Create: `demo/electron-ts/electron/preload.ts`
- Create: `demo/electron-ts/types/global.d.ts`

**Step 1: 写 main.ts**

```ts
import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const rendererPage = join(__dirname, '..', 'renderer', 'smartstore-desktop.html')

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    show: true,
    frame: false,
    backgroundColor: '#f7f8fa',
    title: 'AI智慧门店',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (!existsSync(rendererPage)) {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent('<h2 style="font-family:sans-serif;padding:40px">demo 产物缺失，请先执行构建。</h2>')}`,
    )
    return
  }
  await win.loadFile(rendererPage)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  void createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

ipcMain.on('window-control', (event, action: 'minimize' | 'toggle-maximize' | 'close') => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  if (action === 'minimize') win.minimize()
  if (action === 'toggle-maximize') (win.isMaximized() ? win.unmaximize() : win.maximize())
  if (action === 'close') win.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

注意：`sandbox: false` 是为了让 preload 能 `require('electron')` 全量 API（与 desktop-shell 行为一致；`contextIsolation` 仍为 true）。

**Step 2: 写 preload.ts（契约逐字对齐 preload.cjs）**

```ts
import { contextBridge, ipcRenderer } from 'electron'

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close'

contextBridge.exposeInMainWorld('desktopWindow', {
  control: (action: WindowAction) => ipcRenderer.send('window-control', action),
})
```

**Step 3: 写 global.d.ts**

```ts
import type { SS } from '../data/entities'

declare global {
  interface Window {
    SS: SS
    desktopWindow: {
      control: (action: 'minimize' | 'toggle-maximize' | 'close') => void
    }
  }
}

export {}
```

**Step 4: 类型检查**

Run: `node node_modules\typescript\bin\tsc --noEmit`
Expected: PASS

**Step 5: 重新构建并复跑契约测试**

Run: `node node_modules\typescript\bin\tsc && node scripts\sync-public.mjs && node scripts\verify-contract.mjs`
Expected: 全部 PASS

**Step 6: Commit**

```powershell
git add demo/electron-ts/electron/main.ts demo/electron-ts/electron/preload.ts demo/electron-ts/types/global.d.ts
git commit -m "feat(demo): typed electron shell for smartstore prototype"
```

---

### Task 7: 产物验收 + 快捷方式 + 提交

**Step 1: 产物清单核验**

Run:
```powershell
Get-ChildItem -Recurse -File demo\electron-ts\dist | Select-Object Length, FullName
```
Expected 存在且非零：`dist\electron\main.js`、`dist\electron\preload.js`、`dist\data\data.js`、`dist\renderer\smartstore-desktop.html`、`dist\renderer\assets\app.css`、`dist\renderer\assets\data.js`

**Step 2: 生成用户启动快捷方式**

```powershell
$ws = 'E:\BaiduSyncdisk\lab\60smartStore'
$demo = "$ws\demo\electron-ts"
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut("$demo\AI智慧门店-TS.lnk")
$s.TargetPath = "$demo\node_modules\electron\dist\electron.exe"
$s.Arguments = "`"$demo`""
$s.WorkingDirectory = $demo
$s.IconLocation = "$demo\node_modules\electron\dist\electron.exe"
$s.Description = 'AI智慧门店 · Electron+TS 集成验证'
$s.Save()
```

**Step 3: 用户验收（代理无法拉窗）**

用户双击 `demo/electron-ts/AI智慧门店-TS.lnk`，核对：
1. 六中心原型完整加载（主页/账号/内容/矩阵/录音/驾驶舱）
2. 数据与现有 exe 一致（王姐12345、南京玄武等样例）
3. 无边框窗口的最小化/最大化/关闭按钮生效（= IPC 契约生效）
4. 提词器可用

**Step 4: 最终提交**

```powershell
git add demo/electron-ts
git commit -m "chore(demo): electron-ts integration verified"
```

---

## 实施偏差记录（2026-09-28 执行后回写）

1. **entities.ts 由模块导出改为环境全局类型**：原计划 `export interface`，实际执行中发现 `import type` 会让 data.ts 被判为模块，编译产物携带 `exports.__esModule` 包装，浏览器脚本执行即抛 `ReferenceError: exports is not defined`（契约测试第 3 步红灯捕获）。改为环境全局接口 + data.ts 零 import 后，产物为纯脚本，契约转绿。
2. **types/global.d.ts 前移至 Task 4**：data.ts 的 `window.SS = ...` 赋值依赖该声明，无法等到 Task 6。
3. 产物 `dist/renderer/assets/data.js` 头部多一行 `"use strict";`（模块化编译残留），无行为影响，契约深度比对通过。

## 完成定义

Task 1–6 全部绿（typecheck / build / verify-contract），Task 7 用户确认四条验收通过，即本集成完成。任何 `verify-contract` 红灯都视为回归，必须修 data.ts 而不是改测试。
