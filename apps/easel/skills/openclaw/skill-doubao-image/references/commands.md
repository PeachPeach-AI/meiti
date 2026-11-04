# commands.md — 豆包生图命令样例

> GEN = `skills/openclaw/skill-doubao-image/scripts/gen.py`，CWD=项目根。
> gen.py 自动把 `.env`（IMG_BASE_URL/IMG_MODEL/IMG_API_KEY）挂给底层脚本。

## 校验配置（不发图）

```bash
python $GEN check
# [正常] IMG_BASE_URL = https://ark.cn-beijing.volces.com/api/v3
# [正常] IMG_MODEL   = doubao-seedream-5-0-pro-260628
# [正常] IMG_API_KEY = ark-…92f8
```

## 文生图

```bash
# 方图 2K 两张
python $GEN text2img --prompt "中式茶馆内景，晨光，胶片质感" \
  -o outputs/doubao/teahouse --n 2 --size 1024x1024 --resolution 2k

# 竖版（小红书 3:4）
python $GEN text2img --prompt "露营装备平铺俯拍，奶油色系" \
  -o outputs/doubao/camp --size 864x1152

# 16:9 宽幅（官网 banner 素材）
python $GEN text2img --prompt "极简门店门头，傍晚霓虹" \
  -o outputs/doubao/storefront --size 1664x928

# 4K 定稿出图
python $GEN text2img --prompt "…终稿描述…" -o outputs/doubao/final \
  --size 1024x1024 --resolution 4k

# 控制成本换参数：--n 1、--resolution 1k、省 --quality
```

## 图生图 / 改图 / 变体

```bash
python $GEN img2img --prompt "把背景换成夜幕下的古镇街道" \
  --image outputs/doubao/storefront-1.png -o outputs/doubao/night

python $GEN variations --image outputs/doubao/camp-1.png -o outputs/doubao/camp-var
```

## 产物

- `-o` 是**前缀**：`--n 3` 时产出 `-1.png / -2.png / -3.png`。
- 文件写在 `outputs/` 下；路径可直接喂各发布 SKILL（官网资源发布第一张图自动作封面）。

## 参数速查

| 参数 | 值 | 说明 |
|------|----|------|
| `--size` | 1024x1024 / 864x1152 / 1152x864 / 1664x928 / 928x1664 … | 画幅（宽x高） |
| `--resolution` | 1k / 2k / 4k | 输出分辨率档位（越贵越小值起手） |
| `--n` | 1~4 | 张数（计费×n） |
| `--format` | png / jpeg / webp | 输出格式（默认 png） |
| `--quality` | low/medium/high | 同步模式模型支持时生效 |
| `--mode` | sync / async | 默认按 base_url 自动识别 |

## 报错

| 报错 | 处置 |
|------|------|
| `IMG_API_KEY 未配置` | gen.py 已自动挂 `.env`，说明该文件被移走了；跑 `check` 看具体 |
| 401 / 鉴权失败 | Key 失效：火山方舟控制台换 Key，改 `.env` 的 IMG_API_KEY 后重试 |
| 欠费 / 未开通模型 | 去方舟控制台开通该模型或充值；别擅自换模型名 |
| 参数非法（size/resolution） | 模型不接受该组合；降回 1024x1024 + 2k 重试 |
| img2img 走不通 | Ark 同步多参考图支持有限——改用文生图描述参考图特征 |
