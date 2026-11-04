---
name: skill-channel-rewrite
description: >-
  母渠道 → 子渠道内容改写：把官网/公众号（母渠道）的成稿改写成小红书、抖音、B站、知乎、
  头条、微博等子渠道版（标题/正文字数与风格按渠道重配，数据点不丢）。当用户说
  "母渠道发完发子渠道""改写成小红书版/抖音版/知乎版""按渠道出稿""母稿分发""一稿改多渠道"时使用。
  本 SKILL 管：渠道约束注册表 + 改写任务清单 + 超限校验 + 变体归档；实际发布委派
  skill-cross-platform-publish / skill-login-and-publish。
layer: produce
---

# 母渠道 → 子渠道 内容改写（channel-rewrite）

> 母稿（官网·资源 / 公众号文章）作为**唯一事实源**，逐渠道重写为子版；
> `scripts/channel_rewrite.py` 固化各渠道字数与风格约束、生成改写清单、校验、归档；
> **动笔改写由你（LLM/Agent）完成**。发布执行走 skill-login-and-publish。

## 流程

1. **确定母稿**：让用户给出母稿（或先由 skill-wechat-publisher / 官网·资源流程产出）。
   长文若在飞书，用 skill-feishu-docs `read --doc <链接>` 直接取回。
2. **生成改写清单**：
   ```bash
   python skills/openclaw/skill-channel-rewrite/scripts/channel_rewrite.py plan \
     --master outputs/article.md --channels xiaohongshu,douyin,zhihu --out outputs/rewrite/plan.json
   ```
   `platforms` 子命令可先看渠道注册表（标题/正文限、风格基调）。
3. **逐渠道改写（你来做）**，清单里每个渠道有 llm_checklist：
   - 标题 ≤ 限额（抖音正文≤55、小红书标题≤20 是硬红线）
   - 风格贴合渠道生态（小红书口语+emoji、知乎先答案后论证、B站梗、微博短段+#话题#）
   - **母稿的数据点/结论一个不丢**，营销腔删减；结尾按渠道给转化引导
4. **校验**：`check --platform xiaohongshu --file 草稿.md`（超限即退出码 1，改到过为止）。
5. **归档**：`save --platform xiaohongshu --file 草稿.md --master-id 某文章` →
   `outputs/rewrite/<母稿>/xiaohongshu.md` + manifest.json（时间戳索引）。
6. **发布**（用户确认后）：按变体文件喂 skill-login-and-publish（带 --exec）；此处不自动发布。

## 与其他 SKILL 的分工

- **一稿同发 / 全平台适配发布** → skill-cross-platform-publish（含 video-reframe 路由）
- **单个平台登录+发布** → skill-login-and-publish
- **本 SKILL**：只做「母→子」**改写**与约束管理，不碰发布
- 与 skill-content-repurposing 的边界：repurposing 是把任意来源（视频/外部文章）改成
  多平台内容；本 SKILL 是以**己方母渠道成稿**为基准的渠道分发改写，有归档与母稿追溯。

## 规则

1. 母稿是唯一事实源：子渠道数字/结论必须与母稿一致，**不许演绎新数据**。
2. 每个渠道产出独立文件并 `save` 归档；不要把改写稿直接覆盖母稿。
3. 内容安全闸（content_guard）在母稿已过；子渠道改写**不得**改写医生/金融/承诺类表述。
4. 涉及平台的红线：**先复述渠道限制与本次加话题数等的选择，再动笔**；用户确认后落稿。
