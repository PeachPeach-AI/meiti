---
name: skill-zhihu-auto-answer
description: >-
  知乎自动答题：按关键词批量找题（低竞争优先）→ 排队计划 → 逐题生成答案并发布到问题下。
  当用户说"知乎自动答题""帮我答题引流""找个问题回答""批量回答知乎问题""知乎问答"
  "挑几个问题来答"时使用。找题/排队/进度由 scripts/zhihu_auto.py 管，
  **答案正文由 LLM 写**；发布复用共享脚本 zhihu_answer.py（dry-run → --exec）。
layer: publish
---

# 知乎自动答题（zhihu-auto-answer）

> 链路：`find`（Playwright 搜题，带回答数）→ `plan`（低竞争挑题）→ 你逐题写答案 →
> `zhihu_answer.py --exec` 发布 → `mark` 登记进度 → `next` 取下一题。
> 与 skill-zhihu-answer 的分工：那个管**单题**完整流程（选题→写→发）；本 SKILL 管
> **批量自动化**（多题队列、竞争度过滤、进度登记），单题发布机制两者共用。

## 前置

- ZhihuProfile 已登录（没有就先：
  `python skills/openclaw/skill-login-and-publish/scripts/route.py cmd zhihu login-qr --run`）
- `check` 验登录态；搜索必须登录态，否则脚本会拦截提示。

## 执行流程

1. **找题**（用户给关键词，如"露营 装备"）：
   ```bash
   python skills/openclaw/skill-zhihu-auto-answer/scripts/zhihu_auto.py find \
     --q "露营 装备" --limit 12 --out outputs/zhihu/find-camping.json
   ```
   输出 JSON 行：url / title / answers（回答数）/ excerpt。
2. **挑题**（脚本按低竞争排序，回答数少且有搜索价值的优先）：
   ```bash
   … zhihu_auto.py plan --from-file outputs/zhihu/find-camping.json \
     --pick 3 --max-answers 200
   ```
   > 挑题审美：回答数 <200 有曝光机会；>1000 的一般答不过高赞，除非角度极新。
   > 也可以把候选清单给用户人工勾选。
3. **逐题作答（你来做）**：读题页（WebFetch 或 read 问题页要点），写答案存
   `outputs/zhihu_answers/<slug>.md`。知乎答案写法：
   - **先给结论**（知乎用户要快），再分层论证；带个人经验/数据点更有说服力
   - 800~1500 字最佳；别堆表情和营销话术；结尾可自然带一句产品/品牌（软性）
   - 有 Profile 时遵守 persona（skill-persona-check 自查，不阻断）
4. **发布**（先 dry-run 展示，用户确认后 --exec）：
   ```bash
   python skills/shared/scripts/zhihu_answer.py --question <题URL> \
     --content-file outputs/zhihu_answers/<slug>.md --exec
   ```
5. **登记 + 下一题**：
   ```bash
   … zhihu_auto.py mark --url <题URL> --answer-file outputs/zhihu_answers/<slug>.md
   … zhihu_auto.py next    # 进度 + 下一题 + 对应发布命令
   ```

## 规则与红线

1. **单场答题 ≤ 3~5 题**，多题间隔 10 分钟以上（知乎反作弊：连续快答会限流/折叠）。
2. 每篇答案必须**原创成文**，禁止多题复用同一模板（会被判抄袭折叠）。
3. 涉医疗/金融/法律/安全类专业问题：只答科普与通用信息，加"建议咨询专业人士"；
   content_guard 拦下的内容绝不换皮重发。
4. 发布失败（验证码/风控弹窗）→ 停队列，让用户人工过验证后再继续，不要硬重试。
5. 答案里带外链要克制（知乎对外链很敏感，优先不放或放品牌词）。
