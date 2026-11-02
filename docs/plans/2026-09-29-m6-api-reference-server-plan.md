# M6 参考实现：本地 API 服务器（EXE 侧原型）

> 上级文档：`2026-09-29-m6-shell-api-contract.md`；模式：TDD（测试先行）。

**Goal:** 契约目前只是文档。本任务交付一个零依赖 node:http 服务器 `server/api.mjs`，按契约实现全部端点（AI 生成位按契约返回 501 `AI_NOT_CONFIGURED`），作为便携版 EXE 侧的**参考实现**：EXE 侧后续按同样语义移植即可。同时让 `ss-api.js` 的远端模式获得端到端验证（真实 HTTP 往返 + 同形性断言）。

**边界（重要）：**
- 服务器只读样例数据副本（structuredClone），进程内可变（增删账号/导入/跟进），退出即弃——与原型「刷新还原」语义一致。
- 仅监听 127.0.0.1；端口 `--port` 或随机；不进 hot-update 加载路径（零构建约束不破坏）。
- 同形性是本任务的验收核心：远端响应必须与 SSCore 本地结果 deepEqual（纯函数确定性保证）。

## Task
1. 测试先行 `tests/server/api.test.mjs`：起服 → 逐端点形状断言 + 同形性（accounts/script/diagnosis/leads/cockpit）+ 404/405/501 错误语义 + SSApi 集成（useBase 后本地回退关闭、数据一致）。
2. 实现 `server/api.mjs`（路由表 + json 响应助手 + 400/404/405/501）。
3. 全量回归（core + server 两目录）+ 提交。

## 执行记录

**2026-09-29 完成（严格 TDD）**：

- Task 1（RED）：`tests/server/api.test.mjs` 5 项先行 → 首跑失败于 `server did not start`（服务器不存在，特征失败）。执行中修了两处测试自身问题：diagnosis 同形断言排除服务器时刻生成的 `createdAt`；POST 助手对 null body 需显式 `method`（否则误发 GET 触发 405 而非目标状态码）。
- Task 2（GREEN）：`server/api.mjs` 实现——契约 §二 全部 16 端点；数据用 `structuredClone` 进程内副本（fmt/fmtK/dt 函数键不克隆，规避 structuredClone 限制）；路由表式匹配（路径命中但方法不符 → 405；未匹配 → 404；缺参/坏 JSON → 400；AI 位 → 501 AI_NOT_CONFIGURED）。5/5 通过。
- Task 3：全量回归 **53/53**（core 48 + server 5）；同形性验证：`/api/accounts` 与本地 deepEqual、`/api/scripts` 与 `Core.scriptgen` deepEqual、`/api/leads/identify` 与 `Core.leadFromComments` deepEqual、diagnosis 排除时间戳后 deepEqual、未授权 → null；SSApi `useBase` 真实 HTTP 往返数据一致。CLI 冒烟：health/comments(accountId 过滤)/ai 501 均符合契约。
- 交付意义：契约从文档升级为可执行参考实现；EXE 侧按同语义移植即可（或直接把 node 侧服务嵌入 EXE 的本地进程）。
