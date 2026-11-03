# AI 智慧门店 · 自媒体工作站（浏览器版）

把原来的 Electron 桌面壳拆掉，改成**本地浏览器访问**的一套服务：一个门户 + 三个工作台 + 一个本地 AI 网关。适合在 Windows / Linux / NAS 上运行。

## 端口

| 服务 | 端口 | 说明 |
|---|---|---|
| 门户（自媒体工作站 UI + API） | `8080` | 主入口，浏览器打开 |
| Easel AI 创作 | `7866` | 对话、脚本、发布 |
| 图像工作台 | `7867` | Next.js |
| 视频工作台 | `7868` | Next.js |
| OpenClaw 网关 | `18789` | **仅本机内部使用，不要暴露到公网** |

门户默认按当前访问主机的 `:7866/7867/7868` 加载另外三个工作台，所以用 `http://NAS-IP:8080/` 打开时，iframe 也会自动指向 `NAS-IP`，不会错误地去找浏览器本机的 `localhost`。

## 环境要求

- Node.js `24.16+`（或 `26.1+`）；`openclaw` 的硬性要求
- Python **3.11** + `python3-venv`（Easel 的 `app_core.pyc` 按 3.11 编译，3.12+ 可能无法加载）
- ffmpeg
- 首次安装会下载 Playwright Chromium（约 150MB）
- 建议 4GB+ 内存；Easel 的视频/字幕模型按需下载

## 首次安装

```bash
cp .env.example .env
# 编辑 .env，至少填写 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL

npm install
npm run setup          # 安装 Node/Python 依赖、构建 Next、下载 Chromium
npm run init:easel     # 初始化 OpenClaw easel profile（只需一次）
```

> `npm run setup` 时间较长（10–20 分钟，取决于网络）。只想先跑开发模式可以加 `-- --skip-build`，Next 会用 `next dev` 启动。

> AI 对话走网关，只需要根目录 `.env`。Easel 自己的图片/语音等能力读取 `apps/easel/.env`；不用这些能力可以忽略。Docker 部署时如果要用，建议把填好的 `apps/easel/.env` 一起挂载进去。

## 启动

```bash
npm start
```

或：

- Windows：双击 `start.ps1`（需要 Node 在 PATH）
- Linux / NAS：`chmod +x start.sh && ./start.sh`
- Docker：见下一节

启动后浏览器打开：

```
http://<本机或NAS-IP>:8080/
```

日志在 `runtime/logs/`，每个服务一个 `.log` 和 `.err.log`。

## Docker（NAS 推荐）

```bash
cp .env.example .env
# 填写 OPENAI_* 配置

docker compose up -d --build
```

首次构建会在镜像里执行 `npm run setup`，所以镜像比较大（约 3–4GB），但 NAS 只需要构建一次。

```bash
docker compose exec smartstore node scripts/init-easel.mjs   # 首次初始化网关
docker compose logs -f smartstore
```

- 只映射了 `8080/7866/7867/7868`，网关 `18789` 留在容器内部。
- `smartstore-openclaw` volume 保存网关配置，升级容器不会丢。
- `./runtime` 挂载到宿主机，日志和采集产物可直接查看。

## 目录结构

```
apps/
  smartstore/       # 主门户：web 静态 UI + server(API/截流/情报)
  easel/            # AI 创作（Python FastAPI + 已构建前端）
  image-studio/     # 图像工作台（Next.js）
  video-studio/     # 视频工作台（Next.js）
vendor/
  MediaCrawler/     # 截流采集引擎（非商业学习许可证，见下）
scripts/
  setup.mjs         # 首次安装
  init-easel.mjs    # 初始化 OpenClaw 配置
  launch.mjs        # 一键启动全部服务
runtime/            # 运行日志、采集产物（已 gitignore）
```

## 数据与隐私

- 所有运行数据都在 `runtime/`、`apps/smartstore/intercept-data/`、`apps/smartstore/intel-data/`、`vendor/MediaCrawler/browser_data/` 等目录，默认不进 Git。
- `.env`、`auth_tokens.json`、浏览器 profile 都包含敏感信息，**不要提交**。
- 不要把 `7866`/`8080` 直接暴露到公网；NAS 上建议只在内网或 VPN 使用，或加一层带认证的反向代理。

## 截图 / 扫码登录说明

MediaCrawler 在 Windows 上默认走 CDP，可以弹出真实 Chrome/Edge 扫码。NAS 没有桌面，`SS_HEADLESS=1` 时走 Playwright 无头模式，二维码会打印在任务日志里。若平台要求人工过滑块，建议在 Windows 机器上完成登录后，把浏览器 profile 目录复制到 NAS 的对应位置，或改用有桌面的机器运行采集。

## 官网资源发布

- 账号页 → 「官网 Maywide」→ 配置站点地址、后台账号、密码，保存并验证。
- 发布中心 → 勾选「官网·资源」→ 发布。
- 标签里写 `行业报告` / `白皮书` / `指南` / `方案` 可指定资料类型，默认 `行业报告`。
- 正文支持 Markdown/HTML；发布时第一张图片会自动上传并作为封面。
- 发布成功后返回资源页地址，例如 `http://wwws.maywide.com/resources/resource-...`。

## 未包含的大文件

为了仓库可上传，以下内容没有放进 Git，运行时会自动创建或按需下载：

- `apps/easel/models/`：本地 whisper 模型（约 900MB）。不下载时 Easel 会优先用云端 ASR / 视频自带字幕。
- `apps/easel/web/static/showcase/`：约 200MB 演示视频，不影响功能。
- `runtime/`、`intercept-data/`、`intel-data/`、浏览器 profile：运行时数据。
- `node_modules/`、`.venv/`、`.next/`：由 `npm run setup` 重新生成。

## 许可证提醒

`vendor/MediaCrawler` 使用 **NON-COMMERCIAL LEARNING LICENSE 1.1**，仅授权非商业学习用途。用于商业产品前请自行评估并取得授权；本仓库保留其原始 LICENSE，不做二次授权。

Easel 为 Apache-2.0；video-studio 原仓库为 Apache-2.0；其余第三方组件请保留各自 LICENSE。

## 常见问题

- **门户能开，AI 聊天报连接中断**：先看 `runtime/logs/gateway.err.log` 和 `easel.err.log`；通常是网关没起来或 `npm run init:easel` 没执行。
- **图像/视频 iframe 打不开**：确认 `7867/7868` 端口在 NAS 防火墙放行，并且 `SS_MODE=prod` 时已经执行过 `npm run setup` 构建。
- **采集提示缺少 Python 环境**：确认 `vendor/MediaCrawler/.venv` 存在；或设置 `SS_MC_PY` 指向一个已装好 `requirements.txt` 的 Python。
- **改了 `.env` 不生效**：重启 `npm start`；Easel 和网关都需要重新读取环境变量。
