import contextvars
import os
import pathlib
import shutil
import sys
import threading
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import app  # loads app.pyc (compiled fallback)
import uvicorn
from fastapi import HTTPException
from fastapi.routing import APIRoute

CHAT_SESSION = contextvars.ContextVar("chat_session", default=None)
_OUT_DIRS = {}
_OUT_LOCK = threading.Lock()


def _adopt(session_id=None):
    sid = session_id or CHAT_SESSION.get()
    src = app._workspace_outputs_dir()
    if src is None:
        return
    items = [e for e in src.iterdir()
             if not (e.name.startswith(".") or e.name.startswith("_") or e.name in app.SYSTEM_TOPLEVEL_DIRS)]
    if not items:
        return
    dest = app.outputs_dir()
    try:
        if src.resolve() == dest.resolve():
            return
    except OSError:
        return
    if sid:
        key = f"{dest}|{sid}"
        with _OUT_LOCK:
            target = _OUT_DIRS.get(key)
            if target is None or not target.is_dir():
                base = f"会话-{time.strftime('%Y%m%d-%H%M%S')}"
                target = dest / base
                n = 2
                while target.exists():
                    target = dest / f"{base}-{n}"
                    n += 1
                target.mkdir(parents=True, exist_ok=True)
                _OUT_DIRS[key] = target
    else:
        base = f"会话-{time.strftime('%Y%m%d-%H%M%S')}"
        target = dest / base
        n = 2
        while target.exists():
            target = dest / f"{base}-{n}"
            n += 1
        target.mkdir(parents=True, exist_ok=True)
    for e in items:
        dst = target / e.name
        try:
            if dst.exists() and app._effective_perm(dst) == "ro":
                continue
            if not dst.exists() and app._effective_perm(target) == "ro":
                continue
            if e.is_dir():
                app._copy_tree_newer(e, dst)
                shutil.rmtree(e, ignore_errors=True)
            elif e.is_file():
                if dst.exists() and dst.stat().st_mtime >= e.stat().st_mtime:
                    e.unlink()
                else:
                    shutil.copy2(e, dst)
                    e.unlink()
        except OSError:
            continue


app._adopt_workspace_outputs = _adopt

_orig_chat_message = app._chat_message


def _chat_message(req):
    if not app.CURRENT_UID.get():
        raise HTTPException(401, "请先登录")
    return _orig_chat_message(req) + (
        "\n\n读取内容库用上面的路径；生成/写入产物请写到 Agent 工作区的 outputs/（相对路径），"
        "不要直接写内容库；后端会按会话归档到当前账号。"
    )


app._chat_message = _chat_message

for route in app.app.routes:
    if not isinstance(route, APIRoute):
        continue
    if route.path == "/api/outputs":
        orig = route.endpoint

        def outputs_guard(_orig=orig):
            if not app.CURRENT_UID.get():
                raise HTTPException(401, "请先登录")
            return _orig()

        route.endpoint = outputs_guard
    if route.path in ("/api/chat", "/api/chat/stream", "/api/skill"):
        orig = route.endpoint

        async def chat_guard(req, _orig=orig):
            if not app.CURRENT_UID.get():
                raise HTTPException(401, "请先登录")
            tok = CHAT_SESSION.set(getattr(req, "sessionId", None))
            try:
                return await _orig(req)
            finally:
                CHAT_SESSION.reset(tok)

        route.endpoint = chat_guard

uvicorn.run(app.app, host="0.0.0.0", port=int(os.environ.get("EASEL_WEB_PORT", "7866")))
