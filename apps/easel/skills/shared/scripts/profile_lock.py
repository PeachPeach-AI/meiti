#!/usr/bin/env python3
"""profile_lock.py — 浏览器登录态目录的跨进程文件锁。

同一个 Playwright persistent profile 被两个进程同时打开会互相抢 SingletonLock，
表现为二维码不刷新、登录态被覆盖、发布命令静默退出。所有会打开
`~/.easel-browser-profiles/<Xxx>Profile` 的脚本都应先拿这把锁。

用法：
    lock = profile_lock.acquire(profile_dir, wait_s=20)
    if lock is None:
        print(profile_lock.holder_pid(profile_dir))
    try:
        ...
    finally:
        profile_lock.release(lock)
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import IO

LOCK_NAME = ".easel.lock"
PID_NAME = ".easel.lock.pid"


def lock_path(profile: Path | str) -> Path:
    return Path(profile) / LOCK_NAME


def pid_path(profile: Path | str) -> Path:
    return Path(profile) / PID_NAME


def acquire(profile: Path | str, wait_s: float = 0.0) -> IO[str] | None:
    """非阻塞拿锁；wait_s 内不断重试。成功返回文件句柄（持有期间不要关闭）。"""
    profile = Path(profile)
    deadline = time.time() + max(0.0, wait_s)
    while True:
        f = None
        try:
            profile.mkdir(parents=True, exist_ok=True)
            f = open(lock_path(profile), "a+", encoding="utf-8")
            # 先把锁拿到手，再写 PID；否则等待方会覆盖持锁方的 PID，日志会误导排查。
            f.seek(0)
            if not f.read(1):
                f.write(" ")
                f.flush()
            f.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            # PID 单独写一个文件：锁住的字节在 Windows 上不可读，写进 .easel.lock 会导致
            # 等待方永远只能看到「未知」。PID 文件仅用于诊断，不参与加锁。
            try:
                pid_path(profile).write_text(str(os.getpid()), encoding="utf-8")
            except OSError:
                pass
            return f
        except OSError:
            if f is not None:
                try:
                    f.close()
                except OSError:
                    pass
            if time.time() >= deadline:
                return None
            time.sleep(0.25)


def release(lock: IO[str] | None) -> None:
    if not lock:
        return
    try:
        if os.name == "nt":
            import msvcrt
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
    except OSError:
        pass
    try:
        lock.close()
    except OSError:
        pass


def holder_pid(profile: Path | str) -> str:
    try:
        txt = pid_path(profile).read_text(encoding="utf-8", errors="ignore").strip()
        return txt or "未知"
    except OSError:
        return "未知"
