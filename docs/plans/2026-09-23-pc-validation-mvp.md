# AI智慧门店 PC 功能验证版 实施计划

> **For the executing agent:** REQUIRED SUB-SKILL: 使用 `executing-plans` 技能按任务逐条实施本计划。
> 每个任务都是 TDD 小步：先写失败的测试 → 跑到失败 → 最小实现 → 跑到通过 → 提交。

**Goal:** 交付一个**单机可运行、双击即用**的 PC 桌面应用，跑通「账号诊断 → 选题 → 口播生成 → 矩阵看板 → 录音洞察 → 驾驶舱」核心链路，用于**功能验证**（不是生产交付）。

**Architecture:**
- Electron 桌面壳（electron-vite 管理 main / preload / renderer 三端）。
- 本地业务 API 用 Fastify **跑在 Electron 主进程内**，监听 `127.0.0.1` 随机端口；渲染进程**只通过 HTTP** 访问它 —— 这个边界刻意做成与将来云端 API 同形，将来整体上云只换 baseURL。
- 数据层用 **JSON 文件仓储**（`app-data/`），仓储接口稳定，将来可整体替换为 SQLite 或云端数据库。验证阶段不引入任何原生模块，规避 Electron ABI 重编译与打包风险。
- 数据来源走**适配层**：`sample`（样例数据包，打底）+ `collector`（真实账号采集，后置）。
- AI 调用封装在 `src/server/ai/`，文本走 DeepSeek，图像/视频走火山方舟，密钥一律走环境变量，**不落库、不进仓库**。

**Tech Stack:** Electron 44.4.5 · electron-vite 5.0.0 · React 19.3.0 · TypeScript 6 · Tailwind CSS v4 · Fastify 5.12.5 · Zod 4.6.5 · Vitest 5.0.1 · electron-builder 26.15.3

---

## 0. 前置约束（每个任务都必须遵守）

### 0.1 绝不能做的事（企业项目隔离要求）

| 禁止 | 原因 |
|---|---|
| 引入 `dsh-workbench-plugin` / 任何 Digoo 工作台依赖 | Digoo 工作台是私人工具台，**不能混进企业项目** |
| 在项目里创建或读写 `.workbench/` | 同上；本项目永远不应出现该目录 |
| 复用 `63workbench` 的代码、数据结构、`app-data` 格式 | 同上；**做法可借鉴，资产不复用** |
| 把 API Key 写进仓库任何文件 | 密钥走环境变量 |

### 0.2 环境事实（已实测，不要再猜）

- Node `v22.20.0`，npm `10.9.3`，git `2.47.1`，**仓库尚未初始化**。
- **npm 默认缓存在工作区外，会被沙箱拒绝（`EPERM`）**。每次装包前必须：
  ```powershell
  $env:npm_config_cache = "$PWD\.npm-cache"
  $env:ELECTRON_CACHE   = "$PWD\.electron-cache"
  $env:ELECTRON_MIRROR  = "https://npmmirror.com/mirrors/electron/"
  ```
- npm registry 已指向 `https://registry.npmmirror.com/`，**可达**。
- Electron 二进制包较大，必须设 `ELECTRON_MIRROR` + `ELECTRON_CACHE`，否则下载失败或写入被拒。

### 0.3 产品硬口径（PRD §5.1.2 / §8.1，必须变成测试）

这四条是 PRD 反复强调的，**要写成单元测试而不是写在注释里**：

1. 缺失数据必须标记为「暂无数据/未授权」，**不得用估算值冒充真实数据**。
2. 每条诊断结论必须能追溯到具体的数据、作品或内容特征（`evidence` 字段非空）。
3. 表现与时间/形式之间**只表述相关性，不得表述为因果**。
4. 默认分析最近 30 条作品；不足 30 条时分析全部并**展示样本量**。

---

## Phase 0：工程骨架（让窗口跑起来，并能被调用）

### Task 0.1: 初始化仓库与忽略规则

**Files:**
- Create: `.gitignore`

**Step 1: 初始化仓库**

```powershell
cd E:\BaiduSyncdisk\lab\60smartStore
git init
```

**Step 2: 写 `.gitignore`**

```gitignore
# 依赖与工具缓存（必须项目内，见 0.2）
node_modules/
.npm-cache/
.electron-cache/
.pnpm-store/

# 构建产物
dist/
out/
release/

# 运行时数据与密钥（绝不入库）
app-data/
.env
.env.local
*.local

# 编辑器
.vscode/
.idea/
.DS_Store
```

**Step 3: 提交**

```powershell
git add .gitignore
git commit -m "chore: init repo with ignore rules"
```

---

### Task 0.2: 建立工程与依赖

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: 初始化 package.json**

```powershell
cd E:\BaiduSyncdisk\lab\60smartStore
npm init -y
```

把 `package.json` 改成（`main` 指向 electron-vite 的输出）：

```json
{
  "name": "smart-store-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "package": "electron-vite build && electron-builder --win portable"
  }
}
```

**Step 2: 安装依赖（注意必须带缓存/镜像环境变量）**

```powershell
$env:npm_config_cache = "$PWD\.npm-cache"
$env:ELECTRON_CACHE   = "$PWD\.electron-cache"
$env:ELECTRON_MIRROR  = "https://npmmirror.com/mirrors/electron/"

npm i -D electron@44.4.5 electron-vite@5.0.0 electron-builder@26.15.3 `
         vite typescript@^6 vitest@5.0.1 @vitejs/plugin-react @types/react @types/react-dom @types/node
npm i react@19.3.0 react-dom@19.3.0 fastify@5.12.5 zod@4.6.5
npm i -D tailwindcss@^4 @tailwindcss/vite
```

> 若 npm 报 `electron-vite` 与 `vite` 的 peer 冲突，按提示把 `vite` 调到兼容主版本后重装（`64smartCommunity` 用的是 vite 8，可参考）。

**Step 3: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tests", "electron.vite.config.ts"]
}
```

**Step 4: 验证依赖装好了**

```powershell
npx electron --version
```
Expected: 打印 `v44.4.5`（首次会从镜像下载二进制，耐心等）。

**Step 5: 提交**

```powershell
git add package.json package-lock.json tsconfig.json
git commit -m "chore: scaffold project and pin dependencies"
```

---

### Task 0.3: 本地 API 服务（可独立测试）

先把业务服务做成**不依赖 Electron** 的纯 Node 模块，这样它能被 Vitest 直接测。

**Files:**
- Create: `src/server/app.ts`
- Test: `tests/server/app.test.ts`
- Create: `vitest.config.ts`

**Step 1: 写失败的测试**

`tests/server/app.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { buildServer } from '../../src/server/app'

describe('本地 API', () => {
  it('GET /api/health 返回 ok', async () => {
    const app = buildServer()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true })
    await app.close()
  })
})
```

**Step 2: 写 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

**Step 3: 跑到失败**

```powershell
npm test
```
Expected: FAIL —— 找不到模块 `../../src/server/app`。

**Step 4: 最小实现**

`src/server/app.ts`
```ts
import Fastify, { type FastifyInstance } from 'fastify'

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false })

  app.get('/api/health', async () => ({ ok: true }))

  return app
}
```

**Step 5: 跑到通过**

```powershell
npm test
```
Expected: PASS，1 passed。

**Step 6: 提交**

```powershell
git add src/server/app.ts tests/server/app.test.ts vitest.config.ts
git commit -m "feat(server): add local API with health endpoint"
```

---

### Task 0.4: Electron 壳与窗口

**Files:**
- Create: `electron.vite.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`

**Step 1: 写 `electron.vite.config.ts`**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } }
  }
})
```

**Step 2: 主进程 —— 同时拉起本地 API**

`src/main/index.ts`
```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { buildServer } from '../server/app'

let apiPort = 0

async function startApi(): Promise<number> {
  const server = buildServer()
  await server.listen({ host: '127.0.0.1', port: 0 })
  const address = server.server.address()
  if (!address || typeof address === 'string') throw new Error('本地 API 启动失败')
  return address.port
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  apiPort = await startApi()
  process.env.SMARTSTORE_API_PORT = String(apiPort)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

**Step 3: 预加载脚本 —— 把 API 端口交给渲染进程**

`src/preload/index.ts`
```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('smartstore', {
  apiBaseUrl: `http://127.0.0.1:${process.env.SMARTSTORE_API_PORT}`
})
```

**Step 4: 渲染进程最小页面**

`src/renderer/index.html`
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>AI智慧门店</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/renderer/src/main.tsx`
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/styles.css`
```css
@import 'tailwindcss';
```

`src/renderer/src/App.tsx`
```tsx
import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('连接中…')

  useEffect(() => {
    const base = window.smartstore?.apiBaseUrl ?? ''
    fetch(`${base}/api/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? '本地服务正常' : '本地服务异常'))
      .catch(() => setStatus('本地服务未连接'))
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">AI智慧门店 · 功能验证版</h1>
        <p className="mt-3 text-slate-400">{status}</p>
      </div>
    </div>
  )
}
```

**Step 5: 补渲染进程的类型声明**

`src/renderer/src/env.d.ts`
```ts
declare global {
  interface Window {
    smartstore?: { apiBaseUrl: string }
  }
}
export {}
```

**Step 6: 跑起来看**

```powershell
npm run dev
```
Expected: 弹出窗口，标题「AI智慧门店 · 功能验证版」，正文显示 **本地服务正常**。若显示「未连接」，说明主进程的 API 端口没传到渲染进程，检查 `SMARTSTORE_API_PORT` 的设置顺序。

**Step 7: 提交**

```powershell
git add electron.vite.config.ts src
git commit -m "feat(app): add electron shell with in-process local API"
```

---

### Task 0.5: 打包成绿色版（双击即用）

**Files:**
- Create: `electron-builder.yml`

**Step 1: 写 `electron-builder.yml`**

```yaml
appId: cn.com.smartstore.desktop
productName: AI智慧门店
directories:
  output: release
files:
  - out/**/*
  - package.json
win:
  target:
    - portable
portable:
  artifactName: AI智慧门店-${version}-便携版.exe
```

**Step 2: 打包**

```powershell
npm run package
```
Expected: `release\AI智慧门店-0.1.0-便携版.exe` 生成。

**Step 3: 人工验证（关键一步）**

**关掉 `npm run dev`**，双击那个 exe。Expected: 窗口打开、显示「本地服务正常」。
这一步必须做 —— 打包后路径与加载方式都变了，dev 能跑不代表 exe 能跑。

**Step 4: 提交**

```powershell
git add electron-builder.yml
git commit -m "chore: add portable packaging config"
```

> **Phase 0 完成标志**：双击一个 exe 就能打开应用，且应用内自带后端服务、能自检。这一步跑通后，后面所有功能都只是往这个骨架里填。

---

## Phase 1：数据层与样例数据包

### Task 1.1: 领域模型（照 PRD §7 定 10 个实体）

**Files:**
- Create: `src/server/domain/types.ts`
- Create: `src/server/domain/schemas.ts`
- Test: `tests/server/domain/schemas.test.ts`

**Step 1: 写失败的测试**

`tests/server/domain/schemas.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { AccountSchema, WorkSchema } from '../../../src/server/domain/schemas'

describe('领域模型', () => {
  it('账号必须带授权状态', () => {
    const parsed = AccountSchema.safeParse({
      id: 'a1', platform: 'douyin', nickname: '测试号',
      homepage: 'https://example.com', orgId: 'org1', authStatus: 'authorized'
    })
    expect(parsed.success).toBe(true)
  })

  it('缺少授权状态的账号不合法', () => {
    const parsed = AccountSchema.safeParse({ id: 'a1', platform: 'douyin' })
    expect(parsed.success).toBe(false)
  })

  it('作品指标缺失时保留 undefined，不得填 0 冒充', () => {
    const work = WorkSchema.parse({
      id: 'w1', accountId: 'a1', publishedAt: '2026-09-01T10:00:00Z',
      title: '千兆宽带为什么还卡', contentType: 'knowledge'
    })
    expect(work.metrics.plays).toBeUndefined()
  })
})
```

**Step 2: 跑到失败**

```powershell
npm test
```
Expected: FAIL —— 找不到 `schemas`。

**Step 3: 实现类型与 schema**

`src/server/domain/types.ts`
```ts
export type Platform = 'douyin' | 'kuaishou'
export type AuthStatus = 'authorized' | 'unauthorized' | 'expired'
export type OrgLevel = 'group' | 'province' | 'city' | 'district' | 'store'
export type ContentType =
  | 'knowledge' | 'pitfall' | 'qa' | 'comparison'
  | 'story' | 'campaign' | 'daily' | 'product'

export interface Org { id: string; name: string; level: OrgLevel; parentId: string | null }
export interface Store { id: string; orgId: string; name: string; status: 'active' | 'inactive' }
export interface Employee { id: string; storeId: string; name: string; role: string; status: string }

export interface Account {
  id: string
  platform: Platform
  nickname: string
  homepage: string
  orgId: string
  employeeId?: string
  authStatus: AuthStatus
  followers?: number
  likes?: number
  worksCount?: number
  bio?: string
  avatarUrl?: string
  region?: string
  verified?: boolean
}

/** 指标缺失一律 undefined —— 绝不用 0 或估算值冒充 */
export interface WorkMetrics {
  plays?: number
  likes?: number
  comments?: number
  collects?: number
  shares?: number
}

export interface Work {
  id: string
  accountId: string
  publishedAt: string
  title: string
  contentType: ContentType
  topic?: string
  hook?: string
  format?: 'talking-head' | 'montage' | 'digital-human' | 'vlog' | 'product'
  durationSec?: number
  metrics: WorkMetrics
}

export interface Evidence {
  kind: 'account' | 'work' | 'metric' | 'content'
  refId: string
  note: string
}

export interface DiagnosisIssue {
  title: string
  why: string
  evidence: Evidence[]
  suggestion: string
  action?: string
}

export interface Diagnosis {
  id: string
  accountId: string
  createdAt: string
  sampleSize: number
  dims: Record<string, 'good' | 'ok' | 'todo'>
  issues: DiagnosisIssue[]
  missingData: string[]
}
```

`src/server/domain/schemas.ts`
```ts
import { z } from 'zod'

export const PlatformSchema = z.enum(['douyin', 'kuaishou'])
export const AuthStatusSchema = z.enum(['authorized', 'unauthorized', 'expired'])
export const ContentTypeSchema = z.enum([
  'knowledge', 'pitfall', 'qa', 'comparison',
  'story', 'campaign', 'daily', 'product'
])

export const AccountSchema = z.object({
  id: z.string().min(1),
  platform: PlatformSchema,
  nickname: z.string().min(1),
  homepage: z.string().min(1),
  orgId: z.string().min(1),
  employeeId: z.string().optional(),
  authStatus: AuthStatusSchema,
  followers: z.number().optional(),
  likes: z.number().optional(),
  worksCount: z.number().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  region: z.string().optional(),
  verified: z.boolean().optional()
})

export const WorkMetricsSchema = z.object({
  plays: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  collects: z.number().optional(),
  shares: z.number().optional()
})

export const WorkSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  publishedAt: z.string().min(1),
  title: z.string().min(1),
  contentType: ContentTypeSchema,
  topic: z.string().optional(),
  hook: z.string().optional(),
  format: z.enum(['talking-head', 'montage', 'digital-human', 'vlog', 'product']).optional(),
  durationSec: z.number().optional(),
  metrics: WorkMetricsSchema.default({})
})
```

**Step 4: 跑到通过**

```powershell
npm test
```
Expected: PASS。

**Step 5: 提交**

```powershell
git add src/server/domain tests/server/domain
git commit -m "feat(domain): add PRD data model with missing-data semantics"
```

---

### Task 1.2: JSON 仓储（原子写 + 目录可配）

**Files:**
- Create: `src/server/data/jsonStore.ts`
- Test: `tests/server/data/jsonStore.test.ts`

**Step 1: 写失败的测试**

`tests/server/data/jsonStore.test.ts`
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonStore } from '../../../src/server/data/jsonStore'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ss-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('JsonStore', () => {
  it('写入后能读回', () => {
    const s = new JsonStore(dir)
    s.write('accounts', [{ id: 'a1' }])
    expect(s.read('accounts')).toEqual([{ id: 'a1' }])
  })

  it('文件不存在时返回空数组，而不是抛错', () => {
    const s = new JsonStore(dir)
    expect(s.read('nothing')).toEqual([])
  })

  it('文件损坏时抛明确错误，不静默吞掉', () => {
    const s = new JsonStore(dir)
    s.write('bad', { a: 1 })
    // 人为破坏
    const fs = require('node:fs')
    fs.writeFileSync(join(dir, 'bad.json'), '{ not json', 'utf8')
    expect(() => s.read('bad')).toThrow(/损坏/)
  })
})
```

**Step 2: 跑到失败**

```powershell
npm test
```
Expected: FAIL —— 找不到 `jsonStore`。

**Step 3: 实现**

`src/server/data/jsonStore.ts`
```ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 极简 JSON 文件仓储。
 * 验证阶段刻意不用 SQLite：无原生模块 = 无 Electron ABI 重编译 = 无打包风险。
 * 接口稳定，将来可整体替换为 SQLite / 云端。
 */
export class JsonStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  private path(name: string): string {
    return join(this.dir, `${name}.json`)
  }

  read<T = unknown>(name: string): T[] {
    const p = this.path(name)
    if (!existsSync(p)) return []
    const raw = readFileSync(p, 'utf8')
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : [parsed as T]
    } catch {
      throw new Error(`数据文件损坏: ${p}`)
    }
  }

  write(name: string, data: unknown): void {
    const p = this.path(name)
    const tmp = `${p}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameSync(tmp, p) // 原子替换，避免写一半断电
  }
}
```

**Step 4: 跑到通过**

```powershell
npm test
```
Expected: PASS。

**Step 5: 提交**

```powershell
git add src/server/data tests/server/data
git commit -m "feat(data): add atomic json store behind stable interface"
```

---

### Task 1.3: 样例数据包（验证期的数据底座）

这是 A+B 数据策略里的 **A**：先让全链路有数据可跑。

**Files:**
- Create: `app-data/samples/accounts.json`
- Create: `app-data/samples/works.json`
- Create: `app-data/samples/orgs.json`
- Create: `src/server/data/seed.ts`
- Test: `tests/server/data/seed.test.ts`

**Step 1: 造 3 个有代表性的样例账号**

要求（覆盖诊断能识别出的典型问题，别造成"完美账号"）：

| 账号 | 典型问题 |
|---|---|
| `sample-wang` | 定位模糊：名称含无意义数字、简介是"记录生活"、内容杂乱 |
| `sample-li` | 垂直度高但选题偏硬广：套餐广告占比过高、互动低 |
| `sample-zhang` | 更新不稳定：断更严重、但知识类内容表现好（有亮点可挖） |

每个账号配 10–30 条作品，**指标要有明显差异**（知识类播放/收藏高，套餐广告低），否则内容洞察无从验证。

`app-data/samples/orgs.json`（节选，完整照 PRD 组织层级）
```json
[
  { "id": "org-prov-js", "name": "江苏省公司", "level": "province", "parentId": "org-group" },
  { "id": "org-city-nj", "name": "南京市", "level": "city", "parentId": "org-prov-js" },
  { "id": "org-store-xh", "name": "玄武营业厅", "level": "store", "parentId": "org-city-nj" }
]
```

`app-data/samples/accounts.json`（节选）
```json
[
  {
    "id": "sample-wang",
    "platform": "douyin",
    "nickname": "王姐12345",
    "homepage": "https://www.douyin.com/user/sample-wang",
    "orgId": "org-store-xh",
    "authStatus": "authorized",
    "followers": 1280,
    "likes": 4300,
    "worksCount": 22,
    "bio": "记录生活，分享美好。",
    "region": "江苏南京"
  }
]
```

`app-data/samples/works.json`（节选 —— 注意指标差异要真实）
```json
[
  {
    "id": "w-wang-001", "accountId": "sample-wang",
    "publishedAt": "2026-08-20T10:00:00+08:00",
    "title": "千兆宽带为什么卧室还是卡？", "contentType": "knowledge",
    "topic": "家庭Wi-Fi", "hook": "花千兆的钱，住千兆的房，为啥还卡？",
    "format": "talking-head", "durationSec": 38,
    "metrics": { "plays": 5600, "likes": 156, "comments": 28, "collects": 63, "shares": 12 }
  },
  {
    "id": "w-wang-002", "accountId": "sample-wang",
    "publishedAt": "2026-08-22T18:00:00+08:00",
    "title": "本月套餐超值优惠", "contentType": "campaign",
    "topic": "套餐", "format": "product", "durationSec": 25,
    "metrics": { "plays": 820, "likes": 18, "comments": 2, "collects": 1, "shares": 0 }
  }
]
```

> 补全时请保证：**知识/避坑/问答类 ≥ 3 条高表现样本，套餐/活动类 ≥ 3 条低表现样本**，否则 Task 4 的"什么内容有效"无法验证。

**Step 2: 写失败的测试**

`tests/server/data/seed.test.ts`
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { seedFromSamples } from '../../../src/server/data/seed'
import { JsonStore } from '../../../src/server/data/jsonStore'
import { AccountSchema, WorkSchema } from '../../../src/server/domain/schemas'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ss-seed-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('样例数据导入', () => {
  it('导入后账号与作品都符合 schema', () => {
    const sampleDir = resolve(__dirname, '../../../app-data/samples')
    seedFromSamples(new JsonStore(dir), sampleDir)

    const accounts = new JsonStore(dir).read('accounts')
    expect(accounts.length).toBeGreaterThanOrEqual(3)
    accounts.forEach((a) => expect(AccountSchema.safeParse(a).success).toBe(true))

    const works = new JsonStore(dir).read('works')
    expect(works.length).toBeGreaterThanOrEqual(30)
    works.forEach((w) => expect(WorkSchema.safeParse(w).success).toBe(true))
  })

  it('高表现的知识类与低表现的广告类同时存在（内容洞察可验证）', () => {
    const sampleDir = resolve(__dirname, '../../../app-data/samples')
    seedFromSamples(new JsonStore(dir), sampleDir)
    const works = new JsonStore(dir).read<any>('works')
    const knowledge = works.filter((w) => w.contentType === 'knowledge')
    const campaign = works.filter((w) => w.contentType === 'campaign')
    const avg = (xs: any[]) => xs.reduce((s, w) => s + (w.metrics.plays ?? 0), 0) / xs.length
    expect(avg(knowledge)).toBeGreaterThan(avg(campaign) * 2)
  })
})
```

**Step 3: 跑到失败**

```powershell
npm test
```
Expected: FAIL —— 找不到 `seed`。

**Step 4: 实现**

`src/server/data/seed.ts`
```ts
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { JsonStore } from './jsonStore'

const COLLECTIONS = ['orgs', 'stores', 'employees', 'accounts', 'works'] as const

/** 从样例数据包导入到运行时数据目录。幂等：同名集合会被覆盖。 */
export function seedFromSamples(store: JsonStore, sampleDir: string): string[] {
  const imported: string[] = []
  for (const name of COLLECTIONS) {
    const p = join(sampleDir, `${name}.json`)
    if (!existsSync(p)) continue
    store.write(name, JSON.parse(readFileSync(p, 'utf8')))
    imported.push(name)
  }
  return imported
}
```

**Step 5: 跑到通过**

```powershell
npm test
```
Expected: PASS。

**Step 6: 提交**

```powershell
git add app-data/samples src/server/data/seed.ts tests/server/data/seed.test.ts
git commit -m "feat(data): add sample dataset covering diagnosis and insight cases"
```

> 注意：`app-data/` 已在 `.gitignore` 里。样例数据属于**仓库资产**，需要单独放行：
> 在 `.gitignore` 中把 `app-data/` 改成：
> ```gitignore
> app-data/*
> !app-data/samples/
> ```
> 然后 `git add -f app-data/samples`。

---

### Task 1.4: 数据目录定位（开发/打包两态）

**Files:**
- Create: `src/server/config.ts`
- Test: `tests/server/config.test.ts`

**Step 1: 写失败的测试**

`tests/server/config.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { resolveDataDir } from '../../src/server/config'

describe('数据目录定位', () => {
  it('优先用环境变量 SMARTSTORE_DATA_DIR', () => {
    expect(resolveDataDir({ SMARTSTORE_DATA_DIR: 'D:/x' } as any)).toBe('D:/x')
  })

  it('打包后落到 userData，而不是程序目录（程序目录可能只读）', () => {
    const d = resolveDataDir({} as any, { packaged: true, userData: 'C:/u' })
    expect(d).toBe('C:/u/app-data')
  })
})
```

**Step 2: 跑到失败 → Step 3: 实现**

`src/server/config.ts`
```ts
import { resolve } from 'node:path'

export interface RuntimeEnv {
  packaged: boolean
  userData: string
}

/**
 * 打包后写到 userData（程序目录在 Program Files 下通常不可写）；
 * 开发态写到项目内 app-data，方便直接看 JSON。
 */
export function resolveDataDir(
  env: NodeJS.ProcessEnv,
  runtime: RuntimeEnv = { packaged: false, userData: '' }
): string {
  if (env.SMARTSTORE_DATA_DIR) return env.SMARTSTORE_DATA_DIR
  if (runtime.packaged) return resolve(runtime.userData, 'app-data')
  return resolve(process.cwd(), 'app-data')
}
```

**Step 4: 跑到通过 → Step 5: 提交**

```powershell
git add src/server/config.ts tests/server/config.test.ts
git commit -m "feat(server): resolve data dir for dev and packaged modes"
```

---

## Phase 2：账号档案与诊断（尖刀 1）

> 这一阶段是验证的核心。**诊断的可信度决定整个产品的可信度。**

### Task 2.1: 账号仓储与 API

**Files:**
- Create: `src/server/repositories/accounts.ts`
- Create: `src/server/routes/accounts.ts`
- Modify: `src/server/app.ts`（挂载路由、注入 store）
- Test: `tests/server/routes/accounts.test.ts`

**要点：**
- `buildServer({ store })` 改为**接受注入的 store**，测试用临时目录，绝不碰真实数据。
- `GET /api/accounts` 列表（支持按 orgId 过滤）、`POST /api/accounts` 录入、`GET /api/accounts/:id`、`GET /api/accounts/:id/works`。
- 录入时 `authStatus` 必填，`unauthorized` 的账号在列表 UI 上要有明显标记（PRD §5.1.2 规则 2）。

**验收：** `npm test` 全绿；`GET /api/accounts` 能返回样例的 3 个账号。

---

### Task 2.2: 诊断引擎（纯函数，可彻底单测）

**Files:**
- Create: `src/server/services/diagnosis/dimensions.ts`（四个维度的规则）
- Create: `src/server/services/diagnosis/index.ts`
- Test: `tests/server/services/diagnosis.test.ts`

**要点（这是全项目最该写好测试的地方）：**

四个维度各自是**纯函数**：`(account, works) => DimensionResult`

| 维度 | 规则示例（可先做启发式，后面才接 AI） |
|---|---|
| 账号包装 | 名称是否含地域/身份/领域词；简介是否说明"我是谁/提供什么价值/在哪" |
| 账号定位 | 内容主题分布是否收敛（垂直度 = TOP 主题占比） |
| 内容结构 | 有钩子比例、有 CTA 比例、时长分布 |
| 运营数据 | 发布频率、断更天数、内容类型 × 平均播放/互动 |

**必须写的测试：**
```ts
it('样本量不足 30 条时，报告要显示真实样本量', () => { /* ... */ })
it('缺少播放数据时，missingData 里必须有该字段，且不得输出估算值', () => { /* ... */ })
it('每条 issue 的 evidence 都不能为空', () => { /* ... */ })
it('结论文案不得包含因果措辞（如"因为…所以…"），只能表述相关', () => { /* ... */ })
it('最多输出 3 个核心问题（PRD §5.1.1）', () => { /* ... */ })
```

**验收：** 对 3 个样例账号跑诊断，输出的问题**确实对应我们预设的毛病**（这是验证"诊断有没有用"的第一道关）。

---

### Task 2.3: 接入 AI 生成诊断叙述

**Files:**
- Create: `src/server/ai/client.ts`（provider 抽象 + 超时 + 重试）
- Create: `src/server/ai/prompts/diagnosis.ts`
- Create: `src/server/services/diagnosis/narrate.ts`
- Test: `tests/server/ai/narrate.test.ts`

**要点：**
- `AiProvider` 接口 `chat(messages, opts): Promise<string>`；实现 `DeepSeekProvider`；测试用 `FakeProvider`，**测试绝不发真实网络请求**。
- Prompt 必须把 `dims` 与 `evidence` 作为**输入事实**传进去，要求模型只做**归因表述与整改建议**，不许编造数据。
- 输出后**校验**：若叙述里出现输入事实中不存在的数字，判为幻觉，降级为模板文案并记录告警。这条防幻觉校验值得写测试。

**验收：** 断网时诊断仍能用模板文案产出（降级可用），联网时叙述更自然。

---

### Task 2.4: 诊断报告页（PC 界面）

**Files:**
- Create: `src/renderer/src/pages/AccountsPage.tsx`
- Create: `src/renderer/src/pages/DiagnosisPage.tsx`
- Create: `src/renderer/src/components/EvidencePopover.tsx`
- Modify: `src/renderer/src/App.tsx`（加路由）

**要点：**
- 报告结构照 PRD §5.1.1：账号概况 → 核心结论（≤3）→ 维度体检 → 诊断依据 → 整改动作。
- **每条结论都能点开看到依据**（EvidencePopover 显示来源作品/指标），这是"真懂我的账号"的关键交互。
- 缺失数据用灰色「暂无数据/未授权」标签，不得显示 0。
- 整改动作里放**按钮**：「生成未来 7 天选题」直接跳到 Phase 3。

**验收（功能验证场景 1）：** 输入 `sample-wang`，报告能说出"名称缺地域与身份识别、简介缺少价值表达、内容垂直度低"，且每条都能点开依据。

---

## Phase 3：选题与口播生成（尖刀 2）

### Task 3.1: 选题仓储与三类来源

**Files:**
- Create: `src/server/repositories/topics.ts`
- Create: `src/server/routes/topics.ts`
- Create: `src/server/services/topics/sources.ts`
- Test: `tests/server/services/topics.test.ts`

**要点：** 三类来源（PRD §5.2）
- `manual`（运营人工下发）
- `business`（业务/套餐/活动）
- `recording`（录音高频问题转选题，Phase 5 接入）
- 选题卡片字段照 PRD §5.2.1（含**推荐理由**与**风险提示**）。

**验收：** 诊断报告的"生成未来 7 天选题"能产出一批带推荐理由的选题。

---

### Task 3.2: 口播素材生成

**Files:**
- Create: `src/server/services/script/index.ts`
- Create: `src/server/ai/prompts/script.ts`
- Create: `src/renderer/src/pages/ScriptPage.tsx`
- Test: `tests/server/services/script.test.ts`

**要点：** 输出项照 PRD §5.3 —— 选题/推荐理由、视频标题、3 秒钩子、完整口播稿（30–60 秒）、拍摄建议、封面文案、发布文案、标签、获客 CTA。

**必须测试：**
```ts
it('口播稿必须包含 3 秒钩子，且钩子不得是自我介绍开场', () => { /* ... */ })
it('CTA 不得包含虚假承诺（如"保证""100%""最低价"）', () => { /* ... */ })
it('标题不得包含夸大或违规承诺词', () => { /* ... */ })
```
最后一条是 PRD §8.1 的合规要求，用**敏感词表**做成可维护配置。

**验收（功能验证场景 2）：** 从任一选题生成口播，营业员**不改一个字就能念**。

---

## Phase 4：矩阵看板与内容效果（尖刀 3）

### Task 4.1: 聚合分析服务

**Files:**
- Create: `src/server/services/analytics/aggregate.ts`
- Test: `tests/server/services/analytics.test.ts`

**要点：**
- 内容类型 × 平均播放/点赞/评论/收藏（PRD §5.5）
- 活跃/低活跃/断更识别（按最近发布时间与频率）
- 排行榜（账号/门店/内容）
- **必须写成测试的口径约束**：样本量 < 3 的类型不进榜（避免一条爆款带偏结论）；与时间/形式的关系只表述相关。

**验收（功能验证场景 3）：** 给定样例数据，系统能回答"知识类平均播放是套餐类的 N 倍，且收藏率更高"，并给出**建议动作**，而不是只给排行榜。

### Task 4.2: 矩阵看板页 + 组织下钻

**要点：** 组织树（省→市→门店→账号）下钻；账号列表带活跃状态与断更天数。

---

## Phase 5：录音洞察与反哺选题（差异化命门）

### Task 5.1: 录音导入 + 转写适配层

**Files:**
- Create: `src/server/adapters/asr/index.ts`（接口 + MockAsr + 云端 ASR 实现位）
- Create: `src/server/services/recording/ingest.ts`
- Test: `tests/server/services/recording.test.ts`

**要点：** 验证阶段**不接真实 ASR 也能跑** —— 用样例转写文本（`app-data/samples/transcripts.json`）走通链路，真实 ASR 作为可替换实现。
这与你选的"A 打底 + B 少量真实"策略一致。

### Task 5.2: 需求/异议识别 + TOP 问题榜

**要点：** 主题分类（宽带/5G/套餐/电视/携转）、异议识别（价格/信号/合约/办理条件）、按时间聚合 TOP 问题与环比趋势。

### Task 5.3: 一键问题转选题

**验收（功能验证场景 4）：** 一批录音进来 → 输出"本周客户最关心 TOP5" → 一键生成选题卡片 → 直接进入口播生成。**这条链路打通，就是与普通短视频工具的本质区别。**

---

## Phase 6：经营驾驶舱（聚合，不做花哨大屏）

### Task 6.1: 五问看板

按 PRD §5.7 的五个区域聚合已有数据：总体概览 / 执行情况 / 内容效果 / 录音洞察 / 组织下钻。
**不新增数据源，只做聚合与呈现** —— 一期驾驶舱的价值在于"口径一致"，不在于图表多。

### Task 6.2: AI 经营简报（P1，可后置）

基于真实数据生成"本期变化 + 主要问题 + 建议动作"，**数据缺失时必须明说，不得编造**（PRD §8）。

---

## Phase 7：图文混剪原型（仅原型，功能后置）

> 按你的决定：**先出原型，功能排到后面，有时间再做完整。**

**Files:**
- Create: `src/renderer/src/pages/MixcutPage.tsx`

**要点：** 用**假数据**把"选题 → 一图一句脚本 → 素材位 → 配音位 → 预览 → 确认"的界面流程走通，不接 ffmpeg、不做真实合成。目的是**验证交互与信息结构**，为将来排期提供依据。

**验收：** 能在界面上完整走一遍流程，看得出将来要什么素材、什么参数。

---

## Phase 8：真实账号采集（B 策略，1~3 个账号）

> **这一阶段有合规与风控不确定性，放在最后做，且必须能独立失败而不影响前面全部功能。**

**Files:**
- Create: `src/server/adapters/collector/index.ts`（接口）
- Create: `src/server/adapters/collector/manualImport.ts`（先做：用户手动粘贴/导入主页数据）
- Create: `src/server/adapters/collector/browserCollector.ts`（后做：内嵌浏览器采集）

**顺序建议：**
1. 先做 `manualImport` —— 让"真实账号"的数据能进来，立刻提升诊断说服力，**零风控风险**。
2. 再做 `browserCollector` —— 独立组件，可脱离桌面壳运行（保留信创退路，见"待确认事项"）。

**注意：** 采集能力必须是 `adapters/` 下的一个可替换实现，**业务层不得直接依赖它**。

---

## 完成标志（功能验证成功的定义）

四条同时成立，一期验证即通过（对照 PRD §12 验收标准）：

1. **诊断可信** —— 输入真实账号，报告能指出真实问题，且每条结论可点开看依据。
2. **拿来能拍** —— 从选题到口播稿，营业员不改一个字就能拍。
3. **数据说话** —— 能回答"哪类内容有效、为什么"，并给出建议动作。
4. **录音闭环** —— 录音 → 高频需求 → 选题 → 口播，端到端跑通。

交付物：一个 `release\AI智慧门店-0.1.0-便携版.exe`，双击即用。

---

## 待确认事项（不阻塞开工，但要在对应阶段前定）

| # | 事项 | 影响阶段 | 说明 |
|---|---|---|---|
| 1 | DeepSeek / 方舟 API Key 从哪来 | Phase 2.3 | 走环境变量 `DEEPSEEK_API_KEY` / `ARK_API_KEY`；验证阶段可用你自己的额度 |
| 2 | 真实账号是哪 1~3 个、有无授权 | Phase 8 | 无授权就先只做 manualImport |
| 3 | 记录是否要求信创适配 | Phase 0.5 之后 | 当前架构（业务在云端/本地服务 + 薄壳）已为该退路留口；采集组件独立是最大保险 |
| 4 | 验证给谁看、要演示到什么程度 | 全程 | 决定 UI 打磨度；当前计划按"能用"而非"好看"设计 |

---

## 附：执行注意

- **每个 Task 结束都要提交**，commit message 用 `feat|fix|chore(scope): ...`。
- **测试绝不发真实网络请求**：所有 AI/ASR 调用在测试里必须注入 Fake。
- **测试绝不用真实 `app-data/`**：一律 `mkdtempSync` 临时目录。
- 如果某个 Task 的测试写不出来，说明该模块边界没设计好，**先停下来改设计，别硬写**。
- Phase 之间可以停下来让你验收；Phase 0 和 Phase 2 是最该停下来看的两处。
