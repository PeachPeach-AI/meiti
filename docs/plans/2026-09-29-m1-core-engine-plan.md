# M1 实施计划：业务内核抽离 + 诊断引擎 v1

> **For the executing agent:** 按 Task 顺序实施，每个 Task 结束跑一次对应验证命令。
> 上级文档：`2026-09-29-solution-v2-design.md`（架构决策与四条硬口径）。
> 执行方式：本会话内直接执行（沿用紧凑工具风改版的执行模式），不使用子代理。

**Goal:** 把原型从「写死的诊断快照」升级为「实时计算的诊断引擎」：业务计算进 `hot-update/assets/core/ss-core.js`（纯函数、可单测），账号运营中心的账号报告改为实时诊断输出，同时保持渲染层零构建、Ctrl+R 即生效。

**Architecture:**
- `hot-update/assets/core/ss-core.js`：UMD 双挂载（浏览器 `window.SSCore` / Node `module.exports`），内部禁止 DOM/localStorage。
- `smartstore-desktop.html` 在 `assets/data.js` 之后、内联脚本之前加一行 `<script src="assets/core/ss-core.js"></script>`。
- 聚合函数（`typeStats`/`avgPlays` 的计算部分）迁入 core，HTML 内保留薄包装避免大范围改动渲染代码。
- 诊断引擎 `SSCore.diagnose(account, works, now)` 返回与现有渲染兼容的结构：`{accountId, createdAt, sampleSize, periodDays, dims[7], missingData[], issues[]}`，`dims` 沿用现有 7 个维度名，`issues` ≤ 3 且每条含 `title/why/evidence[]/suggestion/action`。
- 未授权账号：引擎返回 `null`（渲染层已有「未授权不可分析」分支，保持不变）。

**产品硬口径（每条至少一个测试）：**
1. 缺失数据 → `missingData` 必须列出，不得填 0/估算值。
2. 每条 issue 的 `evidence` 非空，且 `refId` 指向真实存在的账号/作品。
3. `why/suggestion` 不得出现因果与绝对化措辞（「因为…所以」「必然」「保证」「100%」「最低价」）。
4. 作品不足 30 条时 `sampleSize` 如实反映，并触发 `missingData` 提示。

---

## Task 1: core 模块骨架 + 页面接入

**Files:** Create `hot-update/assets/core/ss-core.js`；Modify `hot-update/smartstore-desktop.html`（加一行 script 标签）

**要点：**
- UMD 模式：`(function (root, factory) { var api = factory(); if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SSCore = api; })(...)`。
- 先只放 `avg()` 与 `typeStats(works)`，验证双挂载与页面加载无误。
- 验证：`node -e "const c=require('./hot-update/assets/core/ss-core.js'); console.log(Object.keys(c))"` 输出 `['avg','typeStats']`；curl 页面 200；HTML 内联脚本语法检查通过。

## Task 2: 聚合函数迁移

**Files:** Modify `ss-core.js`（补 `typeStats`/`avgPlays` 完整实现）；Modify `smartstore-desktop.html`（HTML 内 `typeStats`/`avgPlays` 改为委托 `SSCore`）

**要点：**
- `typeStats(works)` 返回 `[{key,count,avgPlays,avgLikes,avgComments,avgCollects}]`，只统计指标非 null 的作品，全 null 的类型 `avgX = null`。
- HTML 内 `typeStats(id)` 现签名是按账号过滤后的数组上调用，保持 HTML 侧包装签名不变：包装函数取 `D.works.filter(accountId)` 后调 core。
- 验证：node -e 对样例 works 跑 `typeStats`，knowledge 类 avgPlays > campaign 类 avgPlays ×2；页面 Ctrl+R 后矩阵/AI内容中心数字与改前一致（有截图对照义务的由人工目检）。

## Task 3: 诊断引擎 v1（TDD）

**Files:** Test `tests/core/diagnosis.test.mjs`（先写，跑到失败）；Create `ss-core.js` 内 `diagnose(account, works, now)`

**规则设计（启发式，全部带 evidence）：**

| 维度 | 判定 | 状态 |
|---|---|---|
| 账号包装 | 昵称含无意义数字段 / 昵称无地域词 / 简介缺「我是谁/提供什么/在哪」价值表达 → todo，生成 issue「包装不清晰」 | good / ok / todo |
| 账号定位 | topic TOP1 占比 ≥ 70% → good；40–70% → ok；< 40% → todo（垂直度不足） | — |
| 内容垂直度 | 与定位同源：宽带/通信相关主题占比 | — |
| 选题能力 | campaign+product 类占比 > 40% → todo | — |
| 内容表现 | 知识/避坑/问答类 avgPlays 与广告类比值 ≥ 2 → good；< 2 → ok；无数据 → ok 并记 missingData | — |
| 更新频率 | silentDays ≥ 14 → todo（生成断更 issue）；7–13 → ok；< 7 → good | — |
| 用户互动 | 平均评论率 < 1% → todo（生成互动 issue）；1–2% → ok；> 2% → good | — |

**issue 优先级与数量上限：** 断更 > 内容结构失衡（广告占比高且表现低）> 包装 > 垂直度 > 互动，最多取 3 条。
**结构约定：** `dims` 固定 7 项同名（渲染层 health pill 直接复用）；`why` 必须引用具体数字与作品；`missingData` 收集：未授权（引擎直接返回 null 的场景除外）、粉丝画像、完播率、指标 null 的字段、作品 < 30 条提示。
**correlation-only 校验：** 生成文案后跑 `/因为.{0,12}所以|必然|保证|100%|最低价/` 正则自检，命中则该条文案回退模板写法（保证测试确定性）。

**必须写的测试：**
```js
// sample-wang：3 条 issue，方向 = 包装 + 内容结构 + 互动（与既定快照一致）
// sample-li：≥1 条 issue 且含「硬广/广告占比」语义，dims[选题能力].status === 'todo'
// sample-zhang：含断更 issue，evidence 引用最后发布日期
// sample-chen（未授权）：diagnose 返回 null
// 全账号：issues.length ≤ 3；每条 evidence 非空且 refId 可在 accounts/works 中找到
// 全账号：why/suggestion 无因果与绝对化措辞
// works<30：sampleSize 如实（wang=10）且 missingData 含样本量提示
```

**验证：** `node --test tests/core/` 全绿。

## Task 4: 渲染层接线

**Files:** Modify `smartstore-desktop.html` `accountReport()`

**要点：**
- `var d = D.diagnoses[a.id]` → `var d = SSCore.diagnose(a, D.works.filter(...), new Date())`。
- 保留 `D.diagnoses` 数据（其他视图可能引用）但报告不再读它；下一里程碑再清理。
- `d.createdAt` 用引擎生成的 ISO 串，现有 `slice(0,16)` 展示逻辑不变。
- 无 works 的已授权账号（防御）：渲染「暂无作品数据，无法诊断」空态，不报错。
- 验证：内联脚本 `new Function` 语法检查；curl 200。

## Task 5: 测试基建 + 全量回归

**Files:** Create `package.json` scripts（`"test:core": "node --test tests/core/"`，若根 package.json 不存在则只写命令不建文件——避免干扰既有 npm 配置）

**验证（全量）：**
1. `node --test tests/core/` 全绿。
2. `node -e` 内联脚本语法 OK；brace 平衡检查。
3. 重启静态服务 `127.0.0.1:43999`，curl html/core/data/css 全 200。
4. `git add docs/plans/2026-09-29-*.md tests/` 提交（hot-update 不入库；tests 引用 gitignored 文件属已知权衡，本地同步盘保全）。
5. 提醒用户 Ctrl+R 目检：账号报告三个已授权账号的结论方向与改前一致、未授权账号仍显示不可分析提示。

---

## 执行记录

**2026-09-29 全部 5 个 Task 完成**，与计划的偏差：

- Task 1/2：`ss-core.js` 落地为 `avg / summarizeTypes / avgMetric` 三个聚合函数；HTML 内 `typeStats(id)` / `avgPlays(id)` 改为薄包装（保留原签名，渲染层零改动）。**等价性验证通过**：对 sample-wang 的新旧实现输出逐字节一致（`equiv: true`），未授权账号返回 `null` 而非 0。
- Task 3：诊断引擎按计划实现，含 7 维度固定结构、4 级 issue 优先级（断更>结构>包装>互动）、上限 3 条、evidence 可解析校验、因果/绝对化措辞自检回退。**node --test 8/8 通过**。实测结论方向与既有快照对齐：wang=3 条（结构/包装/互动）、li=1 条（硬广）、zhang=1 条（断更）、chen（未授权）=null。
- Task 4：新增 `liveDiag(id)` 统一入口，`D.diagnoses` 快照在 HTML 中的 4 处真实引用全部替换（viewHome / accountReport / 诊断依据弹层 / 整改动作 handler）；`accountReport` 增加「暂无作品数据」空态分支；主页提醒文案随实时结论数联动。
- Task 5：验证全过——`node --test` 8/8、内联脚本 `new Function` 语法 OK、大括号 442/442 平衡、`D.diagnoses` 残留 0（仅注释提及）、静态服务 4 个资源全 200。
- 服务器坑：静态服务的路径守卫用正斜杠 root 与 `path.join` 反斜杠结果做 `startsWith` 导致全 403，改用 `path.resolve` 归一化后恢复（job `pwsh-14`，127.0.0.1:43999）。
- 待人工目检（Ctrl+R）：三个已授权账号报告的结论与快照期方向一致；未授权账号仍显示不可分析提示；主页提醒数字与账号报告一致。
