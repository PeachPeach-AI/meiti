# commands.md — 命令样例速查

> `RP = skills/openclaw/skill-login-and-publish/scripts/route.py`，CWD=项目根。
> 所有 `cmd` 默认只打印命令；追加 `--run` 直接执行。发布默认 dry-run，`--exec --run` 才真发。

```bash
RP=skills/openclaw/skill-login-and-publish/scripts/route.py
PY=integrations/Easel/.venv/Scripts/python.exe   # 用项目 venv；route.py 会自动挑

python $RP platforms          # 全部平台 + 后端一览
```

## 查登录态

```bash
python $RP cmd zhihu status --run      # web 平台（含 douyin）：whoami
python $RP cmd bilibili status --run   # bili_upload check（biliup + cookie）
python $RP cmd wechat-oa status --run  # weixin_mp_stats.py whoami
```
小红书无 whoami 子命令：看 Web「账号页」小红书卡片；官网看账号页「验证」按钮。

## 登录

```bash
# 小红书：Windows 自动静默改有头（headless 会被判「IP 存在风险 300012」）
python $RP cmd xiaohongshu login --run
# 抖音：headless 出二维码；触发短信验证时把验证码写 outputs/_login/douyin.code
python $RP cmd douyin login --run
# web 平台 headless 抠二维码（zhihu/kuaishou/weixin-channels/weibo/toutiao/baijiahao/sohu）
python $RP cmd zhihu login-qr --run
```
二维码输出固定 `outputs/_login/<platform>.png`，状态 JSON `outputs/_login/<platform>.status.json`
（Web 账号页轮询展示）。扫码前不要关闭浏览器窗口。

## 发布（先 dry-run 预览，用户确认后加 --exec --run）

```bash
# 小红书图文（图片绝对路径，逗号分隔；自动识别 mp4 → publish-video）
python $RP cmd xiaohongshu publish --title "标题(≤20全角)" \
  --content "正文…" --media "D:/out/a.png,D:/out/b.png" --tags "话题1,话题2" --exec --run
# 小红书视频：--media 换成单个 mp4 即可
python $RP cmd xiaohongshu publish --title "…" --content "…" --media "D:/out/v.mp4" --exec --run

# 抖音（异步发布：真跑后要轮询 outputs/_login/douyin.status.json / Web 状态）
python $RP cmd douyin publish --title "…" --content "…" --media "D:/out/v.mp4" --exec --run

# 知乎专栏文章（无需媒体；正文走 --content）
python $RP cmd zhihu publish --title "标题" --content "正文…" --exec --run

# 快手/视频号/微博等（--media 可多个）
python $RP cmd kuaishou publish --title "…" --content "…" \
  --media "D:/out/v.mp4" --tags "#话题1,#话题2" --exec --run
```

## 直连脚本（route.py 不覆盖的场景）

```bash
PY=integrations/Easel/.venv/Scripts/python.exe
# bilibili 投稿（biliup；登录/分区见 skill-bilibili-upload）
python skills/openclaw/skill-bilibili-upload/scripts/bili_upload.py login --cookie cookies.json
python skills/openclaw/skill-bilibili-upload/scripts/bili_upload.py upload \
  --video out.mp4 --title "…" --partition 知识 --tag "AI,教程" --exec

# 公众号（登录态 + 发布到草稿箱，委派 skill-wechat-publisher）
python $PY skills/shared/scripts/weixin_mp_stats.py whoami
python skills/openclaw/skill-wechat-publisher/scripts/publish.py --input article.md

# 自建站 CMS（账号在 outputs 所在用户的 cms_accounts.json；可用 env EASEL_CMS_ACCOUNTS 指定）
python $PY skills/shared/scripts/cms_publish.py --platform wordpress \
  --accounts integrations/Easel/data/users/<uid>/cms_accounts.json \
  --title "标题" --content-file draft.md --tags "a,b"

# 官网·资源（maywide）：走 Easel 本机 API，需登录 token
curl -X POST http://127.0.0.1:7866/api/maywide/publish \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"标题","body":"Markdown/HTML","media":["outputs/x.png"],"tags":"行业报告"}'
```

## 排障

| 症状 | 处置 |
|------|------|
| 小红书「IP 存在风险 300012」 | Windows 已默认有头登录；仍报则换干净 IP/关代理（`--no-proxy`） |
| 二维码扫码后仍「未登录」 | 登录态目录坏：删 `~/.easel-browser-profiles/<Platform>Profile` 重扫 |
| 选择器失效（页面改版） | 只改共享脚本顶部 PLATFORMS/SELECTORS 字典，先 `--headed` 观察 |
| GBK 打印 emoji 崩溃 | 共享脚本与 route.py 已强制 UTF-8；直连脚本时设 `PYTHONUTF8=1` |
| 媒体不存在 | 路径必须绝对路径，或 outputs/ 相对路径；route.py 会提前报错 |
