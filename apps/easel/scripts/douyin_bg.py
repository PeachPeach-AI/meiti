#!/usr/bin/env python3
"""后台启动 douyin_publish.py（跨平台），并返回 PID / 日志路径。

Windows 上 `setsid ... &` 不可用；本脚本用 detached 子进程，父进程（Agent 一轮）
结束后发布进程仍继续跑。用法：

  python scripts/douyin_bg.py --log "<content>/_login/douyin.publish.log" -- \
    publish --exec --title "..." --images a.jpg,b.jpg \
    --status-file "<content>/_login/douyin.publish.json" \
    --sms-code-file "<content>/_login/douyin.code"

`--` 之后的所有参数原样传给 douyin_publish.py。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = ROOT / ".venv" / "Scripts" / "python.exe"
SCRIPT = ROOT / "skills" / "shared" / "scripts" / "douyin_publish.py"


def main() -> int:
    argv = sys.argv[1:]
    log = str(ROOT / "outputs" / "_login" / "douyin.publish.log")
    if len(argv) >= 2 and argv[0] == "--log":
        log = argv[1]
        argv = argv[2:]
    if argv and argv[0] == "--":
        argv = argv[1:]
    if not argv:
        print("用法：douyin_bg.py --log <日志> -- <douyin_publish.py 参数>", file=sys.stderr)
        return 2
    py = PY if PY.is_file() else Path(sys.executable)
    if not SCRIPT.is_file():
        print(f"找不到发布脚本：{SCRIPT}", file=sys.stderr)
        return 2
    log_path = Path(log)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    err_path = Path(str(log_path) + ".err")
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    out = open(log_path, "w", encoding="utf-8", errors="replace")
    err = open(err_path, "w", encoding="utf-8", errors="replace")
    kwargs = {
        "cwd": str(ROOT),
        "env": env,
        "stdout": out,
        "stderr": err,
        "stdin": subprocess.DEVNULL,
    }
    if os.name == "nt":
        # DETACHED_PROCESS: Agent 本轮退出后子进程继续；CREATE_NEW_PROCESS_GROUP 让 Ctrl+C 不误杀
        kwargs["creationflags"] = (
            getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
        )
    else:
        kwargs["start_new_session"] = True
    p = subprocess.Popen([str(py), "-u", str(SCRIPT), *argv], **kwargs)
    print(json.dumps({
        "ok": True,
        "pid": p.pid,
        "log": str(log_path),
        "err": str(err_path),
        "script": str(SCRIPT),
        "args": argv,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
