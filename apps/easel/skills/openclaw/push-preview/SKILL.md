---
name: push-preview
description: |
  把当前文章/草稿的微信预览链接推送到企业微信智能机器人、企业微信群机器人或钉钉群机器人。触发场景：用户说“推送到企业微信 / 推送到群里 / 推送预览 / 发到钉钉”。
  标题、链接、备注从当前对话/草稿自动取；配置在「设置 → 推送配置」。
layer: plan
---

# 推送预览链接

## 规则

1. 标题、预览链接、备注从**当前对话/草稿上下文**自动取：
   - 标题：当前文章标题；
   - 链接：`https://mp.weixin.qq.com/s?...tempkey=...` 的预览链接；
   - 备注：可从前文提取（发布时间、审阅要求）；没有就留空。
2. 没有预览链接时先向用户要链接或先完成预览，不要编造 URL。
3. 先判断用户要哪种渠道：
   - “企业微信智能机器人 / 机器人”：走 OpenClaw `wecom-cli`；
   - “企业微信群机器人 / 群机器人”：走 Webhook；
   - “钉钉”：走 Webhook。
   - 没说渠道时，优先智能机器人；没配置或发送失败再问是否用群机器人。

## 企业微信智能机器人

用 OpenClaw 的 `wecom-cli` 工具（不是终端命令）：

1. `wecom-cli message aibot sessions list` 获取机器人最近的单聊/群聊；
2. 按 `chat_name` 精确匹配用户指定的群/人，或按返回顺序选“最近会话”；
3. 用本次返回的 `chat_id` 调 `wecom-cli message aibot send`，`msg_type=markdown`，内容带标题、预览链接、备注；
4. 没有会话时，告诉用户先给机器人发消息或把机器人拉进群。

## 企业微信群机器人

执行：

```bash
python skills/shared/scripts/push_preview.py \
  --config "<当前内容库>/_push.json" \
  --title "<文章标题>" \
  --url "<预览链接>" \
  --note "<备注>" \
  --channels wecom
```

`<当前内容库>` 用对话上下文里的“当前用户内容库路径”。脚本读取设置里的群机器人 Webhook。

## 钉钉

```bash
python skills/shared/scripts/push_preview.py \
  --config "<当前内容库>/_push.json" \
  --title "<文章标题>" \
  --url "<预览链接>" \
  --note "<备注>" \
  --channels dingtalk
```

## 禁止

- 不要把智能机器人的 Bot ID/Secret 当群机器人 Webhook。
- 不要求用户手填标题/链接。
- 不重复群发；失败时说明原因。
