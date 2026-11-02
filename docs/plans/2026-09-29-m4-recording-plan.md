# M4 实施计划：录音洞察（转写 → 识别 → 转选题闭环）

> 上级文档：`2026-09-29-solution-v2-design.md`（M4 行）；模式沿用 M1–M3。
> 执行方式：本会话内 TDD 直接执行。

**Goal:** 录音洞察中心从「写死的 TOP10 聚合数 + 固定查表转选题」升级为**端到端可跑的规则引擎**：样例转写文本 → 需求/异议规则识别 → 实时 TOP 问题榜与异议分布 → 一键动态生成选题 → 进入 M2 口播生成与合规校验。同时把主页与驾驶舱引用的第一高频问题切换为计算值，保持全产品口径一致。

**Architecture:**
- 数据：`data.js` 新增 `transcripts`（8 段样例转写，客户/营业员分角色），暴露进 `window.SS`。原 `recordings/objections` 聚合样例保留在数据包中但 UI 不再消费（如残留引用在执行记录中说明）。
- `SSCore.analyzeRecordings(transcripts)` → `{stats, questions, objections}`：
  - 需求分类按**有序首中**规则（宽带/组网 → 5G/号段 → 套餐/合约 → 业务办理 → 资费 → 电视 → 售后服务），一条客户发言只归一类，计数不虚增；
  - 异议识别为**独立多标签**（价格/信号/合约/办理条件/对比友商/售后时效），share = count / 异议总数；
  - 每类问题保留**代表性原句**（最长命中句）与命中片段作为转写样本；
  - 环比（wow）在单期样例下**输出 null**，界面显示「需双期数据」，不编造趋势。
- `SSCore.topicFromQuestion(question, seq)` → 动态选题卡（id `gen-N`、source=recording、推荐理由引用真实计数、say 为分类模板四行、hook 留空由 scriptgen 取正文首句）。
- UI：`recQuestions`/`recItem`/`objectionBars` 改消费计算结果；`#recToTopic` 从查表改为 `D.topics.unshift(生成选题)` + 跳转口播生产（沿用 addAccountSheet 的运行时数据先例，刷新即还原）；主页提醒与驾驶舱「客户在问什么」改为计算值。

**验收（对应 9-23 计划场景 4）：** 一批录音转写进来 → 输出 TOP 问题榜 → 一键生成选题卡片 → 直接进入口播生成并过合规校验。

---

## Task 1: 测试先行（tests/core/recording.test.mjs）

必须覆盖：客户发言计数与转写一致、首中分类不重复计数、TOP 榜降序、代表原句非空且来自转写、异议 share 合计 ≈ 100、wow=null（不编造趋势）、topicFromQuestion 产物可被 scriptgen 生成全过合规的口播、生成文案无因果/绝对化措辞。

## Task 2: data.js 样例转写 + core 引擎实现

## Task 3: 渲染层接线（6 处）

recQuestions 主面板 / recItem 列表项 / objectionBars（去 trend）/ #recToTopic 动态生成 / 主页录音提醒 / 驾驶舱「客户在问什么」。

## Task 4: 全量回归 + 记录

---

## 执行记录

**2026-09-29 全部 4 个 Task 完成**：

- Task 1/2：`tests/core/recording.test.mjs` 7 项先行（模块级失败）→ data.js 新增 8 段样例转写（16 条客户发言）并暴露 `D.transcripts` → 实现 `analyzeRecordings` + `topicFromQuestion` → **7/7 通过**。实测口径：客户发言 16 条、分类计数合计 12（首中不重复，4 条多意图发言只归一类或不计入）、异议 6 类 share 合计 100、全部 wow=null（不编造环比）、TOP 问题榜按计数降序且代表原句均为转写原文。
- Task 3：接线 6 处——recQuestions 主面板改消费计算结果（命中片段替代固定转写样本、环比标注「需双期数据」）；recItem 去掉 wow；objectionBars 去 trend 并接收计算列表；`#recToTopic` 从 REC_TOPIC 查表改为 `topicFromQuestion` 动态生成 + `D.topics.unshift` + 跳转口播生产（运行时数据先例同 addAccountSheet，刷新还原）；主页录音提醒与驾驶舱「客户在问什么」「AI 经营简报」引用改为计算值。
- Task 4：回归全绿——node --test **31/31**（M1 8 + M2 9 + M3 7 + M4 7）、内联语法 OK、大括号 454/454、`D.recordings` HTML 引用清零（REC_TOPIC 仅剩声明，TRANSCRIPTS 备用保留）、静态服务 3 个资源全 200（job `pwsh-14`）。
- 待人工目检（Ctrl+R）：录音洞察中心 TOP 榜应为 7 类、计数为个位数片段数（不再是「1,284 次」这类编造量级）；选中问题后「命中片段」显示真实客户原句；点「变成选题」会跳到口播生产并生成该问题的可拍素材（选题列表顶部出现「录音问题」新卡）；主页与驾驶舱引用的高频问题与录音中心 TOP1 一致。
