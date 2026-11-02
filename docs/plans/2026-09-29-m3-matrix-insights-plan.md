# M3 实施计划：矩阵聚合分析（内容效果 + 活跃识别 + 样本量约束）

> 上级文档：`2026-09-29-solution-v2-design.md`（M3 行）；模式沿用 M1/M2。
> 执行方式：本会话内 TDD 直接执行。

**Goal:** 驾驶舱「内容效果」与洞察文案从**编造快照**（`D.contentTypes` 声称 knowledge 15 条/广告 15 条，实际 works 只有 4/4 条，硬口径禁止）升级为**从真实 works 聚合计算**；「哪类内容有效」由数据推出且受样本量约束；账号活跃状态统计实时汇总。

**Architecture:**
- `SSCore.matrixInsights(works, {names, accounts})` → `{types[], insights[]}`：类型×效果聚合（复用 summarizeTypes）+ 洞察生成。**样本量约束（9-23 计划 Task 4.1 口径）**：count < 3 的类型不进策略建议，只出现在「样本不足」warn 里；对比结论只取 count ≥ 3 的类型；账号级频率结论需已授权账号分组充足（< 6 个不输出），全部只表述相关。
- `SSCore.typeInsight(works, {names})` → 单账号一条洞察（顶栏统计弹层用）：足够样本输出「X 类为 Y 类的 N 倍」，否则如实输出「样本不足，暂不输出结论」。
- `SSCore.activitySummary(accounts)` → `{active, low, silent, unknown}` 实时汇总，未授权/未知一律进 unknown，不冒充活跃。
- core 不依赖 D：类型中文名经 `opts.names`（HTML 的 TYPE_NAME）注入。

**验收（对应 9-23 计划场景 3）：** 给定样例数据，「知识类平均播放是广告类的 N 倍」类结论可由数据推出并给出建议动作；样本不足的类型被明确排除而非参与编造。

---

## Task 1: 测试先行（tests/core/matrix.test.mjs）

必须覆盖：聚合计数与 works 实际一致（4/4/2/2/2）、主对比结论数值可复算、薄样本类型只出现在 warn、全部文案无因果/绝对化措辞、单账号洞察的足够/不足两分支、活跃汇总四桶计数且未授权进 unknown、账号级频率结论的阈值分支。

## Task 2: 实现 matrixInsights / typeInsight / activitySummary

## Task 3: 渲染层接线（4 处）

1. 驾驶舱「内容效果」柱状图：`D.contentTypes` 硬编码 → `SSCore.summarizeTypes(D.works)`（颜色经 D.contentTypes 查 key，中文名经 TYPE_NAME）。
2. 驾驶舱效果 callout：写死「9.0 倍」→ `matrixInsights(...).insights` 中 kind=up 的一条。
3. 顶栏统计弹层洞察行：`D.insights[0].text` → `typeInsight(当前账号作品)`。
4. 矩阵「账号活跃状态」表头：追加实时汇总计数（活跃/低活跃/断更/未授权）。

## Task 4: 全量回归 + 记录

node --test（M1 8 + M2 9 + M3 新增）全绿；语法/大括号/静态服务 200；提交 tests 与执行记录。

---

## 执行记录

**2026-09-29 全部 4 个 Task 完成**：

- Task 1/2：`tests/core/matrix.test.mjs` 7 项先行（7/7 失败）→ 实现 `matrixInsights` / `typeInsight` / `activitySummary` → **7/7 通过**。关键数字全部可复算：全局知识类均值 6,450 vs 广告类 983（6.6 倍）；wang 单账号 5,333 vs 790（6.8 倍，与 M1 诊断快照口径吻合）；薄样本类型（避坑/问答/日常各 2 条）被排除出建议并出现在 warn；3 个授权账号 < 6 不输出频率相关性结论。
- Task 3：接线 4 处——驾驶舱「内容效果」柱状图从编造的 `D.contentTypes`（声称 n=15/5/6/3/15）改为 `summarizeTypes(D.works)` 实时聚合（真实 n=4/2/2/2/4），效果 callout 写死「9.0 倍」改为实时洞察文案；顶栏统计弹层洞察行改为 `typeInsight(当前账号)`；矩阵「账号活跃状态」表头追加实时四桶汇总。
- Task 4：回归全绿——node --test **24/24**（M1 8 + M2 9 + M3 7）、内联语法 OK、大括号 452/452、`D.insights` HTML 引用清零、静态服务 200（job `pwsh-14`）。
- 待人工目检（Ctrl+R）：驾驶舱「内容效果」柱状图的 n 值应为真实作品数（知识科普 4、套餐广告 4、其余 2）；callout 显示「6.6 倍」且带相关性口径说明；顶栏「账号统计」弹层的洞察行随账号变化（wang 有倍数结论，zhang 显示样本不足）；矩阵「账号活跃状态」表头显示 活跃 1 · 低活跃 1 · 断更 1 · 未授权/未知 1。
