---
name: skill-feishu-docs
description: >-
  飞书云文档接入：把 Markdown 创建/追加成飞书文档、读回文档正文、设权限、删除。
  当用户说"发到飞书文档""写进飞书""同步到飞书""飞书里建一篇""把文章放飞书 co-author"
  "读一下飞书这篇文档"时使用。凭证走项目既有约定（_push.json / 环境变量），
  与 skill-feishu-bitable 共用同一套应用身份（区别：本 SKILL 管**文档**，bitable 管表格）。
layer: produce
---

# 飞书云文档（feishu-docs）

> 应用身份（tenant_access_token）调飞书 Open API：
> **create**（Markdown → 新文档）/ **append**（追加到已有文档）/ **read**（全文取回）/
> **permission**（组织内可读）/ **delete**（移入回收站）/ **check**。
> Markdown 结构（# 标题、列表、引用、代码块）转成对应飞书块；图片块暂不支持。

## 前置（首次授权一次即可）

- 复用 skill-feishu-bitable 的自建应用凭证：`data/users/<uid>/outputs/_push.json`
  （Web 端账号配置保存）或 `FEISHU_APP_ID / FEISHU_APPSECRET` 环境变量。
- 应用需要 **`docx:document`** 权限（读写文档）；缺权限时脚本会直接给出
  「一键开通」链接，让用户（应用管理员）点击同意后重试。
- 验证：`python skills/openclaw/skill-feishu-docs/scripts/feishu_docs.py check`

与 bitable 的分工：**bitable = 多维表格（结构化行）**；**本 SKILL = 云文档（长文排版）**。
内容日历登记走 bitable，文章母稿/周报走本 SKILL。

## 用法

```bash
FD=skills/openclaw/skill-feishu-docs/scripts/feishu_docs.py
python $FD check                                   # 凭证 + 权限自检
python $FD create --title "十月复盘" --file outputs/article.md --open-read
#    产出 >>> 已创建飞书文档：https://feishu.cn/docx/<token>（写进回复）
python $FD append --doc "https://feishu.cn/docx/xxxx" --file outputs/append.md
python $FD read --doc "https://feishu.cn/docx/xxxx"   # 全文文本返回（近似 Markdown）
python $FD delete --doc <token>                    # 移入回收站（测试清理用）
```

`--doc` 接受链接或裸 token；`create` 可加 `--folder-token` 指定归档目录。

## 与其他 SKILL 的衔接

- **母稿入飞书**：官网/公众号成稿 → `create` 归档，客户协作评审。
- **改写素材取回**：skill-channel-rewrite 前先 `read` 飞书母稿；
- **表格登记**：发布状态仍走 skill-feishu-bitable（文档链接写进表里）。
- 凭证与 Agent 平台发布无关；**不要把 App Secret 写进任何输出**。

## 规则

1. `create` 前确认标题——文档标题建错只能手动改。
2. `delete` 只用于**测试产物/用户明确要求**的删除，成功稿不回收。
3. 权限报 99991672（缺 scope）→ 把脚本输出的开通链接**原样**给用户点，不要绕。
4. 大文档分块追加（脚本内置 45 块/批 + 限速）；失败重试续 append 即可。
