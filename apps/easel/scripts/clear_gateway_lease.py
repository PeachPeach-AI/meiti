"""清理崩溃/强杀后残留的 gateway-owner 租约。

仅在确认没有 gateway 进程、端口也未监听时由启动器调用；正常运行时不要执行。
"""
from __future__ import annotations

import os
import sqlite3
import sys


def main() -> int:
    path = os.path.expanduser("~/.openclaw-easel/state/openclaw.sqlite")
    if not os.path.exists(path):
        return 0
    try:
        conn = sqlite3.connect(path, timeout=5)
        conn.execute("delete from state_leases where scope = 'gateway-owner'")
        conn.commit()
        conn.close()
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"clear gateway lease skipped: {exc}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
