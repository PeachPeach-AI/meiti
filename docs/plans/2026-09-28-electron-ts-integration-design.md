# smartstore 原型集成 Electron + TypeScript 设计

## 背景与目标

现有 AI智慧门店 桌面原型为单文件形态（`desktop-shell/static/smartstore-desktop.html` 约 1713 行，内联 ~1600 行视图 JS；`assets/data.js` 515 行样例数据；`assets/app.css`）。Electron 壳为纯 CJS（`desktop-shell/main.cjs`、`preload.cjs`）。

本设计把整个原型集成进 Electron + TypeScript 架构，建立仓库内第一个 TS 化样板（`demo/electron-ts/`），为 09-23 正式迁移（electron-vite + React + TS）铺路。

## 集成深度（已确认）

**TS 壳 + 数据层 TS 化**：

- `main.ts` / `preload.ts`：严格 TS 重写
- `data.js` → `data.ts`：迁移为带实体接口的类型化模块
- HTML 内联的 ~1600 行视图 JS：**不动、不查**（明确边界；全量 TS 化属 09-23 正式迁移范围）

## 必须保持的兼容契约

视图层对 TS 侧有两个逐字依赖，迁移中不得变更：

1. `data.js` 仅暴露一个全局：`window.SS = { orgs, stores, employees, accounts, works, contentTypes, topics, recordings, objections, dashboard, diagnoses, script, mixcut, viral, comments, leads, nurture, recAssets, complaints, opportunities, recDevice, insights, fmt, fmtK, dt }`，视图 JS 全部经 `window.SS` 取数
2. `preload` 暴露 `window.desktopWindow.control(action: 'minimize' | 'toggle-maximize' | 'close')` → IPC `window-control`

## 目录结构

```
demo/electron-ts/
├── package.json            # main: dist/electron/main.js
├── tsconfig.json           # strict 全开
├── scripts/sync-public.mjs # 组装 dist/renderer/（纯 node，无子进程）
├── electron/
│   ├── main.ts             # 建窗口 + window-control IPC + 加载原型页
│   └── preload.ts          # desktopWindow.control（契约一致）
├── data/
│   ├── entities.ts         # 22 类实体 + SS 的 interface（严格 TS，新写）
│   └── data.ts             # data.js 迁移：IIFE + window.SS 契约不变，标注类型
└── types/global.d.ts       # Window.SS / Window.desktopWindow 全局声明
```

## 构建与单一事实来源

- `build = tsc && node scripts/sync-public.mjs`
- sync 脚本从 `desktop-shell/static/`（原型正本）复制 `smartstore-desktop.html` + `assets/app.css` 至 `dist/renderer/`，并把 `dist/data/data.js` 归位为 `dist/renderer/assets/data.js`
- 原型 HTML/CSS 永远取自仓库正本，demo 不产生第二份漂移副本
- electron ^44.4.5 安装于 demo 内（`--ignore-scripts` + `node install.js`，走项目内 `.electron-cache` 暖缓存；沙箱内 npm 脚本 spawn 受限的既定规避方案）
- 刻意不使用 electron-vite/esbuild（子进程管道在沙箱内受限）；纯 tsc 可完整构建验证

## TS 策略

| 代码 | strict |
|---|---|
| `electron/*.ts`、`data/entities.ts` | 全严格 |
| `data/data.ts` | 严格开启；样例逐个标 `Entity[]`，缺失字段按 PRD「缺失即 null」口径用可选属性如实建模 |
| HTML 内联视图 JS | 不检查 |

## 安全口径（对齐 desktop-shell）

`contextIsolation: true`、`nodeIntegration: false`、`setWindowOpenHandler` 拒绝新窗口、无边框窗口 + 自绘标题栏控制。

## 运行边界

demo 加载自身 `dist/renderer/smartstore-desktop.html`，不接 `hot-update` 目录（热更新仍是 desktop-shell 职责）。拉起窗口需用户双击 `demo.lnk`（DSH 沙箱对代理进程树的命名管道限制，已实测）；代理负责构建、验证与快捷方式生成。

## 验收标准

1. `tsc --noEmit`（strict）通过
2. 构建产物齐全：`dist/electron/{main,preload}.js` + `dist/renderer/{smartstore-desktop.html, assets/app.css, assets/data.js}`
3. 契约等价硬验证：node 脚本分别执行旧 `data.js` 与新编译产物，比对 `window.SS` 键集合、各集合长度、首元素 JSON 逐字段一致
4. 用户双击 `demo.lnk`：六中心原型完整可用、无边框窗口控制按钮生效
5. 代码与设计文档入 git（demo 子目录自带 .gitignore，不改根 .gitignore）
