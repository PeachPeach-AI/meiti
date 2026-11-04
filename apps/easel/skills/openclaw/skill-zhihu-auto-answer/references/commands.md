# commands.md — 知乎自动答题命令样例

> ZA = `skills/openclaw/skill-zhihu-auto-answer/scripts/zhihu_auto.py`，CWD=项目根。

## 0. 登录态

```bash
python $ZA check     # 调 web_publisher whoami --platform zhihu
# 未登录：
python skills/openclaw/skill-login-and-publish/scripts/route.py cmd zhihu login-qr --run
```

## 1. 找题

```bash
python $ZA find --q "露营 装备" --limit 12 --out outputs/zhihu/find-camping.json
# {"qid":"6632…","url":"https://www.zhihu.com/question/6632…",
#  "title":"有哪些露营装备是新手必买的？","answers":"87","excerpt":"…"}
```
需要登录态；知乎改版抓不到卡片时，改 `zhihu_auto.py` 顶部的滚动/选择器常量。

## 2. 挑题（低竞争优先）

```bash
python $ZA plan --from-file outputs/zhihu/find-camping.json --pick 3 --max-answers 200
# >>> 计划 3 题 → outputs/zhihu/auto-answer-plan.json
#   [ ]     87答  有哪些露营装备是新手必买的？ …
```

## 3. 作答 + 发布（逐题循环）

```bash
# 1) LLM 写答案 → outputs/zhihu_answers/<slug>.md（先结论后论证，800~1500 字）
# 2) dry-run 预检
python skills/shared/scripts/zhihu_answer.py --question <题URL> \
  --content-file outputs/zhihu_answers/<slug>.md
# 3) 用户确认后真发
python skills/shared/scripts/zhihu_answer.py --question <题URL> \
  --content-file outputs/zhihu_answers/<slug>.md --exec
# 首次/选择器疑似失效：加 --headed 目视校验
```

## 4. 登记与进度

```bash
python $ZA mark --url <题URL> --answer-file outputs/zhihu_answers/<slug>.md
python $ZA next        # 进度 n/3 + 下一题 + 对应发布命令
```

## 反风控节奏

| 项 | 建议值 |
|----|--------|
| 单场题数 | ≤ 3~5 题 |
| 两题间隔 | ≥ 10 分钟 |
| 同模板复用 | 禁止（判抄袭折叠） |
| 遇验证码 | 停队列，人工过验证再续 |

## 报错

| 报错 | 处置 |
|------|------|
| 「知乎要求登录才能搜索」 | 先 login-qr 扫码 |
| find 没抓到题 | 换关键词；仍无则知乎改版，改脚本顶部选择器 |
| 发布被折叠 | 降低当日答题量；答案自查是否营销味过重 |
