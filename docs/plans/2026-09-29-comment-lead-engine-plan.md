# 评论洞察与线索规则引擎计划（M1–M5 引擎化的最后一块业务面）

> 上级文档：`2026-09-29-solution-v2-design.md`；模式：TDD（测试先行，先看失败）。

**Goal:** `acctComment` 的「AI判定」列与 `acctLead` 的线索表当前消费写死标签（`D.comments[].aiJudge/lead` 与 `D.leads` 快照）。改为 `SSCore.analyzeComments` / `SSCore.leadFromComments` 纯文本规则推导：

- 意向判定（只看评论文本，不信任预置标签）：
  - 办理/咨询意图关键词（怎么弄/多少钱/要带什么材料/续费/转网/组网/过去看看/到店/办理/报装/上门/报价…）→ **高意向**
  - 其余含明确问句（？/?）→ **待跟进**
  - 无问句无意图 → **普通互动**
- 线索 = 判定 ≠ 普通互动 的评论；`诉求` = 评论文本原文（证据优先，不做改写）；`联系方式` 一律「待补充」（缺失不估算）；`状态` 初始「待跟进」，跟进动作写入运行态 override（沿用 runtime-mutation 先例）。
- 附带：主页「今天建议做这一条」标题的内联 18px 字号改为与设计令牌一致。

**数据契约变化：** 引擎接管后 `D.leads` 成为死数据 → 删除（SS 契约瘦身）；`D.comments` 保留（引擎输入）。

## Task
1. 测试先行 `tests/core/comment.test.mjs`（意向分布 / 线索派生 / 空输入 / 口径文案）
2. core 实现 `analyzeComments` + `leadFromComments`
3. UI 接线（acctComment 判定列 + 汇总行；acctLead 引擎表 + 跟进 override；reidentify 按钮）
4. 删除 D.leads；全量回归 + 提交

## 执行记录

**2026-09-29 完成（严格 TDD：先失败后实现）**：

- Task 1（RED）：`tests/core/comment.test.mjs` 6 项 → 首跑确认失败于 `analyzeComments is not a function`（特征失败，非笔误）。
- Task 2（GREEN）：实现 `SSCore.judgeComment / analyzeComments / leadFromComments` + 常量 `INTENT_RE / QUESTION_RE`；判定只依据评论文本，完全不读预置 `aiJudge/lead` 标签。样例 8 条分布：高意向 5 / 待跟进 1 / 普通 2；线索 6 条（诉求=评论原文，联系方式一律「待补充」）。6/6 通过。
- Task 3：接线三处——① `acctComment` AI判定列改引擎判定，底部计数行显示「N 条评论 · 高意向 x · 待跟进 y」；② `acctLead` 整表改引擎实时识别，口径说明直接用引擎 `rules` 文案，「跟进」按钮改为运行态状态机（待跟进→已联系→已成单→循环，contact 仅在已联系时标「见私信」，其余保持待补充），沿用 runtime-mutation 先例（`state.leadStatus`）；③ 主页运营启动区的线索计数同步改引擎口径。
- Task 4：`D.leads` 删除（SS 契约再瘦身），`c.lead`/`aiJudge` 预置标签引用清零；主页「今天建议做这一条」标题去掉内联 18px 字号（与设计令牌一致）。回归 **48/48** 全绿（新增 6 项），语法 OK，静态服务 200。
- 契约补充：`2026-09-29-m6-shell-api-contract.md` 增补 `GET /api/comments` 与 `POST /api/leads/identify` 两端点（文档级，渲染层 M6 切换时补齐适配方法）。
