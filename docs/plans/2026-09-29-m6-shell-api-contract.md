# M6 壳集成 · 本地 API 契约 v1（渲染层 ↔ 便携版 EXE）

> 上级文档：`2026-09-29-solution-v2-design.md`（M6 行）。
> 本文档定义便携版 EXE 侧需要实现的本地 HTTP API；渲染层已按此契约准备好适配模块
> `hot-update/assets/core/ss-api.js`（`window.SSApi`）。

## 一、同形原则（继承 9-23 计划）

渲染层当前以 `SSCore.*`（样例实现）同步取数；EXE 侧提供本契约 API 后，
把 `window.SS_API_BASE` 设为 `http://127.0.0.1:<port>` 即切换到真实数据。
**契约形状 = SSCore 返回形状**，因此切换实现不改变任何界面代码的取数语义。

- 断网 / EXE 未启动 / 请求失败 → 渲染层**回退样例实现**（SSCore），界面标注「样例数据」。
- 所有响应缺失指标一律 `null`，渲染层按「暂无数据」展示（硬口径 1，两侧共同遵守）。
- 端口由 EXE 启动时随机分配并通过 `window.SS_API_BASE` 注入；禁止写死端口。
- 鉴权：仅本机回环（127.0.0.1），一期不做 token；EXE 侧必须校验 Origin/Host 为本地。

## 二、端点清单（v1）

| 方法 | 路径 | 请求体 | 响应（= SSCore 形状） | 对应样例实现 |
|---|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true, version, sampleFallback: boolean }` | — |
| GET | `/api/accounts` | — | `Account[]`（含 `authStatus/importedAt`） | `D.accounts` |
| POST | `/api/accounts` | `{ platform, nickname, homepage }` | `Account`（新增，`authStatus:'unauthorized'`） | addAccountSheet 逻辑 |
| DELETE | `/api/accounts/:id` | — | `{ ok }`（关注列表移除语义） | `[data-delacct]` 逻辑 |
| POST | `/api/accounts/:id/import` | `{ nickname?, followers?, likes?, worksCount?, bio? }` | `Account`（仅覆盖非 null 字段） | `SSCore.parseProfileText` 之后调用 |
| GET | `/api/accounts/:id/works` | — | `Work[]` | `D.works.filter` |
| GET | `/api/works` | — | `Work[]`（全量，bootstrap 用） | `D.works` |
| GET | `/api/transcripts` | — | `Transcript[]`（全量，bootstrap 用） | `D.transcripts` |
| GET | `/api/topics` | — | `Topic[]` | `D.topics` |
| POST | `/api/topics/from-recording` | `{ cat, q, count }` | `Topic` | `SSCore.topicFromQuestion` |
| GET | `/api/diagnosis/:accountId` | — | `DiagnosisResult \| null`（未授权=null） | `SSCore.diagnose` |
| POST | `/api/scripts` | `{ topicId, variant }` | `ScriptResult` | `SSCore.scriptgen` |
| POST | `/api/compliance/check` | `{ text, hook }` | `Check[4]` | `SSCore.compliance` |
| GET | `/api/matrix/insights` | — | `{ types, insights }` | `SSCore.matrixInsights` |
| GET | `/api/recordings/analysis` | — | `{ stats, questions, objections }` | `SSCore.analyzeRecordings` |
| GET | `/api/cockpit` | — | `{ overview, meters, trend, answers, brief }` | `SSCore.cockpitMetrics + cockpitAnswers` |
| GET | `/api/comments` | `?accountId=`（可选） | `Comment[]`（平台公开评论采集结果） | `D.comments.filter` |
| POST | `/api/leads/identify` | `{ comments: Comment[] }` | `{ leads, rules }` | `SSCore.leadFromComments` |
| POST | `/api/ai/generate` | `{ kind: 'script'\|'rewrite', topicId, variant }` | `ScriptResult`（真实 LLM 版，`gen:'llm'`） | M6 新增位（DeepSeek/方舟，密钥走 EXE 环境变量） |

## 三、数据结构要点

- `Account`：`{ id, platform, nickname, homepage, authStatus:'authorized'|'unauthorized', followers, likes, worksCount, bio, region, verified, active, silentDays, lastPublishedAt, importedAt? }`；未授权账号数值字段为 `null`。
- `Work`：`{ id, accountId, contentType, topic, title, publishedAt, metrics: { plays, likes, comments, collects, shares } }`；无数据指标为 `null`。
- `ScriptResult`：`{ topicId, title, hook, body, duration, shooting[], cover, covers[], publish, tags[], cta, variants[3], checks[4], gen }`；`gen` 必须如实标注 `'rules-v1' | 'llm'`。
- `DiagnosisResult`：`{ accountId, createdAt, sampleSize, periodDays, dims[7], missingData[], issues[≤3] }`；`issues[i].evidence[]` 非空且 `refId` 可解析（硬口径 2）。
- 错误：`{ error: { code, message } }`，HTTP 状态码语义化（404 无资源 / 400 参数缺失 / 500 内部错误）。

## 四、产品硬口径（EXE 侧同样必须遵守）

1. 缺失数据返回 `null`，禁止以 0 或估算值填充。
2. 诊断结论必须带非空 `evidence`，`refId` 指向真实资源。
3. 生成的文案不得出现因果与绝对化表述（`因为…所以 / 必然 / 保证 / 100% / 最低价`）。
4. 分析窗口默认最近 30 条作品，样本量如实返回。

## 五、渲染层现状与切换步骤

- 现状：视图同步调用 `SSCore.*`；`ss-api.js` 的适配方法已覆盖全部端点。
- **切换只需两步（v1.1 起，视图零改动）**：
  1. EXE 起本地 API，页面加载前注入 `window.SS_API_BASE`；
  2. 渲染入口先 `await SSApi.bootstrap()`——成功时远端五集合（accounts/works/topics/comments/transcripts）写入 `window.SS`，随后的同步视图全部消费真实数据；失败自动保持样例数据（`lastError()` 可查）。
  - 视图改为逐方法 `await SSApi.*` 属可选优化（省一次全量引导），非必需。
- **EXE 侧参考实现（2026-09-29 起）**：`shell/`（Electron 壳，`npm run dev` 开发态 / `npm run build` portable）。`shell/main.js` 以 `ELECTRON_RUN_AS_NODE=1` 子进程运行 `server/api.mjs --port-file <tmp>` 握手随机端口 → `loadFile(HTML, { query: { 'ss-api-base': … } })` → `shell/preload.js` 读查询参数写 `window.SS_API_BASE`（contextIsolation 开启）。开发态另对 hot-update 目录 fs.watch 自动刷新渲染层。
- 任何一侧改动不得破坏：`window.desktopWindow.control('minimize'|'toggle-maximize'|'close')` 标题栏契约与 `window.SS` 样例契约。
