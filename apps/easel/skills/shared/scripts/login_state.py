#!/usr/bin/env python3
"""login_state.py — 登录状态文件协议（web_publisher / xhs_publish 共用）。

登录 runner 是长流程（起浏览器→出二维码→等扫码→持久化），Web 后端不直接管浏览器，
只**读这个 JSON 文件**判断进度。原子写，避免读到半截。

状态机：starting → qr_ready → [scanned] → [sms_required → verifying] → success | expired | error
（sms_required：扫码后平台风控要求短信验证，runner 等前端回填验证码——见 read_sms_code；
  verifying：已拿到验证码、正在提交校验，前端显示转圈；校验失败会退回 sms_required 让重输）
"""
from __future__ import annotations

import json
import os
import tempfile
import time

STATES = ("starting", "qr_ready", "scanned", "sms_required", "verifying",
          "success", "expired", "error")


def read_sms_code(path: str | None) -> str:
    """读并消费一次性短信验证码文件（前端提交后由 Web 后端写入）。

    约定：路径为 outputs/_login/<platform>.code，内容为纯数字验证码。
    读到后立即删除（消费一次），返回验证码；无文件/为空返回 ""。
    """
    if not path or not os.path.exists(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            code = f.read().strip()
    except OSError:
        return ""
    try:
        os.unlink(path)
    except OSError:
        pass
    return code


def write_status(path: str | None, state: str, message: str = "", qr: str = "") -> None:
    """原子写登录状态。path 为空则跳过（CLI 直跑不需要文件时）。"""
    if not path:
        return
    data = {"state": state, "message": message, "qr": qr, "ts": int(time.time())}
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        # Windows 上 Web 端正在读同一个 json 时，os.replace 可能抛 WinError 5/32（共享冲突）。
        # 短暂重试，避免状态文件卡在旧值，进而让前端反复拉起登录/发布进程。
        last_exc = None
        for attempt in range(40):
            try:
                os.replace(tmp, path)
                return
            except OSError as exc:
                last_exc = exc
                if getattr(exc, "winerror", None) not in (5, 32) and exc.errno not in (13, 16):
                    raise
                time.sleep(min(0.05 * (attempt + 1), 0.5))
        # 兜底：Windows 下若读取方长时间占用该文件（不共享删除），os.replace 会一直
        # WinError 5/32。改为原地覆盖写，避免状态文件卡旧值导致前端反复拉起登录进程。
        try:
            with open(tmp, encoding="utf-8") as tf:
                content = tf.read()
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            try:
                os.unlink(tmp)
            except OSError:
                pass
            return
        except OSError:
            raise last_exc
    except BaseException:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass
        raise


def read_status(path: str) -> dict:
    """读登录状态；不存在或损坏返回 unknown。"""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("state") in STATES:
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return {"state": "unknown", "message": "", "qr": "", "ts": 0}
