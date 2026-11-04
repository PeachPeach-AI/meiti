# commands.md — 飞书文档命令样例

> FD = `skills/openclaw/skill-feishu-docs/scripts/feishu_docs.py`，CWD=项目根。
> 凭证：`--app-id/--app-secret` > 环境变量 `FEISHU_APP_ID/FEISHU_APP_SECRET` >
> `data/users/*/outputs/_push.json`（脚本自动搜索，与 skill-feishu-bitable 同源）。

## 授权（首次）

缺 `docx:document` scope 时脚本输出：
```
ERROR: HTTP 400 … 应用尚未开通所需的应用身份权限：[docx:document, docx:document:create]，
点击链接申请并开通任一权限即可：https://open.feishu.cn/app/<cli_xxx>/auth?q=docx:document,…
```
把这条链接**原样发给用户**（需应用管理员点同意，自建应用免疫审核），随后重跑。

## 校验与基础操作

```bash
PY=integrations/Easel/.venv/Scripts/python.exe
python $PY $FD check

# Markdown → 新文档（正文来自 outputs/ 文件）
python $PY $FD create --title "十月内容复盘" --file outputs/十月复盘.md --open-read
# >>> 已创建飞书文档：https://feishu.cn/docx/doxcnXXXX

# 小段文案直接给文本
python $PY $FD create --title "今日热点速记" --text "# 标题`n- 要点1`n- 要点2"

# 追加到已有文档
python $PY $FD append --doc "https://feishu.cn/docx/doxcnXXXX" --file outputs/补充.md

# 读回（近似 Markdown 输出：标题/列表/引用/代码结构与创建时一致）
python $PY $FD read --doc "https://feishu.cn/docx/doxcnXXXX"

# 组织内可读 / 删除（仅测试清理或用户明确要求）
python $PY $FD permission --doc "https://feishu.cn/docx/doxcnXXXX"
python $PY $FD delete --doc doxcnXXXX
```

## 常见错误

| 报错 | 处置 |
|------|------|
| 99991672 缺 scope | 脚本会把开通链接打全——发给用户点授权，权限为 `docx:document` |
| 缺 App ID/Secret | 让用户在 Web 端账号配置（bitable 同一页保存），或给环境变量 |
| token 且 401 | token 过期自动刷新；持续 401 检查应用「可用范围」是否包含操作者 |
| 代码块/图片显示不对 | 图片块暂不支持（会变纯文本）；需图片时提示先在飞书手动插 |
