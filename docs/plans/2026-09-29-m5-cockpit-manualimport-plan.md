# M5 实施计划：驾驶舱引擎化 + manualImport 手动导入适配层

> 上级文档：`2026-09-29-solution-v2-design.md`（M5 行）；模式沿用 M1–M4。
> 执行方式：本会话内 TDD 直接执行。

**Goal:** 驾驶舱从「province 级编造大数（D.dashboard：342 账号/86% 覆盖）+ 写死五问文案」升级为**从本店样例数据实时聚合**，口径与各中心完全一致；补上采集适配层的第一块真实拼图——未授权账号「手动导入主页数据」从死按钮变成可用的解析器（缺失字段保持 null，绝不估算）。

**Architecture:**
- `SSCore.cockpitMetrics(accounts, works, now)` → `{overview, meters, trend}`：
  - overview：账号总数/已授权数/作品数/累计播放/本周发布/断更数，全部实算；
  - meters 四条：账号活跃率、已授权账号率、发布达成率（目标 7 条/周，产品配置非编造数据）、爆款内容率（播放 ≥ 5,000，口径显式标注）；
  - trend：近 14 天逐日发布数（无发布时界面显示说明文案而非空图表）。
- `SSCore.cockpitAnswers(accounts, works, recAnalysis, matrixResult, now)` → `{answers[5], brief}`：五问文案逐条由引擎拼装（复用 activitySummary / matrixInsights / analyzeRecordings 结果），AI 简报的「本期变化/建议动作」同理，全部相关性措辞且带缺失数据说明。
- `SSCore.parseProfileText(text)` → 手动导入解析器：支持「粉丝/获赞/作品/简介/昵称：值」键值行，数字支持 `1.2万` 格式；解析不出的行进 `unknown`；**缺失字段一律 null**（硬口径 1）。
- 产品配置常量暴露为 `SSCore.COCKPIT_CONFIG`（HOT_PLAYS / WEEKLY_TARGET / TREND_DAYS），测试与 UI 共用。
- `D.dashboard`（province 样例包）保留在数据层供矩阵概览的省/市级演示视图使用，驾驶舱不再消费。

**验收（对应 9-23 计划场景 3 + Task 8 manualImport）：** 驾驶舱五问每条都能追溯到本店数据；手动粘贴主页数据后，未授权账号立即显示已导入字段，缺失项仍显示「暂无数据」。

---

## Task 1: 测试先行（tests/core/cockpit.test.mjs）

必须覆盖：overview 各字段与 accounts/works 手工重算一致；meters 四条数值正确且 note 非空；trend 数组长度 14 且总和 ≤ 作品数；五问 answers 每条非空且引用具体数字；brief 无因果/绝对化措辞且含缺失数据说明；parseProfileText 的全字段/缺字段/万单位/未知行/空文本五分支。

## Task 2: core 引擎实现（cockpitMetrics / cockpitAnswers / parseProfileText / COCKPIT_CONFIG）

## Task 3: 渲染层接线

1. `viewCockpit` 整体重写为引擎结果消费（概览 metrics、四条 meter、趋势 spark 或空态说明、五问、简报）。
2. 账号报告未授权分支：`手动导入主页数据` 按钮加 id 并绑定「导入弹窗」（textarea 粘贴 → parseProfileText → 仅覆盖非 null 字段 → 重渲染）。
3. 未授权分支在存在已导入字段时显示对应指标（缺失仍显示「—」）。

## Task 4: 全量回归 + 记录

---

## 执行记录

**2026-09-29 全部 4 个 Task 完成**：

- Task 1/2：`tests/core/cockpit.test.mjs` 7 项先行 → 实现 `cockpitMetrics` / `cockpitAnswers` / `parseProfileText` / `COCKPIT_CONFIG` → **7/7 通过**。实测口径：活跃率 25%（1/4）、已授权率 75%（3/4）、发布达成率按实发/目标 7 条、爆款率按播放 ≥ 5,000（6/14 = 43%）、trend 14 天窗口内真实发布数。
- Task 3：接线三块——① `viewCockpit` 整体重写为引擎消费：概览 5 指标 / 4 条 meter（note 全部展示口径说明）/ 14 天趋势（max=0 时显示「暂无发布记录」空态而非空图表）/ 五问速览全部由 `cockpitAnswers` 生成 / AI 简报本期变化与建议动作由引擎拼装并显式声明缺失数据口径；驾驶舱不再读 province 样例包 `D.dashboard`（仅矩阵概览保留省市级演示视图）。② 未授权账号「手动导入主页数据」死按钮 → `#importProfile` 绑定导入弹窗（textarea 粘贴 → parseProfileText → 仅覆盖非 null 字段 → 重渲染，toast 报告导入项数与忽略行数）。③ 未授权分支存在已导入字段时显示「手动导入的主页数据」指标区（缺失项仍显示「暂无数据」）。app.css 补一条 `textarea.input` 最小样式（紧凑风一致）。
- Task 4：回归全绿——node --test **38/38**（M1 8 + M2 9 + M3 7 + M4 7 + M5 7）、内联语法 OK、大括号 461/461、`D.dashboard` 引用降至 3（全部为矩阵概览合法演示视图）、静态服务 4 资源 200（job `pwsh-14`）。
- 待人工目检（Ctrl+R）：驾驶舱数字应从 province 级大数（342 账号/86%）变为本店真实样例口径（4 账号/14 作品/16 条客户发言），五问每条引用具体数字；账号运营中心切到「陈涛·玄武营业厅」（未授权）→ 点「手动导入主页数据」→ 粘贴示例（粉丝: 1280 / 获赞：4,300 / 作品 22）→ 头部出现已导入指标区且缺失项仍显示「暂无数据」。
