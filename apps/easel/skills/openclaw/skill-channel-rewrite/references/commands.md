# commands.md — 母/子渠道改写命令样例

> CR = `skills/openclaw/skill-channel-rewrite/scripts/channel_rewrite.py`，CWD=项目根。

## 渠道注册表

```bash
python $CR platforms
# 渠道            名称           标题      正文     风格/备注
# site            官网（母渠道）  70       50000   长文母版：官网·资源 …
# wechat-oa       公众号（母渠道）64       50000   正式叙述母版 …
# xiaohongshu     小红书         20       1000    口语+emoji+钩子首句 …
# douyin          抖音           55       55      前 5 秒钩子，短平快 …
# bilibili        B站           80       8000    梗+分段小标题 …
# zhihu           知乎           70       5000    专业长文，先答案后论证 …
# weibo           微博           -        2000    只改正文，短段+#话题# …
# kuaishou / weixin-channels / toutiao / baijiahao / sohu …
```

## 生成改写清单（给 LLM 的逐渠道 checklist）

```bash
python $CR plan --master outputs/article.md \
  --channels xiaohongshu,douyin,zhihu,weibo --out outputs/rewrite/plan.json
```

输出（每渠道）：标题/正文限额、风格基调、四条改写 checklist。改写由 Agent 依清单落稿。

## 校验改写稿

```bash
python $CR check --platform xiaohongshu --file outputs/rewrite/xhs-draft.md
# {"ok":true,"platform":"xiaohongshu","title_chars":16,"body_chars":682, "limits":{…}}
# 超限 → ok:false 且退出码 1（据 problems 逐条改稿再 check）
```

## 归档

```bash
python $CR save --platform xiaohongshu --file outputs/rewrite/xhs-draft.md \
  --master-id 秋季露营攻略
# >>> 已归档 outputs/rewrite/秋季露营攻略/xiaohongshu.md
# >>> 索引   outputs/rewrite/秋季露营攻略/manifest.json
# variant_path: outputs/rewrite/秋季露营攻略/xiaohongshu.md   ← 喂发布 SKILL 直接引用
```

## 改后发布

```bash
# 例：把已归档的小红书变体交接给发布 SKILL
python skills/openclaw/skill-login-and-publish/scripts/route.py cmd xiaohongshu publish \
  --title "<归档稿标题>" --content "<归档稿正文>" \
  --media "D:/abs/img1.png,D:/abs/img2.png" --exec --run
```
