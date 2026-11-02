# M2 实施计划：口播生成闭环 + 合规校验引擎

> 上级文档：`2026-09-29-solution-v2-design.md`（M2 行）、`2026-09-29-m1-core-engine-plan.md`（M1 已完成，模式沿用）。
> 执行方式：本会话内 TDD 直接执行。

**Goal:** AI内容运营中心的口播生产从「只有 t1 一条写死样例」升级为**任一选题实时生成完整口播素材**：12 个选题 × 3 种风格版本均可生成、可念、可复制，全部过合规校验；「换一版」从假动作变成真实的规则改写。图文混剪仍保持样例原型定位（9-23 计划 Phase 7 约定不变）。

**Architecture:**
- `SSCore.scriptgen(topic, opts)` → 输出形状与 `D.script` 完全一致（title/hook/body/duration/shooting/cover/covers/publish/tags/cta/variants/checks），渲染层只需换数据源。
- `SSCore.compliance(text, hook)` → 四项校验（敏感词/夸大宣传/品牌规范/开场钩子），返回 `[{name,status,note}]`，渲染层 complianceChip 直接复用。
- 生成策略为**规则版 v1**（模板装配 + 风格变体改写开头/结尾），产出标注 `gen: 'rules-v1'`；真实 LLM 生成留 M6 的 provider 位，接口形状不变。
- 风格变体：知识型（原文）/ 生活化（开头加「先说结论，」+ 结尾替换口语化 CTA）/ 专业向（开头「从一线办理经验看，」+ 结尾合规提示）。诚实标注为规则改写，不冒充 AI。

**验收（对应 9-23 计划场景 2）：** 从任一选题进入口播生产，营业员不改一个字就能念；「换一版」三种版本正文互不相同；合规校验有单测。

---

## Task 1: 测试先行（tests/core/scriptgen.test.mjs）

必须覆盖：12 选题全量字段非空、可念性（无空行/无 null 字样/字数≥60）、时长与字数换算一致、合规 4 项存在且样例全过、夸大词与自我介绍钩子的失败路径、三版本正文互异、混剪类选题的拍摄建议分叉。

## Task 2: 实现 SSCore.scriptgen + SSCore.compliance

- 输入：topic（D.topics 元素）+ opts {variant, account}。
- title=选题标题；hook=选题钩子；body=选题 say（含风格变体改写）；duration=按 4.5 字/秒取 5 的倍数；covers=3 候选去重；publish=钩子+正文摘句+互动句+本地服务行；tags=业务词+类型+城市；cta=选题自带结尾行；shooting 按真人口播/图文混剪分叉。
- compliance 词库：样例节选并**在 note 中如实标注**「样例库 N 条，生产为完整词库 486 条」，不冒充全量。

## Task 3: 渲染层接线（smartstore-desktop.html）

- 新增 `curScript()`：当前选题 + `state.scriptVariant` 的实时生成（纯计算，不缓存不落盘）。
- 换数据源：`scriptCols`、`coverItem`、`scriptWork`（标题+checks）、`genHead` 增加 checks 参数（mixWork 保持 D.script.checks）。
- 换假动作：`#regen` 轮换 knowledge→casual→pro 并重渲染；`#copyBody`/`#openTele` 改用 `curScript()`。
- 口播稿标签追加当前版本名（知识型/生活化/专业向）。

## Task 4: 全量回归 + 记录

`node --test`（M1 8 项 + M2 新增）全绿；内联脚本语法 OK；大括号平衡；静态服务 200；提交 `tests/` 与本文档执行记录（hot-update 仍不入库）。

---

## 执行记录

**2026-09-29 全部 4 个 Task 完成**：

- Task 1/2：`tests/core/scriptgen.test.mjs` 9 项测试先行（跑到 9/9 失败）→ 实现 `SSCore.scriptgen` + `SSCore.compliance` → **9/9 一次通过**。覆盖：12 选题全量字段非空、可念性（无空行/无 null 字样/≥60 字）、时长换算（4.5 字/秒 ± 容差、下限 15 秒）、样例全过合规、夸大词与自我介绍钩子失败路径、三版本正文互异钩子一致、城市本地化、混剪/口播拍摄建议分叉、封面候选去重。
- Task 3：HTML 接线 9 处——新增 `curScript()`；`scriptCols`/`coverItem`/`scriptWork` 换数据源；`genHead` 增加 checks 参数（mixWork 走 `D.script.checks` 兜底，全文件唯一残留快照引用，属混剪原型定位的合法保留）；`#regen` 从假 toast 变成 knowledge→casual→pro 真实轮换重渲染；`#copyBody`/`#openTele`/`#openChecks` 合规详情改用当前生成版本；口播稿标签追加版本名（知识型/生活化/专业向）。
- Task 4：回归全绿——node --test **17/17**（M1 8 + M2 9）、内联脚本语法 OK、大括号 447/447、`D.script` 引用 1（合法兜底）、静态服务 200（job `pwsh-14`）。
- 待人工目检（Ctrl+R）：任选一个选题进「口播生产」→ 正文应随选题变化；点「换一版」三种版本文字明显不同且标签显示版本名；「合规校验」弹层与当前版本联动；提词器/复制按钮内容与当前版本一致。
