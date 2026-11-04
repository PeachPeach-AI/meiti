---
name: skill-doubao-image
description: >-
  豆包生图（火山引擎 Ark Seedream）：文生图、图生图/改图、图变体，输出无水印原图，
  支持 1K/2K/4K 分辨率、多比例尺寸、一次多张、png/jpeg/webp。当用户说
  "豆包生图""用豆包画""种子图/Seedream""生成一张**图""门店海报图/国潮图/
  配图用 AI 画"时使用。与 ai-image-gen 的分工：本 SKILL 锁定豆包（Ark），配置即用。
layer: produce
---

# 豆包生图（doubao-image）

> 走火山引擎 Ark 的 `doubao-seedream` 系列，AS 基础引擎复用共享脚本 `ai_image.py`
> （OpenAI 兼容 + Ark 特化），本 SKILL 的 `scripts/gen.py` 负责自动挂上项目 `.env`
> 并喂给 `ai_image.py`——**Agent 不用自己找 .env，任何时候直接调 gen.py**。

## 依赖与配置（项目已配好，通常不用动）

`.env`（Easel 根目录）三个变量：

| 变量 | 当前值 | 说明 |
|------|--------|------|
| `IMG_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` | 火山 Ark |
| `IMG_MODEL` | `doubao-seedream-5-0-pro-260628` | 换模型只改这一行 |
| `IMG_API_KEY` | `ark-…` | 火山方舟 API Key |

凭证校验：`python skills/openclaw/skill-doubao-image/scripts/gen.py check`（不发图、零成本）。

## 与其他生图 SKILL 的分工

- **本 SKILL**：豆包 Seedream——中文构思友好、无水印参数、适合中国式审美/门店/国潮场景。
- **ai-image-gen**：OpenAI gpt-image-1 / apimart 等其他供应商。
- **ecom-details-image / poster-\***：电商详情/海报的**成图后加工**，产物常先由本 SKILL 出底图。
- **image-editing**：对已下载图片做精确编辑（裁切/去杂物/压缩），不调用生图 API。

## 执行流程

1. `check` 确认配置（首次或换 Key 后必做）。
2. 明确用户要**文生图**（只有描述）还是**图生图**（给了参考图）。
3. 帮用户把需求整理成具体 Prompt（中文即可；**越具体越好**：主体/场景/风格/
   光线/构图/画幅），确认后再生成——生图按张计费。
4. 生成：
   ```bash
   python skills/openclaw/skill-doubao-image/scripts/gen.py text2img \
     --prompt "小红书封面：晨光中的露营装备平铺图，胶片感" \
     -o outputs/doubao/camp-cover --n 2 --size 1024x1024 --resolution 2k
   ```
   - `-o` 是**前缀**：多张时产出 `camp-cover-1.png`、`camp-cover-2.png`
   - size 常用组合：`1024x1024`（方）、`864x1152 / 1152x864`（3:4 与 4:3）、
     `1664x928 / 928x1664`（16:9 与 9:16 竖版）
   - 图片尺寸只为**发布平台适配**：小红书竖版 3:4、公众号封面用「公众号封面图预设」、
     官网 resource 封面 1600×680 → 用 `image-editing` 精确出图
5. 产物记绝对路径回给用户/喂给发布 SKILL（skill-free-image-finder 的 img_path 同一玩法）。
6. 计费提示：2K/4K/Pro 模型更贵，探索构图先 1 张 1024，定稿再出高清多张。

## 规则

1. **每次生图都是花钱的操作**：`--n` 与 `--resolution` 按需给小值起手，别无脑 4K。
2. 核保产品/人物肖像/明星脸/品牌 Logo 的 Prompt 要**提醒用户版权与肖像权风险**。
3. 产物只写 `outputs/` 下（子目录按用途建，如 `outputs/doubao/`）；不要写进内容库根目录。
4. key 只来自 `.env`，**不外传、不写进任何文档**；models 若报“未开通/欠费”，指引
   用户到火山方舟控制台处理，不要自己换不确定的模型名。
5. 图生图（img2img）在 Ark 同步模式下走 `/images/edits`，豆包模型对多参考图支持
   有限——失败就回退文生图思路（用 prompt 描述参考图特征），并在回复中说明原因。
