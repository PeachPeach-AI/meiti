# 养号页布局修正（左预览 / 右配置+日志）

> 背景：用户反馈养号页「样式是错的」—— 顶部说明类内容不需要；页面应为「左侧预览窗口 / 右侧配置区 + 养号行为日志列表」的纯工具式双栏。
> 方案选择：A（删减保持现有双栏 + 左预览 sticky），已确认删减范围（含「今日要点」整块、右栏四块附加内容全删）。

**Goal:** 养号页进入即见工具区，无说明性内容；左侧浏览预览窗口，右侧配置项 + 开始/停止按钮 + 行为日志列表。

## 删减范围（用户逐项确认）

1. 顶部「说明」文字段（`paneHead` 第 4 参数）—— 删；
2. 顶部「今日要点 · 实时推导」整块 —— 删（引擎 `SSCore.nurturePlan` 保留在核心层不渲染，
   `tests/core/nurture.test.mjs` 7 项测试不动、继续全绿）；
3. 右栏四块附加内容：「运行状态」runstat 卡、风险提示 callout、「账号阶段」、「发布节奏」—— 全删；
4. 右栏最终顺序：配置行（参与账号 / 关键词 / 来源权重 / 推荐页偏好 / 行为节奏）→
   按钮行（开始/停止养号 + 保存配置）→ 「行为日志」标题 + 筛选栏（账号/类型 + 导出 CSV）+ 日志表格 + 底部条数说明。

## 改动明细

- `hot-update/smartstore-desktop.html` `acctNurture()`（512–599 行）：
  - 526 行删 `paneHead` 的说明参数；521–523 行删无引用局部变量 `pct` / `done` / `plan`；527–533 行删今日要点块；
  - 561–572 行删 callout / runstat / 账号阶段 / 发布节奏；
  - 事件绑定 id（`nurToggle` / `nurSave` / `logAcct` / `logType` / `exportLog`）与日志筛选、导出 CSV 功能不变。
- `hot-update/assets/app.css`：
  - 删 545–546 行 `.runstat` 两条规则（全站仅养号页引用，删后无引用）；
  - `.browse`（左预览窗）加 `position: sticky`，`top` 按实际滚动容器取顶栏高度或 12px
    （右栏日志长、下滚时预览保持可见；sticky 不生效时自然回退静态，无副作用）；
  - 其余不动：`.nsplit` 比例 0.85:1.5、1040px 以下单栏响应式。

## 验证

1. `node --test "tests/core/*.test.mjs" "tests/server/*.test.mjs" "tests/render/*.test.mjs"` 回归全绿；
2. 预览地址 `http://127.0.0.1:43999/smartstore-desktop.html` 目检：账号运营中心 → 养号，
   确认无顶部说明、左预览 sticky、右栏只有配置 + 日志。
