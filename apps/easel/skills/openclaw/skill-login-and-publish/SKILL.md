---
name: skill-login-and-publish
description: >-
  账号登录与自动发布总入口：一个 SKILL 覆盖所有已支持平台的「查登录态 → 扫码/有头登录 →
  自动发布」全流程。用户说"登录小红书""登录知乎/快手/微博/头条""帮我发出去""直接发布"
  "登录后自动发""发到官网/WordPress"等时使用。按平台路由到对应确定性脚本
  （xhs_publish / douyin_publish / web_publisher / bili_upload / weixin_mp_stats /
  cms_publish / 官网 API），命令由 scripts/route.py 生成，不用记各脚本参数。
layer: publish
---

# 账号登录与自动发布（login-and-publish）

> 一个入口管全部平台：**查登录态 → 登录（扫码/有头） → 自动发布**。
> 命令生成与执行统一走 `scripts/route.py`（CWD=项目根），底层脚本见表格。
> **内容适配仍委派各平台 publisher SKILL；本 SKILL 负责登录态与发布执行。**

## 平台 → 后端路由

| 平台 | 登录方式 | 发布执行 | 备注 |
|------|----------|----------|------|
| xiaohongshu | 扫码（Windows 自动静默改有头） | `xhs_publish.py publish/publish-video` | Windows 上 headless 会被判「IP 存在风险」，已默认有头 |
| douyin | 扫码（可能触发短信验证） | `douyin_publish.py publish/publish-video` | 返回异步，需轮询状态 |
| kuaishou / weixin-channels / zhihu / weibo / toutiao / baijiahao / sohu | 扫码 `login-qr`（二维码抠图给前端） | `web_publisher.py publish` | 统一 Playwright 引擎，逐平台选择器在脚本 PLATFORMS |
| bilibili | TV 端扫码 API（segno 出码） | `skill-bilibili-upload/scripts/bili_upload.py upload` | biliup cookie，见该 SKILL |
| wechat-oa（公众号） | 公众号后台扫码 | `skill-wechat-publisher`（publish.py，稿件箱） | 只到草稿箱，不自动群发 |
| wordpress / typecho | 账号密码（无扫码） | `cms_publish.py --platform … --accounts …` | 账号存 `cms_accounts.json` |
| maywide（官网·资源） | 账号密码（Easel 账号页「验证」） | `POST /api/maywide/publish`（Easel 本机 7866） | 标签指定资料类型 |

未部署后端的平台：**先告知用户，不硬试。**

## 执行流程

1. **解析意图**：
   - "登录 / 扫码 / 换账号" → `route.py cmd <platform> login`（QR 出到 `outputs/_login/<platform>.png`，前端可见）。
   - "现在登录态还活着吗 / 谁登录着" → `route.py cmd <platform> status`。
   - 已给标题+正文/媒体 → 走发布流程（先预检再执行）。
   - 信息不全 → 先补齐（标题/正文/媒体路径），**不要擅自发布**。

2. **生成并执行命令**：
   ```bash
   # 例：知乎登录（headless 二维码抠图）
   python skills/openclaw/skill-login-and-publish/scripts/route.py cmd zhihu login-qr
   # 加 --run 直接执行；不带 --run 只打印命令行
   python <skill>/scripts/route.py cmd kuaishou publish --title "标题" \
     --media outputs/a.mp4 --tags "#话题1,#话题2" --exec --run
   ```
   `route.py` 会把各脚本的别名参数（--content/--desc/images→video、媒体逗号串）转换成
   对应脚本的真实参数，并校验媒体文件存在（必须是**绝对路径**或相对 `outputs/`）。

3. **发布前三件事**：
   - `publish` 默认 dry-run；**只有用户确认最终内容后才允许加 `--exec --run`**。
   - 有 Profile 时先跑 skill-persona-check（评分喂 `persona_gate.py check --score 85`），
     低于 80 分告知分数与修改建议，**不阻断**用户明确要求的发布。
   - 首次发布或疑似改版：先 `--headed` 目视校验选择器。

4. **发布后留痕**（publisher 脚本在 `--exec` 成功时已自动落「内容日历 + skill-publish-log」，
   无需手动补记；如需补 `--persona-score` 等元数据再调 skill-publish-log）。
   登录失败/IP 风险的排障话术见 [references/commands.md](references/commands.md)。

## 规则

1. **媒体必须有**：xhs/douyin/kuaishou/channels/weibo 等发布不能空媒体（知乎专栏文章除外）。
2. Windows 上小红书登录固定有头（脚本已兜底）；扫码窗口在用户确认扫码完成前**不要关闭**。
3. 抖音若触发短信验证，把验证码写入 `outputs/_login/douyin.code` 后重试，或引导用户在 UI 输入。
4. 禁止把 Cookie/账号/令牌写进本 SKILL 或提交入 Git；登录态只在 `~/.easel-browser-profiles/`。
5. 逐平台的具体命令样例与参数细节见 **[references/commands.md](references/commands.md)**；
   发布内容适配见各平台 publisher SKILL（skill-xhs-publisher / skill-kuaishou-upload / …）。
