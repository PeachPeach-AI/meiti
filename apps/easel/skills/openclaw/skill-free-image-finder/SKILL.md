---
name: skill-free-image-finder
description: >-
  公网找无水印图片：按关键词从正规开放图库 API（Openverse 免 Key / Pexels / Unsplash /
  Pixabay）检索并批量下载授权可用的无水印原图，自动生成 attribution.txt 授权清单。
  当用户说"找图""帮我配几张图""无水印""免费图库""图片素材下载""搜一张**的图"
  "给文章/笔记/资源配图"时使用。不爬搜索引擎（结果混水印），分辨率过滤 + 许可过滤双层防线。
layer: content
---

# 免费无水印图检索（free-image-finder）

> 从**开放图库 API**取图（CC/平台许可，就是为无水印可商用设计的），下载原图 +
> 记录授权信息。引擎脚本：`scripts/fetch_images.py`（纯标准库，无第三方依赖）。

## 来源与许可

| 来源 | Key | 许可 | 备注 |
|------|-----|------|------|
| pexels | `PEXELS_API_KEY` | Pexels License（可商用免署名） | **国内推荐**，免费申请即用 |
| pixabay | `PIXABAY_API_KEY` | Pixabay Content License | 国内可达 |
| unsplash | `UNSPLASH_ACCESS_KEY` | Unsplash License | 国内可达 |
| openverse | **不需要** | CC0 / CC BY / CC BY-SA | 无 Key 可用；但国内直连常超时，需代理 |

`--source auto`（默认）：pexels → pixabay → unsplash → openverse，缺 Key/失败自动跳下一个。
Key 二选一方式：环境变量，或 `config/keys.json`（模板见 `config/keys.json.example`）：

```json
{"pexels": "你的Key", "pixabay": "", "unsplash": ""}
```

**国内网络注意**：实测 api.pexels.com / pixabay.com / api.unsplash.com 可达，
api.openverse.org / commons.wikimedia.org 直连超时。没有 Key 时挂系统代理环境变量
（`https_proxy`）即可用 openverse；建议直接免费申请一个 Pexels Key（1 分钟下签）。

## 用法

```bash
python skills/openclaw/skill-free-image-finder/scripts/fetch_images.py search \
  -q "露营 灯光 夜晚" --limit 12            # 预览候选（JSON 行，含许可/作者）
python … fetch_images.py download \
  -q "露营 灯光 夜晚" --count 3 --min-width 1280   # 真下载 → outputs/images/
```

输出（`img_path:` 每行可发布脚本直接引用）：

```
[下载] camping-01.jpg | 1920x1279 | openverse | CC0 1.0 | 作者: John
img_path: outputs/images/camping-01.jpg …
授权清单自动追加到 outputs/images/attribution.txt（发布页脚/来源标注时引用）。
```

## 无水印的三层防线

1. **只走图库 API**，不碰搜索引擎快照（那是水印的重灾区）。
2. `--min-width`（默认 1280）过滤低分辨率小图——水印 logo 常混在小图里。
3. 许可过滤（openverse 限定 commercial 级 CC 许可；四个来源逐条记录作者+许可）。

⚠️ 仍要求发布前**目视抽查**：图片内容与文案是否契合、许可是否合用户预期；
发布官网资源时把 attribution.txt 里的作者与许可写进正文的「图片来源」一行更稳妥。

## 边界（什么时候不用本 SKILL）

- 找**品牌 Logo / 公司官网配图 / 竞品产品图**：用 **ai-image-gen** 或引导用户从官方渠道
  自取。「公网找图」拿他人品牌素材有侵权风险，明确告知用户这一边界。
- 成键时效性新闻图：向用户确认只能用 CC 授权的可替代图，或改 AI 生成。
- 生成式配图走 **ai-image-gen**（也是无水印，且原创）；本 SKILL 擅长**真实照片**。

## 规则

1. `search` 先看候选再 `download`；下载张数默认 3，别一次性拉几十张。
2. 商用内容默认要求许可可商用（脚本已内置过滤）；用户明确只为内部预览时可以放宽提示但仍记录。
3. 下载产物写 outputs/，**不要改动 attribution.txt 已有行**，只追加。
4. 网络受限时：openverse 在国内直连超时最常见——`--source` 换 pexels/pixabay/unsplash，
   或临时设 `$env:https_proxy="http://127.0.0.1:7897"` 走代理。此外 openverse 限流(429)
   等几分钟再试。
