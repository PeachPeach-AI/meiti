#!/usr/bin/env python3
"""account_repair.py — 一键重置某平台浏览器登录态的残留占用。

账号页「重置」按钮调用：清掉卡住的 profile 锁 / 残留 Chromium / 过期的登录状态文件，
之后由 Web 后端重新 whoami；未登录则前端直接拉起扫码登录。

只做清理，不删除 Cookie、不退出登录。输出单行 JSON。
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_lock  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOGIN_DIR = PROJECT_ROOT / "outputs" / "_login"
PROFILE_BASE = Path.home() / ".easel-browser-profiles"

PROFILES = {
    "douyin": "DouyinProfile",
    "xiaohongshu": "XiaohongshuProfile",
    "kuaishou": "KuaishouProfile",
    "weixin-channels": "ChannelsProfile",
    "zhihu": "ZhihuProfile",
    "weibo": "WeiboProfile",
    "toutiao": "ToutiaoProfile",
    "baijiahao": "BaijiahaoProfile",
    "sohu": "SohuProfile",
}

LOCK_FILES = (".easel.lock", ".easel.lock.pid", "SingletonLock", "SingletonCookie", "SingletonSocket")


def _run(cmd: list[str], timeout: int = 20) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=timeout)


def _kill(pid: int) -> bool:
    if pid <= 0 or pid == os.getpid():
        return False
    try:
        r = _run(["taskkill", "/F", "/T", "/PID", str(pid)], timeout=15)
        return r.returncode == 0
    except Exception:
        return False


def _pid_cmdline(pid: int) -> str:
    try:
        r = _run(["wmic", "process", "where", f"ProcessId={pid}",
                  "get", "CommandLine", "/format:list"], timeout=15)
        for line in (r.stdout or "").splitlines():
            if line.strip().startswith("CommandLine="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


# 只有这些脚本才允许被「重置」结束；避免 PID 被系统复用后误杀别的进程
_KILLABLE = ("douyin_publish", "xhs_publish", "web_publisher", "bili_login",
             "account_stats", "douyin_media")


def _profile_chrome_pids(profile: Path) -> list[int]:
    """找出命令行里带该 profile 目录的 chrome 进程（Playwright 的浏览器就叫 chrome.exe）。"""
    needle = str(profile).lower()
    pids: list[int] = []
    try:
        r = _run(["wmic", "process", "where", "name='chrome.exe'",
                  "get", "ProcessId,CommandLine", "/format:csv"], timeout=25)
        for line in (r.stdout or "").splitlines():
            low = line.lower()
            if needle not in low:
                continue
            pid = line.rsplit(",", 1)[-1].strip().strip('"')
            if pid.isdigit():
                pids.append(int(pid))
    except Exception:
        pass
    return pids


def _clear_status(platform: str) -> bool:
    cleared = False
    sf = LOGIN_DIR / f"{platform}.json"
    try:
        data = json.loads(sf.read_text(encoding="utf-8"))
        if data.get("state") in ("starting", "qr_ready", "scanned", "sms_required", "verifying", "error", "expired"):
            sf.unlink()
            cleared = True
    except (OSError, json.JSONDecodeError):
        try:
            sf.unlink()
            cleared = True
        except OSError:
            pass
    try:
        (LOGIN_DIR / f"{platform}.code").unlink()
        cleared = True
    except OSError:
        pass
    return cleared


def repair(platform: str) -> dict:
    profile_name = PROFILES.get(platform)
    if not profile_name:
        raise SystemExit(f"不支持重置的平台：{platform}")
    profile = PROFILE_BASE / profile_name
    killed: list[int] = []

    # 1) 先结束持有 profile 锁的进程（登录/发布/whoami）
    holder = profile_lock.holder_pid(profile)
    if holder.isdigit():
        pid = int(holder)
        if pid != os.getpid():
            cmd = _pid_cmdline(pid).lower()
            if cmd and any(k in cmd for k in _KILLABLE) and _kill(pid):
                killed.append(pid)

    # 2) 再清理没有锁、但还挂着该 profile 的 Chromium（旧版本脚本/浏览器残留）
    for pid in _profile_chrome_pids(profile):
        if pid not in killed and _kill(pid):
            killed.append(pid)

    # 3) 等文件句柄释放后，先确认锁真的空闲，再删锁文件。
    #    如果还有登录/发布进程活着（例如 PID 不可识别、不能安全结束），保持原样，
    #    否则删锁会让两个浏览器同时打开同一个 profile，反而破坏登录态。
    time.sleep(0.6)
    probe = profile_lock.acquire(profile, wait_s=2)
    lock_free = probe is not None
    removed: list[str] = []
    status_cleared = False
    if lock_free:
        profile_lock.release(probe)
        for name in LOCK_FILES:
            p = profile / name
            try:
                if p.exists() or p.is_symlink():
                    p.unlink()
                    removed.append(name)
            except OSError:
                pass
        # 4) 清掉卡在 starting/qr_ready/sms_required 的登录状态，避免前端继续转圈
        status_cleared = _clear_status(platform)

    if not lock_free:
        message = "登录/发布进程仍在运行，未能安全重置，请稍后重试"
    elif killed or removed or status_cleared:
        message = "已清理残留"
    else:
        message = "没有发现残留"
    return {
        "platform": platform,
        "profile": str(profile),
        "killed": killed,
        "removed": removed,
        "statusCleared": status_cleared,
        "lockFree": lock_free,
        "message": message,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", required=True)
    a = ap.parse_args()
    try:
        out = repair(a.platform)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc), "platform": a.platform}))
        return 1
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
