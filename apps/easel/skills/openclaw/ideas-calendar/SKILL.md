---
name: ideas-calendar
description: |
  选题库与内容日历写入工具。用于把选题写入选题库、把内容排期写入内容日历，保证字段和文件格式能被前端直接读取。
  触发场景：用户提到“选题库 / 选题池 / 加选题 / 排期 / 内容日历 / 日历 / 发布计划”，或要求把已生成的文章计划、选题清单、排期表落库时。
  默认只写选题和内容排期，不要自动生成发布前/成稿提醒，也不要创建 event 记录，除非用户明确要求。
layer: plan
---

# 选题库与内容日历

## 必须遵守

1. 文件必须写到**当前用户内容库**（对话上下文里的“当前用户内容库路径”），不是 Agent 工作区根目录。
   - 选题库：`<内容库>/_ideas.json`
   - 内容日历：`<内容库>/_schedule.json`
2. 两个文件都必须是 **JSON 数组**，不要写 `{"version": ..., "entries": [...]}` 包装。
3. 先读现有数组，合并/更新，不要直接覆盖别人的记录；新记录补 `id`。
4. 平台名直接用中文（如 `公众号`、`小红书`、`抖音`），日期用 `YYYY-MM-DD`，时间用 `HH:MM`。
5. **只写 `kind: content` 的内容排期，不生成提醒/event**。用户没有明确要求提醒时，不要创建任何 `event` 记录。

## 选题库 `_ideas.json`

数组元素：

```json
{
  "id": "idea-1",
  "title": "选题标题",
  "note": "角度/素材/目标用户",
  "source": "AI/对话",
  "status": "pending"
}
```

`status` 只能是：`pending`（待做）、`doing`（进行中）、`done`（已完成）。

## 内容日历 `_schedule.json`

数组元素：

```json
{
  "id": "sch-1",
  "title": "文章标题",
  "date": "2026-10-22",
  "platform": "公众号",
  "time": "20:00",
  "status": "idea",
  "note": "备注",
  "kind": "content",
  "source": "chat"
}
```

- `status`：`idea`（选题）、`draft`（草稿）、`scheduled`（待发）、`published`（已发）。
- `kind` 固定为 `content`。
- 不再生成 `event`、`event_type`、`end_date`、`repeat` 等提醒字段。

## 工作流

1. 读取当前内容库的 `_ideas.json` / `_schedule.json`；不存在就从 `[]` 开始。
2. 生成/补齐记录，按 `id` 或 `title+date` 去重。
3. 写回**数组**，UTF-8，缩进 2。
4. 回报：写入了多少条选题、多少条内容排期，以及两个文件的绝对路径。

## 禁止

- 不写 `{version, entries}` 对象。
- 不把选题/日历写到 Agent 工作区根目录后就算完成。
- 不用 `scheduled_at`、`publish_date` 等替代字段；日期字段就是 `date`。
- 不覆盖已有文件里的其他记录。
- 不自动生成“发布前提醒 / 成稿提醒 / 事件”等 event 记录。
