# 分镜视频制作助手

这是一个 Chrome/Edge Manifest V3 浏览器插件，用于把 Video Studio 导出的分镜项目半自动搬到豆包 Web 端。

它不让豆包读取 OSS/COS 链接，而是：

1. 导入项目 JSON。
2. 选择项目和镜头。
3. 复制该镜头的豆包视频提示词。
4. 下载该镜头关键帧组图和关键帧。
5. 尝试把关键帧组图或首个关键帧复制为图片，方便在豆包输入框 `Ctrl+V`。

## 安装

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions` 或 `edge://extensions`。
3. 打开“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本目录：`extensions/doubao-shot-helper`。

## 使用流程

1. 在主站镜头卡片点击“导出本镜头”，得到 `shot-001-doubao.json`。也兼容历史记录导出的 `video-studio-projects.json`。
2. 点击浏览器插件图标。
3. 点击“导入”，选择 JSON。
4. 选择项目和镜头。
5. 点击“复制提示词”。
6. 点击“下载本镜头图片”，或点击“复制关键帧组图 / 复制首帧图”。
7. 打开豆包视频生成页，把图片上传或粘贴进去，再粘贴提示词。

## 它如何知道哪个镜头对应哪些图

插件只读取 JSON，不猜文件名，也不识别图片内容。

优先推荐主站“导出本镜头”产生的 `doubao-shot-package`。插件读取：`type`、`shotId`、`order`、`prompt`、`sheet.url`、`keyframes[].timeSec`、`keyframes[].url`。\n\n它也兼容主站历史记录导出的项目 JSON：每个项目有 `shots`，每个镜头里有：

- `order`：镜头顺序
- `imageUrl`：关键帧组图 URL
- `keyframes`：关键帧数组
- `keyframes[].timeSec`：关键帧对应的时间点，可以是 0、2.5、6 这类小数秒
- `keyframes[].imageUrl`：关键帧图片 URL

插件会把它标准化成：

```text
镜头 order + 1
关键帧组图：shot.imageUrl
关键帧列表：按 shot.keyframes[].timeSec 从小到大排列
每张关键帧：shot.keyframes[].imageUrl
```

下载时会按这个规则保存：

```text
video-studio/{项目名}/shot-001/shot-001-sheet.jpg
video-studio/{项目名}/shot-001/shot-001-kf-0.jpg
video-studio/{项目名}/shot-001/shot-001-kf-2p5.jpg
video-studio/{项目名}/shot-001/shot-001-kf-6.jpg
```

## 权限说明

- `storage`：保存上次导入的项目 JSON。
- `downloads`：下载当前镜头图片。
- `clipboardWrite`：复制提示词或图片到剪贴板。
- `<all_urls>`：从 OSS/COS/CDN 图片链接拉取图片 Blob，用于复制图片。

## 限制

- 豆包 Web 端是否支持一次粘贴多张图片，取决于豆包页面本身。
- “复制图片”可能受浏览器剪贴板限制影响；失败时用“下载本镜头图片”再手动上传最稳。
- 插件当前不自动点击豆包页面，也不自动提交任务，避免豆包网页改版导致失效。