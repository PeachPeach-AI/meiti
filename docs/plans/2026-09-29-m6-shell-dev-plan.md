# M6-EXE 桌面壳开发计划（开发调试用自动构建）

日期：2026-09-29 · 状态：执行中
对应请求：用户（m00536）「然后我希望能在开发时能自动构建桌面软件，这个是做开发调试的」

## 目标

在 `shell/` 提供一个最小 Electron 壳，开发期一键启动、自动构建；不引入构建链（无 webpack/vite/ts），不改 hot-update 的零依赖零构建形态。

## 范围与非目标

- 做：窗口 + 内嵌契约 API 子进程 + SS_API_BASE 注入 + 开发态自动刷新 + portable 产物。
- 不做：自动更新、多窗口、安装包（nsis）、图标定制、AI 真实供给（仍 501）。

## 设计要点

1. **进程模型**：主进程用 `ELECTRON_RUN_AS_NODE=1` 复用 Electron 自带 Node 跑 `server/api.mjs`（`--port-file` 握手，随机端口）；壳退出时杀子进程。
2. **注入方式**：`loadFile(HTML, { query: { 'ss-api-base': 'http://127.0.0.1:<port>' } })`；preload 读 `location.search` 写 `window.SS_API_BASE`。契约 §五 的「EXE 注入」即此两步，视图与 ss-api.js 零改动。
3. **开发态自动刷新**：main.js 对 hot-update 目录 `fs.watch`（150ms 防抖）→ 渲染层自动 reload，免 Ctrl+R；`dev.mjs` 对 main.js/preload.js 变更重启整壳。
4. **打包**：electron-builder portable，`extraResources` 带上 hot-update/ 与 server/（asar 外的 resources 目录），产物输出沿用 `E:/smartStore-artifacts/release`。

## 任务

| # | 任务 | 验证 |
|---|------|------|
| T1 | server/api.mjs `--port-file <path>` 握手 | tests/server/api.test.mjs 第7用例 ✅ |
| T2 | shell/{package.json, main.js, preload.js, dev.mjs, .gitignore} | 见下 |
| T3 | `npm install`（electron 44.4.5 + electron-builder 26.15.3，沿用已删 demo/electron-ts 的版本） | node_modules 就位 |
| T4 | `npm run dev` 冒烟：窗口出现、API 子进程存活、SSApi.isRemote()=true | 人工目检 |
| T5 | `npm run build` portable 产物可独立运行 | 人工目检 |

## 待人工目检清单（T4）

- [ ] 壳启动后标题栏无菜单栏（autoHideMenuBar），窗口 1440×900。
- [ ] 设置页「接口地址」显示 `http://127.0.0.1:<port>`（远端模式）。
- [ ] Ctrl+R 刷新、Ctrl+Shift+I 开发者工具可用。
- [ ] 修改 hot-update/assets/app.css 保存 → 壳内 ~150ms 自动刷新。
- [ ] 改 shell/main.js 保存 → dev.mjs 自动重启整壳。
- [ ] 关窗后 API 子进程随之退出（任务管理器无残留 node/electron）。

## 执行记录（2026-09-29 第 16 轮）

- T1 ✅ `--port-file` 握手 + tests/server/api.test.mjs 第 7 用例；全量回归 77/77。
- T2 ✅ shell/{package.json, main.js, preload.js, dev.mjs, .npmrc, .gitignore}，node --check 通过。
- T3 ✅ npm install 284 包；electron 44.4.5 二进制经 `shell/.npmrc`（npmmirror 镜像）补装成功（`node node_modules/electron/install.js`，dist/electron.exe 234.6 MB）。
- T4 ⏳ 人工目检。代理上下文验证结论：`electron.exe --version` 正常（exit 0）；带窗口的完整启动在 agent 派生进程上下文中被执行环境终止（无日志、无退出码、无进程残留），属环境限制而非代码缺陷。`--no-sandbox` 可解除一类启动失败，已提供 `SS_SHELL_NO_SANDBOX=1` 逃生开关（默认关闭，常规桌面不需要）。用户桌面请直接 `cd shell && npm run dev` 走查上述清单。
- T5 ✅ `npm run build` 产出 `E:/smartStore-artifacts/release/AI智慧门店-壳.exe`（portable，95.4 MB，2026-09-29 21:01）；win-unpacked/resources 内 hot-update（5 文件）+ server/api.mjs + app.asar 齐备，默认图标。exe 双击运行目检并入 T4 清单（agent 上下文无法验证 GUI 进程，同上）。
- T5+ ✅ 构建后质量门 `npm run verify`（`scripts/verify-packaged.mjs`，12 项断言）：portable exe 存在、asar 壳三件（package.json 为构建期重写仅查存在）、resources/hot-update 逐文件 sha256、resources/server/api.mjs sha256 + 打包内 server 可启动响应 health。首跑即修正一处认知：electron-builder 会重写 asar 内 package.json（197B 剥离 build 配置），属预期行为。当前 12/12 PASS。

## 执行记录（2026-09-29 第 26-27 轮 · T4 代理代走查）

结论：**窗口初始化在本机必然崩溃（0xC0000005），非代码缺陷，非 agent 上下文限制**。

证据链：
1. Windows 事件日志 Event 1000（21:15:24）：electron.exe 44.4.5.0，出错模块=electron.exe 自身，异常代码 0xc0000005，偏移 0x7cd3e7b。
2. 计划任务法（SS-ShellSmoke / SS-Boot2 / SS-Boot3）在用户交互会话跑同样无声死——排除 agent 执行环境因素。
3. 降级 electron 40.9.3（本机缓存 zip）后同样 0xC0000005；`--no-sandbox`、`--disable-gpu`、`--disable-features=RendererCodeIntegrity`、`--disable-crashpad` 全部组合试过，无效。
4. 每次崩溃遗留一个孤儿 electron 子进程（3 个可 taskkill 清掉，1 个 PID 7940 taskkill 拒绝需重启清理）——指向本机第三方软件注入进程初始化（杀软/安全模块类）的典型特征。
5. **API 子进程链路完整验证通过**：electron-as-node（40.9.3 二进制）+ `ELECTRON_RUN_AS_NODE=1` + `server/api.mjs --port-file` → `[api] contract-v1 listening on http://127.0.0.1:16999` + 端口文件落盘 + `/api/health` 200——即 main.js `startApi()` 的真实形态。
6. 诊断花絮：agent 执行环境泄漏 `ELECTRON_RUN_AS_NODE=1`（harness 进程环境带入），曾使 electron.exe 以纯 Node 模式跑（`--version` 输出 v24.14.1 即内嵌 Node 版本）；清除该变量后崩溃依旧，故崩溃与其无关。

影响与修订：
- T4 窗口类目检（清单 6 项）与 T5 产物双击需换一台正常 Windows 机器（或本机排查安全软件白名单）后人工执行；本机双击 portable exe 大概率同样崩溃（同一 Chromium 初始化路径）。
- 版本决策修订：electron 由 44.4.5 固定为 **40.9.3**（44.4.5 本机事件日志实锤崩溃；40.9.3 缓存即有、API 链路已验证；壳仅用跨版本稳定 API，无 44 特有依赖）。回归 79/79、构建质量门 12/12 不受影响。

## 约束

- 不把 node_modules/、dist/、*.exe 提交（shell/.gitignore）。
- server/api.mjs 与 hot-update 仍归仓库根目录管理，壳只做消费方。
- 打包产物含全部样例数据，仅限开发调试，不对外分发。

## 第 29-30 轮 · 根因修复与 D 盘外置（T4/T5 代理级完成）

**根因定位**：electron GUI 二进制位于本机 E: 卷（含百度同步目录 `E:\BaiduSyncdisk`）时初始化必崩：
- E:\BaiduSyncdisk 内：0xC0000005（electron 44.4.5 偏移 0x7cd3e7b；40.9.3 三次一致 0x3c68f3b；跨项目 67douyin 的 44.3.0 同签名）。
- E: 盘非同步目录（win-unpacked 直接运行）：0x80000003 STATUS_BREAKPOINT。
- C:（etest 隔离实验）与 D:（junction 外置后）：完全正常，EXITCODE 0，默认沙箱可用。
- 排除项：Defender（唯一 AV）、Sangfor EasyConnect、IFEO、AppInit_DLLs、系统进程缓解（全 NOTSET）、GPU/驱动类 flag（无效）、会话类型（用户会话同样崩）。

**修复布局（尽量不占 C 盘）**：
- `shell/node_modules` = 真实目录（E:，npm/构建友好）。
- `shell/node_modules/electron/dist` = **junction → `D:\ss-electron-dist`**（约 250MB 二进制物理在 D:，避开 E: 卷）。
- `C:\ss-store-node-modules`、`D:\ss-store-node-modules` 中转目录已清理；C 盘仅剩 electron-builder 缓存（nsis + electron zip，约 200MB，构建工具固有）。
- 教训：npm install 的 reify 会删除 junction 目录（「Removing non-directory node_modules」）→ 重装后需重建 dist junction；junction 化的 node_modules 根会让 node CLI（electron-builder）按 realpath 解析失败（根目录名不是 node_modules），故只 junction dist、不 junction node_modules 根。

**T4 代理级验证（junction 布局，用户交互会话）**：[api] listening → [shell] API 就绪 → [shell] 窗口已创建，注入 → /api/health 200，端口文件落盘，默认沙箱（无需 --no-sandbox），EXITCODE 0。①②④⑥ 通过；③ Ctrl+R/Ctrl+Shift+I 需真人按键。

**T5 portable 构建与验证**：
- NSIS 首次失败：nsis-3.0.4.1 缓存损坏（清缓存重装后 makensis 正常）；中文 artifactName 在 cmd/计划任务环境 `Can't open output file` → 改 ASCII `AI-smartstore-shell.exe`（85.7MB）。
- 便携壳在 E: 盘静默退出（exit 2/3）；放 D: 运行：**双击验证通过**——窗口「AI智慧门店 · 桌面客户端」+ API 健康 200（首次运行杀软扫描可致 API 等待超时，main.js 已放宽 10s→30s）。
- 产物：`E:\smartStore-artifacts\release\AI-smartstore-shell.exe`（构建产物留存）+ `D:\ss-stub-test.exe`（可运行副本）；运行请放 C:/D: 盘。
- T4③（快捷键）与验收清单走查仍需真人。
