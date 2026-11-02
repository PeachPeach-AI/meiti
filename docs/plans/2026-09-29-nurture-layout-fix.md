# 养号页布局修正 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 养号页改为纯工具式双栏 —— 删掉顶部「说明」与「今日要点 · 实时推导」整块、右栏四块附加卡（运行状态/风险提示/账号阶段/发布节奏），页面进入即见「左预览窗口 / 右配置 + 行为日志」，左预览 sticky 跟随。

**Architecture:** 纯删减式 UI 修正。只动 `acctNurture()` 渲染函数（删模板串与三个无引用局部变量）和 `app.css`（删失效 `.runstat`、`.browse` 加 sticky）。引擎 `SSCore.nurturePlan` 与 `tests/core/nurture.test.mjs` 不动（UI 不再渲染，测试继续全绿）。设计依据：`docs/plans/2026-09-29-nurture-layout-fix-design.md`（已确认，commit 9cfbc0d）。

**Tech Stack:** 原型单文件渲染（`hot-update/smartstore-desktop.html` 内联 JS 字符串模板）+ `hot-update/assets/app.css`；测试 `node --test`（core/server/render 三套，render 冒烟测试会真实执行 HTML 内联脚本，即语法安全网）；预览 `node server/preview.mjs`（默认 http://127.0.0.1:43999/smartstore-desktop.html）。

**执行方式：** 在本仓库 master 直接执行（沿用 `docs/plans/` 既有约定，无 worktree）。本次为删减+样式微调，无新测试；render 冒烟测试（遍历含 nurture 在内全部页签渲染）是回归安全网。

---

### Task 1: HTML 删减 —— 顶部两块 + 右栏四块

**Files:**
- Modify: `hot-update/smartstore-desktop.html:521-534`（顶部：变量 + paneHead 说明 + 今日要点块）
- Modify: `hot-update/smartstore-desktop.html:561-573`（右栏：callout/runstat/账号阶段/发布节奏）

**Step 1: 删顶部「说明」与「今日要点」块**

用 edit 工具，`old_string` → `new_string`（`acctNurture()` 内，521–534 行）：

old_string:
```js
    var pct = Math.round(n.day / n.target * 100);
    var done = run ? 3 : 0;
    var plan = SSCore.nurturePlan(D.accounts, SSCore.analyzeRecordings(D.transcripts), n); /* 引擎实时推导 */
    return paneHead('养号 · ' + n.stage + ' · 第 ' + n.day + ' / ' + n.target + ' 天', '养号',
        '<span class="tag ' + (run ? 'green' : 'outline') + '">' + (run ? '运行中' : '未运行') + '</span>',
        '<b>说明</b>养号由本机按配置自动浏览推荐流，并按规则点赞 / 收藏；一期只做「看视频 + 点赞 + 收藏」，不评论、不关注、不私信。')
      + '<div class="sect" data-od-id="nurture-plan"><div class="lbl">今日要点 · 实时推导</div>'
      + plan.actions.map(function (x) { return remind(x.icon, x.title, x.text, '', ''); }).join('')
      + (plan.keywordGaps.length
          ? '<div style="margin-top:10px"><span class="tag amber">关键词覆盖 ' + plan.coverage + '%</span>'
            + plan.keywordGaps.map(function (g) { return '<span class="tag outline" style="margin-left:6px">缺口：' + g.q + '</span>'; }).join('') + '</div>'
          : '')
      + '<p class="muted" style="font-size:11px;margin-top:8px">' + plan.notes + '</p></div>'
      + '<div class="sect" data-od-id="nurture-main"><div class="nsplit">'
```

new_string:
```js
    return paneHead('养号 · ' + n.stage + ' · 第 ' + n.day + ' / ' + n.target + ' 天', '养号',
        '<span class="tag ' + (run ? 'green' : 'outline') + '">' + (run ? '运行中' : '未运行') + '</span>')
      + '<div class="sect" data-od-id="nurture-main"><div class="nsplit">'
```

（同时删掉无引用的 `pct` / `done` / `plan` 三个局部变量；`paneHead` 的第 4 参数整体移除，`paneHead` 函数本身 600–605 行不动，其它页还在传 note。）

**Step 2: 删右栏四块附加内容**

old_string（561–573 行，紧跟在 `nurSave` 按钮行之后）:
```js
      + '<div class="callout warn" style="margin-top:20px">' + icon('warn') + '<div>点赞 / 收藏会改变平台上的状态，可能违反平台条款导致限流或封禁；遇到验证码会立刻停止，不做绕过。</div></div>'
      + '<div class="runstat" style="margin-top:14px"><div class="lbl" style="margin:0">运行状态</div>'
      + '<div class="big">' + n.run.task + ' · 第 ' + n.run.round + ' 轮 ' + done + ' / ' + n.run.total + '</div>'
      + '<div class="muted" style="font-size:12px">选择目标：' + n.run.target + '</div>'
      + '<div style="margin-top:14px"><span class="meter ' + (run ? 'green' : '') + '"><i style="width:' + (done ? Math.round(done / n.run.total * 100) : 0) + '%"></i></span></div>'
      + '<p class="muted" style="font-size:11px;margin-top:12px">状态由主进程持有，这里只读展示：轮次 / 正在看什么 / 距下次休息。</p></div>'
      + '<div class="grp">账号阶段</div>'
      + kv('当前阶段', n.stage)
      + kv('进度', n.day + ' / ' + n.target + ' 天')
      + '<div style="margin-top:8px"><span class="meter green"><i style="width:' + pct + '%"></i></span></div>'
      + '<div class="grp">发布节奏</div>'
      + kv('建议频率', n.rate)
      + '<div class="grp" data-od-id="nurture-log" style="margin-top:20px">行为日志</div>'
```

new_string:
```js
      + '<div class="grp" data-od-id="nurture-log" style="margin-top:20px">行为日志</div>'
```

右栏最终结构：配置行（参与账号 / 关键词 / 来源权重 / 推荐页偏好 / 行为节奏）→ 按钮行（`nurToggle` / `nurSave`）→ 「行为日志」标题 + `logbar` 筛选（`logAcct` / `logType` / `exportLog`）+ 日志表格 + 底部条数说明。事件绑定 id 全部不变，不需要动事件区。

**Step 3: 回归测试**

Run: `node --test "tests/core/*.test.mjs" "tests/server/*.test.mjs" "tests/render/*.test.mjs"`
Expected: 全绿（基线 76/76：core 63 + server 6 + render 7）。render 冒烟会执行改后的内联 JS —— 若 Step 1/2 改坏语法会在这里报错。

**Step 4: Commit**

```bash
git add hot-update/smartstore-desktop.html
git commit -m "style(nurture): 养号页删顶部说明/今日要点与右栏附加卡（纯工具双栏）"
```

---

### Task 2: CSS —— 删失效 .runstat + 左预览 sticky

**Files:**
- Modify: `hot-update/assets/app.css:520`（.browse 加 sticky）
- Modify: `hot-update/assets/app.css:545-546`（删 .runstat 两条规则）

**Step 1: .browse 加 sticky**

old_string:
```css
.browse { border: 1px solid var(--border); border-radius: 5px; background: var(--surface-2); overflow: hidden; }
```

new_string:
```css
.browse { position: sticky; top: 12px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-2); overflow: hidden; }
```

（滚动容器是 `.work`，`app.css:151` `overflow-y: auto`；`.nsplit` 已有 `align-items: start`，sticky 可生效。若目检发现不跟随，属无害回退，可调 `top` 值或去掉该属性。）

**Step 2: 删 .runstat 规则**

old_string:
```css
.runstat { border: 1px solid var(--border); border-radius: 5px; background: var(--surface-2); padding: 10px 12px; }
.runstat .big { font-size: 14px; font-weight: 600; letter-spacing: -0.02em; margin: 4px 0 3px; }
```

new_string: （空，整段删除。Task 1 已移除唯一引用点，全站无 `.runstat` 使用。）

**Step 3: 回归测试**

Run: `node --test "tests/core/*.test.mjs" "tests/server/*.test.mjs" "tests/render/*.test.mjs"`
Expected: 全绿，与 Task 1 后一致。

**Step 4: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(nurture): 清理失效 .runstat 样式，左预览 sticky"
```

---

### Task 3: 目检验收

**Step 1: 起预览服务**

Run: `node server/preview.mjs`
Expected: `[preview] http://127.0.0.1:43999/smartstore-desktop.html`（若 43999 被占用，服务已在跑，直接用现地址；改动是静态文件，浏览器 Ctrl+R 强刷即可）。

**Step 2: 用户目检**（验收清单，对应设计文档）

- 养号页进入即见工具区：无「说明」段、无「今日要点 · 实时推导」块；
- 页头保留「养号 · 初期 · 第 x / y 天」+ 运行中/未运行 tag；
- 左侧浏览预览窗（bw-bar 地址栏 + 信息流卡片），右栏滚动日志时预览窗 sticky 跟随；
- 右栏只有：配置行 → 开始/停止养号 + 保存配置按钮 → 行为日志（筛选 + 导出 CSV + 表格）；
- 日志筛选（账号/类型）与导出 CSV 仍工作，开始/停止养号按钮仍工作。

**Step 3: 有微调则改后重跑 Step 回归并追加 commit；无微调则结束。**

---

## 执行记录（2026-09-29）

**Task 1（HTML 删减）：完成。** 两处 edit 与计划 old/new 逐字一致应用；回归 `node --test "tests/core/*.test.mjs" "tests/server/*.test.mjs" "tests/render/*.test.mjs"` 全绿 **79/79**（计划写基线 76/76，实测 79 —— 本次改动未增删测试，76→79 差异来自此前提交间的测试数漂移），0 失败，render 冒烟确认改后内联脚本可执行。

**Task 2（CSS）：完成。** `.browse` 加 `position: sticky; top: 12px`、删除 `.runstat` 两条规则，均逐字一致。未重跑回归：测试不加载 app.css，Task 1 后的 79/79 已覆盖全部可测路径。

**Task 1 Step 4 / Task 2 Step 4（commit）：作废，不执行。** 实际执行时发现 `hot-update/` 整目录在 `.gitignore:14`（注释明确「本地热更新载荷（EXE 从该固定路径读取，机器本地开发通道，非源码）」），且 `git log --all -- hot-update` 为空（从未入库）。改动直接落盘即生效（EXE 读该固定路径），不做 `git add -f` 破坏仓库约定。

**Task 3（验证）：HTTP 层已过；用户已于 2026-09-30 在桌面壳内目检验收通过（闭环）。** `node server/preview.mjs` 起于 43999；`GET /smartstore-desktop.html` 200（hasNurtureLog=True、hasRunstat=False），`GET /assets/app.css` 200（.browse 含 position: sticky、无 .runstat）。

**环境注：** pwsh 沙箱禁止带管道 stdio 的子进程，`node --test`（内部 spawn 测试文件）全部 `spawn EPERM`；需按一次 `sandbox_permissions: danger-full-access` 重试同一命令（用户批准后 79/79）。

**附录：agent 侧拉起桌面壳（GUI 目检通道，2026-09-30 验证可行）** —— 沙箱会话直接 `npm start` 必失败：① harness 环境注入 `ELECTRON_RUN_AS_NODE=1`，electron 以纯 node 执行 main.js 即崩（`app.commandLine` undefined，err.log 可见栈）；② 沙箱作业对象限制使 Chromium 子进程无法初始化（静默退出、out/err 全空、旧实例无法 taskkill）。可行路径：在 `danger-full-access` 的 pwsh 会话内清除 `$env:ELECTRON_RUN_AS_NODE`、设 `SS_SHELL_NO_SANDBOX=1`、`TEMP/TMP` 指向可写目录，`Start-Process electron.exe . --user-data-dir=<C盘可写目录>`（WorkingDirectory=shell/）→ 主进程带 MainWindowTitle「AI智慧门店 · 桌面客户端」，API 就绪、hot-update 自动刷新生效。dev 模式直读仓库 hot-update，改动即所见；打包版不含新改动（extraResources 构建时快照，需重新 build）。

---

## 追加执行记录（2026-09-30，验收后两处微调）

**微调 1：去掉页头剩余文案（用户：养号 · 成长期 · 第 12 / 30 天 养号 去掉）。** 删除 `acctNurture()` 内 `paneHead(...)` 整行调用（原 521–523 行），`return` 直接以 `'<div class="sect" data-od-id="nurture-main"><div class="nsplit">'` 开头。运行状态仍可见：预览栏地址条自带「正在浏览/未运行」tag，右栏开始/停止按钮即状态。`paneHead` 函数本体不动（账号管理/线索跟进/组织页仍用）。

**微调 2：左右两栏分隔线可拖拽调宽（用户：两个区域中间的线可以左右拖动，改变区域大小）。** 复用采集页 `collectorSplitter` 的成熟模式，零新组件：

- HTML（`acctNurture()`）：`.browse` 与右栏 `<div>` 之间插入 `<div class="collector-splitter" id="nurtureSplitter" role="separator" aria-orientation="vertical" title="拖拽调整区域大小"><i></i></div>`；
- JS（bind 区，紧跟 `#collectorSplitter` 块之后）：`#nurtureSplitter` pointerdown → `setPointerCapture` → pointermove 把 `ev.clientX - box.left` 钳制为 `--nsplit-left` 写到 `.nsplit`（左栏下限 300px、右栏保底 `box.width - 460`，460 = 右栏 430 + 两条 16px gap）→ pointerup/cancel 解绑。不持久化，与采集页行为一致（重渲染回到默认比例）；
- CSS（app.css:519）：`.nsplit` 改 `grid-template-columns: var(--nsplit-left, minmax(0, 0.85fr)) 9px minmax(0, 1fr)`（拖过变 px 定宽，右栏吃剩余），新增 `.nsplit > .collector-splitter { flex: none; align-self: stretch; }`（网格内撑满高度，flex-basis 失效由轨道 9px 定宽，负 margin 保留 hover 热区）；≤1040px 单栏媒体查询内追加 `.nsplit > .collector-splitter { display: none; }`。

**回归：** 同命令 `node --test` 三套 **79/79 全绿**（danger-full-access 重试）。改动落盘 hot-update 即生效，dev 壳 fs.watch 自动刷新，待用户目检。

**微调 3：去掉页内假标题栏，只留桌面壳原生标题（用户：顶部 2 个 title 区域只留一个）。** Electron 壳 `BrowserWindow` 未设 `frame: false`（shell/main.js:53-60），原生标题栏一直在（文案来自页面 `<title>`「AI智慧门店 · 桌面客户端」，保留不动）；页内又画了一条假 `.titlebar`（品牌字 + 玄武营业厅 + 拖拽区 + 最小化/最大化/关闭按钮），纯重复。处理：

- HTML（smartstore-desktop.html:16-21）：整块删除 `<div class="titlebar">…</div>`；
- CSS：`.win` 行模板 `30px minmax(0,1fr) 24px` → `minmax(0,1fr) 24px`；删 `.titlebar`/`.titlebar b`/`.titlebar .org`/`.titlebar .drag`/`.wctrl` 及其 button 规则；`.rail` `grid-row: 2/4` → `1/3`（顶到窗口左上）；`.content` `grid-row: 2` → `1`；`.statusbar` `grid-row: 3` → `2`；
- JS 无改：html:1806 的 `[data-win]` 绑定对空 NodeList forEach 为 no-op；preload 的 `desktopWindow` API 不再被引用，保留无害；
- 代价：浏览器预览（无原生标题栏）失去假窗口控制钮/拖拽区 —— 仅 dev 预览受影响，壳内不受影响。

**回归：** 同命令三套 **79/79 全绿**。

**微调 4：内容推荐页卡片放大自适应（用户：页面太空旷，中间区域要放大、随屏幕自适应）。** 仅 CSS（hot-update/assets/app.css）：`.daily` 列宽 `max-width: 800px` → `min(1200px, 92%)`、内边距 `18px 20px 28px` → `18px clamp(20px, 4vw, 56px) 28px`；卡片排版随视口流式缩放 —— `.daily-head h1` clamp(17,1.3vw,21)px、`.dc-body` padding clamp、`.dc-title` clamp(16,1.5vw,22)px、`.dc-sub` clamp(12,1.05vw,14)px、`.dc-hook > p` clamp(13.5,1.1vw,16)px、`.dc-say > p` clamp(12.5,1vw,14.5)px。窄屏取下限＝原观感，宽屏撑满 92% 封顶 1200px。CSS 不参与测试，未重跑回归；落盘 dev 壳自动刷新。

**微调 5：账号内容采集页撑满窗口高度（用户：底部空了，要随窗口高度自适应）。** 根因：高度链 `.stage(定高, grid minmax(0,1fr)) → .work(data-od-id="account-video-pane") → .collector-workbench` 在 `.work` 断掉 —— .work 由 `stage.innerHTML` 注入、`height:auto`，其内 `height:100%` 与 flex 拉伸全部解析失败，工作台只剩 `min-height:520px`，窗口越高底部留白越大。修复（app.css，紧跟 .collector-workbench 规则）：`.work[data-od-id="account-video-pane"] { display:flex; flex-direction:column; height:100%; }` + 其内 `.collector-workbench { flex:1 1 auto; min-height:0; }`。首版漏了 `.work` 的 `height:100%`（flex 加在 auto 高父级上无效），用户反馈未解决后补上 —— 高度链每一环都必须定高。工作台内部本来就弹性（`.collect-accounts/.schedule-config` flex:none，`.collect-results` flex:1 1 auto，`.result-table` flex:1 overflow:auto；左 `.connected-canvas` flex:1），拉满后结果表格区吃剩余高度、超长内部滚动。仅 CSS 未重跑回归。

## 追加执行记录（2026-09-30 下午）· 微调6

- 反馈：内容推荐页口播素材正文太短，撑不起卡片上的时长标注。
- 修复：hot-update/assets/data.js topics 的 12 条 say 全部扩写（痛点开场 → 具体展开 2~3 点 → 收尾互动 CTA），字数与各条 duration 标注匹配，遵守每条 risk 合规备注（不承诺、不引用具体资费、结论加「以当期政策/合约条款为准」）。backup/head-data.js 为备份，未同步。
- 验证：node --check data.js 语法 OK；回归 79/79 全绿（danger-full-access）。
- hot-update 不入库，落盘即生效（dev 壳 fs.watch 自动刷新）。

## 追加执行记录（2026-09-30 下午）· 微调7

- 反馈：内容推荐页正文卡片贴顶显示，下方大片空白，要上下居中。
- 修复：app.css .daily 增加 min-height:100% + display:flex/column + justify-content: safe center（safe 保证小窗口内容超高时不被裁切、回退顶对齐）；水平居中原有 max-width+margin auto 已满足。
- CSS 不入测试覆盖，落盘即生效（dev 壳 fs.watch 自动刷新）。

## 追加执行记录（2026-09-30 下午）· 微调8

- 反馈：口播素材「一键生成」封面后没有预览，也无法下载/重生成。
- 实现（smartstore-desktop.html）：新增 renderCoverImage() 本地 canvas 规则版封面生成（900x1200 3:4，3 套配色版式随 covIx 轮换，含店名眉、封面文案大标题自动折行、首标签、时长脚注）；scriptCols/fakeCols 两处「封面文案」行下新增封面预览块（img + 下载封面 + 重新生成）；state.coverImg={key,url} 存 dataURL，render 后按 key 回填预览。下载用 a[download] 存 PNG。
- 验证：回归 79/79 全绿（danger-full-access）。

## 追加执行记录（2026-09-30 晚）· 微调9

- 反馈：生成的封面图排版紧、行距不够、标题出现孤字（单字成行）。
- 修复（renderCoverImage）：标题字号按长度分档（≤12 字 82px / ≤20 字 68px / 其余 58px），行距改为 1.62 倍字号并按行数垂直居中；换行加末尾前瞻，剩余 1~2 字时并入上一行，消除孤字。
- 验证：回归 79/79 全绿。

## 追加执行记录（2026-09-30 晚）· 微调10

- 反馈：口播素材右栏字号/层级/颜色无规范，层级不清看着不舒服。
- 修复（app.css 新增 .col-s 作用域字阶，不影响其它页）：组标题（发布物料/转化/拍摄建议）13.5px/700/主色、分隔线上下距拉开（22/14）；字段标签（封面文案/发布文案/标签）11px/600/muted + 0.04em 字距；正文/拍摄建议 13px/1.75 行高/主色；发布文案 12.5px/1.8 弱主色。三级层级清晰：组标题 > 标签 > 正文。
- 验证：render 冒烟 7/7 通过。

## 追加执行记录（2026-09-30 晚）· 微调11

- 反馈：「转化」「拍摄建议」板块放右栏不合理，移到左栏。
- 修复（smartstore-desktop.html）：scriptCols 将 转化/获客 CTA + 拍摄建议 移到左栏（口播稿操作按钮之后）；fakeCols 将 转化/获客 CTA 同步移到左栏。右栏（.col-s）只留发布物料：封面文案（含预览/下载/重生成）、发布文案、标签。
- 验证：回归 79/79 全绿。

## 追加执行记录（2026-09-30 晚）· 微调12

- 反馈：口播素材详情页顶部「选题 · xxx」面包屑行多余。
- 修复（smartstore-desktop.html）：scriptWork 的 genHead 调用 kicker 改传空串；genHead 内 kicker 为空时不渲染 .kicker 节点（mix/viral 等其它页传 kicker 的不受影响）。
- 验证：回归 79/79 全绿。

## 追加执行记录（2026-09-30 晚）· 微调13

- 反馈：正文再大一号；转化/拍摄建议与上方口播稿拉开间距。
- 修复（app.css）：口播稿条目 .beat .t 与钩子 .hook .t 13.5→14.5px（行高 1.8/1.55）；右栏正文 13→14px、发布文案 12.5→13.5px、组标题 13.5→14.5px；新增 .matgrid > div:not(.col-s) .grp { margin-top:28px; padding-top:16px } 让左栏板块与上方内容留白。
- 验证：render 冒烟 7/7 通过。
