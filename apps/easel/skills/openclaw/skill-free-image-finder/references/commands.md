# commands.md — 免费无水印图检索命令样例

> 脚本：`skills/openclaw/skill-free-image-finder/scripts/fetch_images.py`，CWD=项目根。
> 纯标准库实现，无第三方依赖；有 PIL 时会做最小宽度校验（建议装 Pillow）。

## 配 Key（可选，二选一即可用）

```powershell
# PowerShell 当前会话
$env:PEXELS_API_KEY  = "…"     # https://www.pexels.com/api/ （免费，质量最高）
$env:PIXABAY_API_KEY = "…"     # https://pixabay.com/api/docs/
$env:UNSPLASH_ACCESS_KEY = "…" # https://unsplash.com/developers
# 没配任何 Key：自动用 Openverse（免 Key，CC 可商用许可）
```

## 预览候选（不下载）

```bash
PY=integrations/Easel/.venv/Scripts/python.exe
python $PY skills/openclaw/skill-free-image-finder/scripts/fetch_images.py search \
  -q "户外露营 装备" --limit 12
# 每行一个 JSON：no/title/url/width/height/creator/license/page_url/source
```

## 下载

```bash
# 默认 outputs/images/，共 3 张，宽 ≥1280 过滤
python $PY …/fetch_images.py download -q "户外露营 装备" --count 3

# 自定义目录 + 更高分辨率门槛 + 关闭来源偏好固定 openverse
python $PY …/fetch_images.py download -q "露营 夜晚 灯" \
  --count 5 --min-width 1600 --source openverse --out outputs/article-camping
```

输出三段：
```
[下载] <文件名> | <宽x高> | <来源> | <许可> | 作者: <名字> | <来源页>
img_path: outputs/article-camping/camping-01.jpg   ← 直接给发布脚本引用
# N 张已存 …；授权清单 …/attribution.txt           ← 记录作者+许可
```

## 常见问题

| 现象 | 处置 |
|------|------|
| 「所有来源都失败」一次全挂 | 网络/代理问题；重跑；或 `--source openverse` 单测一层看报错 |
| openverse 429 限流 | 稍等几分钟；或配了 Key 的平台走 auto |
| 结果都是不相关内容 | 换关键词（英文关键词命中率更高）；加 `--source` 换平台 |
| 图下载下来打不开 | 已自动跳过（魔法字节校验）；换 `search` 里的下一张 |
| 找品牌/公司 Logo | 不用本 SKILL——有侵权风险；改 ai-image-gen 或官渠道自取 |
