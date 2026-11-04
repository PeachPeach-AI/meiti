#!/usr/bin/env python3
"""gen.py — 豆包生图（火山引擎 Ark Seedream）包装器.

只是把 `skills/shared/scripts/ai_image.py` 包装成豆包专用入口：
  - 自动把 --env-file 指到项目根的 .env（IMG_BASE_URL / IMG_MODEL / IMG_API_KEY 那三个），
    Agent 在任何 CWD 下都不用再操心 .env 找不到。
  - 其余参数原样透传（text2img / img2img / variations / check 语义不变）。

用法（与 ai_image.py 完全一致）：
  text2img  --prompt "..." -o outputs/x.png [--size 1024x1024] [--n 4]
            [--resolution 2k] [--format png] [--quality high]
  img2img   --prompt "..." --image 参考图 -o outputs/y.png
  variations --image 参考图 -o outputs/z.png
  check     校验配置（不发图）

豆包特有：Ark 同步模式会自动带 watermark=False 参数（无水印原图）。
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# <Easel根>/skills/openclaw/skill-doubao-image/scripts/gen.py → parents[4] = Easel 根
EASEL = Path(__file__).resolve().parents[4]
AI_IMAGE = EASEL / "skills" / "shared" / "scripts" / "ai_image.py"
DEFAULT_ENV = EASEL / ".env"
SUBS = ("text2img", "img2img", "variations", "check")


def main() -> int:
    argv = sys.argv[1:]
    if not argv or argv[0] not in SUBS:
        print(__doc__)
        print(f"缺少子命令（{', '.join(SUBS)}）")
        return 2
    if not AI_IMAGE.is_file():
        print(f"找不到共享脚本：{AI_IMAGE}")
        return 2

    env_file = DEFAULT_ENV
    if "--env-file" in argv:
        i = argv.index("--env-file")
        env_file = Path(argv[i + 1]) if i + 1 < len(argv) else env_file
    else:
        if not env_file.is_file():
            print(f"提示：{env_file} 不存在，豆包生图需要 .env 里的 IMG_BASE_URL/IMG_MODEL/IMG_API_KEY")
            return 2
        argv = argv + ["--env-file", str(env_file)]

    cmd = [sys.executable, str(AI_IMAGE), *argv]
    print(">> " + subprocess.list2cmdline(["<python>", str(AI_IMAGE), *argv[:-2]]),
          file=sys.stderr)
    try:
        return subprocess.run(cmd, shell=False).returncode
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
