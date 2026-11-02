# 原型高密度工具风改版设计

## 背景

用户对 `hot-update/` 原型（smartstore-desktop.html + assets/app.css 651 行 + assets/data.js）的反馈：整体页面风格要紧凑，走工具风，不要花里胡哨，尤其是账号运营中心与 AI 内容运营中心。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 装饰件处理 | DOM 不动，只调视觉密度（浏览器假窗体、仿抖音信息流等保留但弱化） |
| 密度基线 | 高密度工具风：基准 13px、表格行高约 30px、卡片内边距 10–12px、大标题降为 15.5px |
| 视觉气质 | 冷灰工具色：状态色降饱和、去投影、圆角收到 4px、渐变背景换素色；状态色（绿/黄/红）保留但变淡 |
| 实现路径 | 方案 A：直接改 `hot-update/assets/app.css`（token 层 + 组件规则），不加覆盖层、不改 HTML |

## 改动范围

仅 `hot-update/assets/app.css`。不改 HTML/DOM、不改 data.js、不改任何 JS 交互逻辑，不删信息块。

### Token 层（:root）

| 变量 | 现值 | 改为 |
|---|---|---|
| `--radius` | 7px | 4px |
| `--radius-sm` | 5px | 3px |
| `--shadow-pop` | 大投影 | `0 1px 4px oklch(0.23 0.02 255 / 0.10)` 级别的弱投影，配描边保持浮层分层感 |
| success / warn / danger | chroma 0.11–0.19 | 各降约 1/3，色相不变 |
| `--accent` | oklch 蓝 | 不动（唯一强调色） |
| 字体栈 / 背景色 | — | 不动 |

### 密度规则（before → after）

| 规则 | 现值 | 改为 |
|---|---|---|
| `.sect` 内边距 | 20px 26px | 12px 16px |
| `.whead .ht h1` / `.doc-title` | 19px / 20px | 15.5px |
| `.metric .v` / `.metrics` gap | 21px / 34px | 16px / 22px |
| `table.tb th` / `td` 内边距 | 8px 14px / 10px 14px | 5px 10px / 6px 10px（行高≈30px） |
| `.tag` | 高 21px · 11.5px | 高 18px · 10.5px |
| `.btn` | 常规约 34px | 30px（sm/lg 同步 −3px） |
| `.callout` 内边距 / `.chips` gap / `.item` 行距 | 11px 13px / 6px / — | 各收 2–4px |
| sheet / popover 内边距 | — | 同步收紧一档 |

### 去花哨（纯 CSS 可达）

- 每日推荐页：`.daily-bg` 渐变背景 → 素色；`.dcard` 圆角 12→4、去投影、内文字号降档
- 采集页浏览器假窗体：`.bw-dots` 三圆点灰化为中性色、`.connected-canvas` 空态弱化
- 养号页信息流：`.vthumb` 缩略图降饱和、`.vcard` 紧凑化、命中标签变小
- rail / titlebar / statusbar：仅随全局字号微调

### 边界

- 提词器字号体系不动（PM.size 由 JS 控制，拍摄场景需要大字）
- `.collector-workbench` 三栏结构与可拖拽逻辑不动

## 验收标准

1. 硬指标抽查：h1 = 15.5px、`.sect` padding = 12px 16px、`.tag` 高 18px、表格行高 ≈ 30px
2. 用户在预览地址（临时静态服务，Ctrl+R 重载）逐中心目检六中心 + 采集/养号两个重点页 + 提词器/弹层不受影响
3. git 单独一次提交，可整体回退
