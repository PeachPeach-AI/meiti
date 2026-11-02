# Video Studio

AI 视频创作工作台，面向“剧本 -> 分镜 -> 参考图 -> 视频生成”的本地协作流程。当前项目基于 Next.js App Router、React、Tailwind CSS 和 Zustand。

## 快速开始

```bash
npm install
npm run dev
```

默认访问：`http://localhost:3000`

## 常用命令

```bash
npm run dev        # 本地开发
npm run build      # 生产构建
npm run start      # 启动生产服务
npm run typecheck  # 独立 TypeScript 检查
npm run lint       # ESLint 检查`r`nnpm run test:e2e   # Playwright 浏览器验收（需先启动 dev 或 start 服务）
```

## API 配置

应用支持分别配置文本、图片、视频三个 API：

- 文本接口需要兼容 `/v1/chat/completions`
- 图片接口需要兼容 `/v1/images/generations`
- 视频接口需要兼容 `/v1/video/generations`
- 模型列表使用 `/models`

设置面板提供“连接测试”和“刷新模型”按钮。公网部署时建议使用可信 API 域名，并配置代理安全策略。

### API Key 隐私边界

客户在浏览器中自行填写自己的 API Key。应用不会把 API Key 写入数据库或服务端文件；Key 只会在调用 `/api/proxy` 时随本次请求转发给模型服务。

“仅本机保存接口配置”默认关闭。关闭时，API Key 不会写入浏览器本地存储；开启后，API Key 仅保存在当前浏览器的 localStorage，用于下次打开时恢复配置，不上传服务器。

## API 代理安全

`/api/proxy` 默认禁止访问 localhost、内网地址、链路本地地址和带账号密码的 URL。

可选环境变量：

```bash
ALLOWED_API_PROXY_HOSTS=api.example.com,openai.example.com
ALLOW_PRIVATE_API_PROXY=false
```

说明：

- `ALLOWED_API_PROXY_HOSTS` 非空时，只允许代理这些 hostname。
- `ALLOW_PRIVATE_API_PROXY=true` 会允许内网/本机地址，仅建议本地开发或受控内网部署使用。

## OSS 上传配置

应用支持前端填写 OSS 信息，也支持服务端环境变量接管签名。公网部署建议使用服务端环境变量，避免在浏览器 localStorage 中保存云存储密钥。

```bash
OSS_PROVIDER=aliyun
OSS_ACCESS_KEY=xxx
OSS_ACCESS_SECRET=xxx
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://your-bucket.oss-cn-hangzhou.aliyuncs.com
OSS_CUSTOM_DOMAIN=https://cdn.example.com
OSS_UPLOAD_DIR=video-studio/
```

`OSS_ENDPOINT`、`OSS_CUSTOM_DOMAIN`、`OSS_UPLOAD_DIR` 可选。

## 本地数据

工作区数据通过 Zustand persist 保存到 localStorage，key 为 `video-studio`。设置面板可关闭：

- 保存接口配置
- 保存创作内容

持久化数据带版本迁移，旧数据会自动补齐新字段。

## 项目导入导出

历史记录面板支持：

- 按有视频/无视频过滤
- 重命名项目
- 导出单个项目 JSON
- 导出全部项目 JSON
- 导入项目 JSON
- 移除单个镜头的参考图或视频记录

## 浏览器级验收`r`n`r`n先启动服务：`r`n`r`n```bash`r`nnpm run dev`r`n``` `r`n`r`n再运行：`r`n`r`n```bash`r`nnpm run test:e2e`r`n``` `r`n`r`n当前 E2E 覆盖桌面工作区渲染、手动添加镜头、移动端 1/2/3 流程导航和横向溢出检查。`r`n`r`n## 部署建议

1. 使用 `npm run typecheck` 和 `npm run build` 验证。
2. 公网部署时配置 `ALLOWED_API_PROXY_HOSTS`。
3. 公网部署时优先使用服务端 OSS 环境变量。
4. 不建议把真实 API Key 写入源码或提交到版本库。
## 浏览器插件

顶部工具栏的“插件”按钮会下载 `doubao-shot-helper.zip`。

使用方式：

1. 点击“插件”下载压缩包。
2. 解压 `doubao-shot-helper.zip`。
3. 打开 Chrome/Edge 扩展程序页面，启用开发者模式。
4. 选择“加载已解压的扩展程序”，加载解压后的 `doubao-shot-helper` 文件夹。
5. 在主站镜头卡片点击“导出本镜头”，把得到的 `shot-xxx-doubao.json` 导入插件。
## 关键帧逻辑

关键帧不是固定“每秒一张”。每个镜头可以设置关键帧数量，默认 4 帧；系统按镜头时长平均分布时间点，也允许手动调整每个关键帧的时间点，例如 `0s / 2.5s / 6s`。

参考图和关键帧是增强控制项，不是必选项。只用剧本拆解出的镜头提示词也可以直接生成视频。