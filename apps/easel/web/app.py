"""Easel backend entry: readable content/session core on top of the compiled legacy engine.

The legacy compiled engine (`app_core.pyc`) still owns accounts, platform login,
publishing, analytics and the OpenClaw chat transport. This file reimplements the
core content library + per-session output landing in readable Python and replaces
those route endpoints in place.
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import os
import pathlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime

import base64
import hashlib
import hmac
import html
import urllib.error
import urllib.parse
import urllib.request

import httpx

from fastapi import Body, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse

# 对话流式的运行时兜底：HTTP 通道是主路径；raw-stream 只作为网关侧诊断/CLI 兜底。
# web 侧单独用一个空文件，避免读到网关异步写出的乱序 delta 而误判“回复被中断”。
_RUNTIME_DIR = Path(__file__).resolve().parents[3] / ".runtime"
try:
    _RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    _WEB_RAW_STREAM = _RUNTIME_DIR / "easel-web-raw.jsonl"
    _WEB_RAW_STREAM.touch(exist_ok=True)
    os.environ.pop("OPENCLAW_RAW_STREAM", None)
    os.environ["OPENCLAW_RAW_STREAM_PATH"] = str(_WEB_RAW_STREAM)
    os.environ["EASEL_RAW_STREAM_PATH"] = str(_WEB_RAW_STREAM)
    os.environ.setdefault("EASEL_CHAT_TRANSPORT", "http")
except OSError:
    pass

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import app_core as legacy  # noqa: E402

app = legacy.app

# ---- 画像路径统一到当前账号 ----
# legacy 的 list_personas 已经按账号读 profiles_dir()，但 profile_exists/load_profile_text/
# persona_prefix 仍来自全局 easel.persona（integrations/Easel/profiles），导致页面上能列出
# 账号画像、点进去却 404「画像不存在」。这里统一改成当前账号的 profiles/。
_PROFILE_FILE_ORDER = [
    "identity.md", "style.md", "audience.md",
    "platforms.md", "preferences.md", "memory.md",
]


def _profile_dir(name: str):
    try:
        return legacy.profiles_dir() / name
    except Exception:
        return None


def _profile_exists(name: str) -> bool:
    pd = _profile_dir(name)
    return bool(name) and pd is not None and pd.is_dir()


def _load_profile_text(name: str) -> str:
    pd = _profile_dir(name)
    if pd is None or not pd.is_dir():
        return ""
    parts: list[str] = []
    for filename in _PROFILE_FILE_ORDER:
        fp = pd / filename
        if fp.is_file():
            text = fp.read_text(encoding="utf-8").strip()
            if text:
                parts.append(text)
    for fp in sorted(pd.glob("*.md")):
        if fp.name not in _PROFILE_FILE_ORDER:
            text = fp.read_text(encoding="utf-8").strip()
            if text:
                parts.append(text)
    return "\n\n---\n\n".join(parts)


def _persona_prefix(name: str | None) -> str:
    if name and _profile_exists(name):
        return (
            f"我当前使用的画像是「{name}」。\n"
            f"本会话的账号长期记忆仅使用 profiles/{name}/memory.md；"
            "不要使用工作区全局 MEMORY.md 作为账号记忆。"
        )
    return ""


legacy.profile_exists = _profile_exists
legacy.load_profile_text = _load_profile_text
legacy.persona_prefix = _persona_prefix

# 内容库额外支持网页文件导入（旧白名单没有 html/htm）
try:
    legacy.UPLOAD_EXTS = set(legacy.UPLOAD_EXTS) | {".html", ".htm"}
except Exception:
    pass

# ---- 优先走网关的 OpenAI 兼容 HTTP 流：token 顺序正确，不依赖 raw-stream 调试文件 ----
# 网关开了鉴权，web 的 HTTP 流本身不带 Authorization；这里统一补上，并让就绪探测用同一 token。
def _gateway_token() -> str:
    try:
        cfg = json.loads(
            (pathlib.Path.home() / ".openclaw-easel" / "openclaw.json").read_text(encoding="utf-8")
        )
        return str(((cfg.get("gateway") or {}).get("auth") or {}).get("token") or "")
    except Exception:
        return ""


_GATEWAY_TOKEN = _gateway_token()
_orig_httpx_stream = httpx.AsyncClient.stream


def _current_gateway_token() -> str:
    """配置在启动瞬间可能正被写入；为空时下次再读，避免整轮退化为 CLI。"""
    global _GATEWAY_TOKEN
    if not _GATEWAY_TOKEN:
        _GATEWAY_TOKEN = _gateway_token()
    return _GATEWAY_TOKEN


def _stream_with_gateway_auth(self, method, url, **kwargs):
    try:
        u = str(url)
        if "127.0.0.1:18789" in u or "localhost:18789" in u:
            headers = dict(kwargs.get("headers") or {})
            token = _current_gateway_token()
            if token:
                headers.setdefault("Authorization", "Bearer " + token)
            kwargs["headers"] = headers
    except Exception:
        pass
    return _orig_httpx_stream(self, method, url, **kwargs)


httpx.AsyncClient.stream = _stream_with_gateway_auth


def _gateway_http_ready(force: bool = False) -> bool:
    now = time.monotonic()
    ttl = getattr(legacy, "_HTTP_READY_TTL", 60)
    cache = getattr(legacy, "_HTTP_READY_CACHE", None)
    if cache is not None and not force and (now - cache.get("at", 0)) < ttl:
        return bool(cache.get("ok"))
    ok = False
    try:
        headers = {"Content-Type": "application/json"}
        token = _current_gateway_token()
        if token:
            headers["Authorization"] = "Bearer " + token
        rq = urllib.request.Request(
            "http://127.0.0.1:18789/v1/chat/completions",
            data=b"{}",
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(rq, timeout=3):
                ok = False
        except urllib.error.HTTPError as exc:
            ok = exc.code in (200, 400)
    except Exception:
        ok = False
    if cache is not None:
        # 只缓存“已就绪”，未就绪时下次请求立即重试（网关冷启动期间不至于卡在 CLI）
        cache.update({"at": now if ok else 0, "ok": ok})
    return ok


legacy._gateway_http_ready = _gateway_http_ready

_TOKENS_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "auth_tokens.json"


def _load_tokens():
    try:
        data = json.loads(_TOKENS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            legacy._TOKENS.update({str(k): str(v) for k, v in data.items()})
    except Exception:
        pass


def _save_tokens():
    try:
        _TOKENS_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _TOKENS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(legacy._TOKENS, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_TOKENS_FILE)
    except Exception:
        pass


_load_tokens()

SESSION = contextvars.ContextVar("easel_chat_session", default=None)
_SESSION_DIRS: dict[str, pathlib.Path] = {}
_SESSION_LOCK = threading.Lock()


def _uid():
    if not legacy.CURRENT_UID.get():
        raise HTTPException(401, "请先登录")
    return legacy.CURRENT_UID.get()


def _outputs():
    return legacy.outputs_dir()


def _target(rel: str, must_exist: bool = True):
    return legacy._safe_output_target(rel, must_exist=must_exist)


def _perm(path: pathlib.Path) -> str:
    return legacy._effective_perm(path)


def _natural(path: pathlib.Path):
    import re
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", path.as_posix())]


def api_outputs():
    _uid()
    return legacy.get_output_tree()


def _safe_rel_segments(rel: str) -> list[str]:
    """把上传的相对路径拆成安全段；拒绝 ..、绝对路径和隐藏文件/目录。"""
    rel = (rel or "").replace("\\", "/").strip().lstrip("/")
    segs: list[str] = []
    for seg in rel.split("/"):
        seg = seg.strip()
        if not seg or seg in (".", ".."):
            continue
        if seg.startswith("."):
            return []
        seg = re.sub(r'[<>:"|?*]', "_", seg)
        if seg:
            segs.append(seg)
    return segs


async def _import_outputs_impl(
    files: list[UploadFile],
    dir: str,
    paths: str,
    root_name: str,
):
    _uid()
    if not files:
        raise HTTPException(400, "没有文件")
    rel_dir = (dir or "").strip().strip("/\\")
    try:
        rel_list = json.loads(paths) if paths else []
        if not isinstance(rel_list, list):
            rel_list = []
    except Exception:
        rel_list = []
    rel_list = [str(x) for x in rel_list]

    root_segs = _safe_rel_segments(root_name) if root_name.strip() else []
    is_folder = bool(root_segs) or any(("/" in p or "\\" in p) for p in rel_list)
    # 根目录导入：dest 已经是所选文件夹本身，去掉路径首段避免出现 fi/fi/...
    # 子目录导入：保留首段，在当前目录下创建所选文件夹。
    strip_root = root_segs[0] if (root_segs and not rel_dir) else ""

    if rel_dir:
        dest = _target(rel_dir, must_exist=False)
        if legacy._is_protected(dest):
            raise HTTPException(403, "系统数据受保护，不能导入到该目录")
        if dest.exists() and not dest.is_dir():
            raise HTTPException(400, "目标不是文件夹")
        if dest.exists() and _perm(dest) == "ro":
            raise HTTPException(403, "文件夹为只读，不能导入")
        if not dest.exists() and _perm(dest.parent) == "ro":
            raise HTTPException(403, "上级文件夹为只读，不能导入")
        dest.mkdir(parents=True, exist_ok=True)
        top_name = dest.name
    elif is_folder:
        # 文件夹导入：根目录下直接用所选文件夹名建项目（同名则 -2、-3 递增）
        name = strip_root or f"导入-{time.strftime('%Y%m%d-%H%M%S')}"
        dest = _outputs() / name
        n = 2
        while dest.exists():
            dest = _outputs() / f"{name}-{n}"
            n += 1
        dest.mkdir(parents=True)
        top_name = dest.name
    else:
        base = f"导入-{time.strftime('%Y%m%d-%H%M%S')}"
        dest = _outputs() / base
        n = 2
        while dest.exists():
            dest = _outputs() / f"{base}-{n}"
            n += 1
        dest.mkdir(parents=True)
        top_name = dest.name

    saved = []
    skipped = 0
    for idx, f in enumerate(files):
        raw_name = pathlib.Path(f.filename or "file").name
        rel = rel_list[idx] if idx < len(rel_list) else raw_name
        segs = _safe_rel_segments(rel)
        if not segs:
            skipped += 1
            continue
        if strip_root and segs[0] == strip_root:
            segs = segs[1:]
        if not segs:
            segs = _safe_rel_segments(raw_name)
        if not segs:
            skipped += 1
            continue
        name = segs[-1]
        ext = pathlib.Path(name).suffix.lower()
        if ext not in legacy.UPLOAD_EXTS:
            skipped += 1
            continue
        folder = dest.joinpath(*segs[:-1]) if len(segs) > 1 else dest
        try:
            folder.resolve().relative_to(dest.resolve())
        except (OSError, ValueError):
            skipped += 1
            continue
        folder.mkdir(parents=True, exist_ok=True)
        target = legacy._unique_upload_path(folder, name)
        with open(target, "wb") as out:
            while True:
                chunk = await f.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        try:
            out_path = target.relative_to(_outputs()).as_posix()
        except ValueError:
            out_path = target.name
        saved.append({"name": target.name, "path": out_path})
    if not saved:
        raise HTTPException(400, "没有可导入的文件（格式不支持或全是隐藏文件）")
    return {"ok": True, "dir": top_name, "files": saved, "skipped": skipped}


@app.post("/api/outputs/import-folder")
async def api_outputs_import_folder(
    files: list[UploadFile] = File(...),
    dir: str = Form(""),
    paths: str = Form(""),
    root_name: str = Form(""),
):
    _uid()
    return await _import_outputs_impl(files, dir, paths, root_name)


async def api_outputs_meta(payload: dict = Body(...)):
    _uid()
    rel = str(payload.get("path") or "").strip().strip("/\\")
    full = _target(rel)
    if not full.is_dir():
        raise HTTPException(400, "目标不是文件夹")
    if legacy._is_protected(full):
        raise HTTPException(403, "系统数据受保护")
    title = payload.get("title", None)
    perm = payload.get("perm", None)
    if perm is not None:
        if perm not in ("rw", "ro"):
            raise HTTPException(400, "权限只能是 rw 或 ro")
        if _perm(full.parent) == "ro":
            raise HTTPException(403, "上级文件夹为只读，请先解锁上级")
    if title is not None:
        if _perm(full) == "ro":
            raise HTTPException(403, "只读文件夹不能改标题，请先设为可写")
        title = str(title).strip()
        if len(title) > 120:
            raise HTTPException(400, "标题最多 120 个字符")
    mf = full / ".easel.json"
    data = {}
    if mf.is_file():
        try:
            old = json.loads(mf.read_text(encoding="utf-8"))
            if isinstance(old, dict):
                data = old
        except Exception:
            data = {}
    if title is not None:
        if title:
            data["title"] = title
        else:
            data.pop("title", None)
    if perm is not None:
        data["perm"] = perm
    tmp = full / ".easel.json.tmp"
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(mf)
    return {"ok": True, "title": data.get("title", ""), "perm": data.get("perm", "rw")}


async def api_outputs_readme(path: str = ""):
    _uid()
    rel = (path or "").strip().strip("/\\")
    full = _target(rel)
    if not full.is_dir():
        raise HTTPException(400, "目标不是文件夹")
    f = full / "README.md"
    if not f.is_file():
        return {"ok": True, "exists": False, "content": ""}
    try:
        return {"ok": True, "exists": True, "content": f.read_text(encoding="utf-8")}
    except Exception as e:
        raise HTTPException(500, f"读取说明失败：{e}")


async def api_outputs_readme_save(payload: dict = Body(...)):
    _uid()
    rel = str(payload.get("path") or "").strip().strip("/\\")
    full = _target(rel)
    if not full.is_dir():
        raise HTTPException(400, "目标不是文件夹")
    if legacy._is_protected(full):
        raise HTTPException(403, "系统数据受保护")
    if _perm(full) == "ro":
        raise HTTPException(403, "只读文件夹不能写说明，请先设为可写")
    content = payload.get("content")
    if not isinstance(content, str):
        raise HTTPException(400, "说明内容必须是文本")
    if len(content) > 200_000:
        raise HTTPException(413, "说明最多 200KB")
    f = full / "README.md"
    tmp = full / ".README.md.tmp"
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(f)
    return {"ok": True, "path": f"{rel}/README.md"}


async def api_outputs_readme_generate(payload: dict = Body(...)):
    _uid()
    rel = str(payload.get("path") or "").strip().strip("/\\")
    full = _target(rel)
    if not full.is_dir():
        raise HTTPException(400, "目标不是文件夹")
    if legacy._is_protected(full):
        raise HTTPException(403, "系统数据受保护")
    if _perm(full) == "ro":
        raise HTTPException(403, "只读文件夹不能生成说明，请先设为可写")
    loop = asyncio.get_running_loop()
    try:
        raw = await loop.run_in_executor(None, legacy._generate_readme_sync, full, rel)
    except Exception as e:
        raise HTTPException(502, f"AI 生成失败：{e}")
    text = legacy._clean_readme_output(raw)
    if not text or text.startswith("?") or "超时" in text[:30]:
        raise HTTPException(502, text or "AI 没有返回内容")
    return {"ok": True, "content": text}


_SESSION_MAP = "_session_dirs.json"


def _load_session_map(dest: pathlib.Path) -> dict:
    try:
        data = json.loads((dest / _SESSION_MAP).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_session_map(dest: pathlib.Path, mapping: dict) -> None:
    try:
        tmp = dest / (_SESSION_MAP + ".tmp")
        tmp.write_text(json.dumps(mapping, ensure_ascii=False, indent=0), encoding="utf-8")
        tmp.replace(dest / _SESSION_MAP)
    except OSError:
        pass


def _session_target(session_id: str | None):
    dest = _outputs()
    if session_id:
        key = f"{dest}|{session_id}"
        with _SESSION_LOCK:
            target = _SESSION_DIRS.get(key)
            if target is None or not target.is_dir():
                mapping = _load_session_map(dest)
                name = mapping.get(session_id)
                if name:
                    cand = dest / str(name)
                    if cand.is_dir():
                        target = cand
            if target is None or not target.is_dir():
                base = f"会话-{time.strftime('%Y%m%d-%H%M%S')}"
                target = dest / base
                n = 2
                while target.exists():
                    target = dest / f"{base}-{n}"
                    n += 1
                target.mkdir(parents=True, exist_ok=True)
                mapping = _load_session_map(dest)
                mapping[session_id] = target.name
                _save_session_map(dest, mapping)
            _SESSION_DIRS[key] = target
        return target
    base = f"会话-{time.strftime('%Y%m%d-%H%M%S')}"
    target = dest / base
    n = 2
    while target.exists():
        target = dest / f"{base}-{n}"
        n += 1
    target.mkdir(parents=True, exist_ok=True)
    return target


def adopt_outputs(session_id: str | None = None) -> None:
    sid = session_id or SESSION.get()
    src = legacy._workspace_outputs_dir()
    if src is None:
        return
    items = [e for e in src.iterdir()
             if not (e.name.startswith(".") or e.name.startswith("_") or e.name in legacy.SYSTEM_TOPLEVEL_DIRS)]
    if not items:
        return
    dest = _outputs()
    try:
        if src.resolve() == dest.resolve():
            return
    except OSError:
        return
    target = _session_target(sid)

    def _all_copied(src_dir: pathlib.Path, dst_dir: pathlib.Path) -> bool:
        # 只有确认每个文件都已在目标里，才删除工作区源文件，避免半途失败丢产物。
        try:
            for f in src_dir.rglob("*"):
                if not f.is_file():
                    continue
                rel = f.relative_to(src_dir)
                if not (dst_dir / rel).is_file():
                    return False
        except OSError:
            return False
        return True

    for e in items:
        dst = target / e.name
        try:
            if dst.exists() and _perm(dst) == "ro":
                continue
            if not dst.exists() and _perm(target) == "ro":
                continue
            if e.is_dir():
                legacy._copy_tree_newer(e, dst)
                if _all_copied(e, dst):
                    shutil.rmtree(e, ignore_errors=True)
            elif e.is_file():
                if dst.exists() and dst.stat().st_mtime >= e.stat().st_mtime:
                    e.unlink()
                else:
                    shutil.copy2(e, dst)
                    e.unlink()
        except OSError:
            continue


legacy._adopt_workspace_outputs = adopt_outputs

_orig_chat_message = legacy._chat_message


def _knowledge_file(uid: str, persona: str) -> pathlib.Path:
    # 知识库挂载按画像存储（画像目录下），与内容库解耦；persona 为画像名
    return (
        pathlib.Path(__file__).resolve().parent.parent
        / "data" / "users" / uid / "profiles" / persona / "knowledge.json"
    )


def _load_knowledge(uid: str, persona: str) -> list[str]:
    if not persona:
        return []
    try:
        data = json.loads(_knowledge_file(uid, persona).read_text(encoding="utf-8"))
        paths = data.get("paths") if isinstance(data, dict) else data
        if isinstance(paths, list):
            return [str(p) for p in paths if str(p).strip()]
    except Exception:
        pass
    return []


def _save_knowledge(uid: str, persona: str, paths: list[str]) -> None:
    p = _knowledge_file(uid, persona)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps({"paths": paths}, ensure_ascii=False, indent=0), encoding="utf-8")
    tmp.replace(p)


def _knowledge_prompt(uid: str, persona: str) -> str:
    base = _outputs()
    lines = []
    for rel in _load_knowledge(uid, persona):
        try:
            parts = _safe_rel_segments(rel)
            if not parts:
                continue
            target = base.joinpath(*parts)
            target.resolve().relative_to(base.resolve())
            if target.exists():
                lines.append(f"- {rel}（{'目录' if target.is_dir() else '文件'}）")
        except (OSError, ValueError):
            continue
    if not lines:
        return ""
    return (
        "\n\n当前挂载的知识库（内容库内相对路径；需要时先读取这些内容，不要修改或删除）：\n"
        + "\n".join(lines)
    )


@app.get("/api/knowledge")
async def api_knowledge_get(persona: str = Query("")):
    uid = _uid()
    if not persona:
        raise HTTPException(400, "缺少 persona（画像名）")
    return {"paths": _load_knowledge(uid, persona)}


@app.post("/api/knowledge")
async def api_knowledge_save(payload: dict = Body(...)):
    uid = _uid()
    persona = str(payload.get("persona") or "").strip()
    if not persona or not _profile_exists(persona):
        raise HTTPException(400, "persona 必须是当前账号下已存在的画像")
    raw = payload.get("paths") or []
    if not isinstance(raw, list):
        raise HTTPException(400, "paths 必须是数组")
    base = _outputs()
    clean: list[str] = []
    for item in raw:
        parts = _safe_rel_segments(str(item))
        if not parts:
            continue
        rel = "/".join(parts)
        try:
            target = base.joinpath(*parts)
            target.resolve().relative_to(base.resolve())
            if not target.exists():
                continue
        except (OSError, ValueError):
            continue
        if rel not in clean:
            clean.append(rel)
        if len(clean) >= 200:
            break
    _save_knowledge(uid, persona, clean)
    return {"ok": True, "paths": clean}


def _chat_message(req):
    uid = _uid()
    base = _outputs()
    persona = (req.get("persona") if isinstance(req, dict) else getattr(req, "persona", None)) or ""
    text = _orig_chat_message(req)
    # 附件清单原来给的是 outputs/_inbox/...（相对内容库），Agent 在 workspace 下会找错；
    # 改成内容库绝对路径，避免“上传了但找不到文件”。
    text = re.sub(r'(?m)^- outputs/', lambda _m: f"- {base.as_posix()}/", text)
    return text + (
        "\n\n读取内容库用上面的路径；生成/写入产物请写到 Agent 工作区的 outputs/（相对路径），"
        "不要直接写内容库；后端会按会话归档到当前账号。"
    ) + _knowledge_prompt(uid, persona)


legacy._chat_message = _chat_message


def _wrap_route(path: str, fn):
    for route in app.routes:
        if getattr(route, "path", "") == path:
            route.endpoint = fn
            return


_wrap_route("/api/outputs", api_outputs)

_wrap_route("/api/outputs/meta", api_outputs_meta)
_wrap_route("/api/outputs/readme", api_outputs_readme)
_wrap_route("/api/outputs/readme/generate", api_outputs_readme_generate)


# ---- 账号「重置」：清理卡住的 profile 占用，再立即 whoami；未登录由前端拉起登录 ----
_EASEL_ROOT = pathlib.Path(__file__).resolve().parents[1]
_ACCOUNT_REPAIR = _EASEL_ROOT / "skills" / "shared" / "scripts" / "account_repair.py"


def _repair_account_sync(platform: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(_ACCOUNT_REPAIR), "--platform", platform],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=90, cwd=str(_EASEL_ROOT),
    )
    for line in reversed((proc.stdout or "").strip().splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    detail = (proc.stderr or proc.stdout or "重置脚本无输出").strip()
    raise RuntimeError(detail[-300:])


@app.post("/api/accounts/{platform}/repair")
async def api_account_repair(platform: str):
    """重置某平台登录态的残留占用，然后立即校验；needLogin=true 时由前端接着拉起登录。"""
    _uid()
    if platform not in getattr(legacy, "LOGIN_RUNNERS", {}):
        raise HTTPException(404, "未知平台")
    try:
        cleanup = await asyncio.to_thread(_repair_account_sync, platform)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"重置失败：{exc}")
    who = await legacy.api_account_whoami(platform)
    return {
        "ok": True,
        "platform": platform,
        "cleanup": cleanup,
        "whoami": who,
        "needLogin": not bool(who.get("loggedIn")),
    }

_orig_chat = legacy.api_chat


async def guarded_chat(req):
    _uid()
    tok = SESSION.set(getattr(req, "sessionId", None))
    try:
        return await _orig_chat(req)
    finally:
        SESSION.reset(tok)


_orig_stream = legacy.api_chat_stream


async def guarded_stream(req):
    _uid()
    tok = SESSION.set(getattr(req, "sessionId", None))
    try:
        return await _orig_stream(req)
    finally:
        SESSION.reset(tok)


_orig_skill = legacy.api_skill


async def guarded_skill(req):
    _uid()
    tok = SESSION.set(None)
    try:
        return await _orig_skill(req)
    finally:
        SESSION.reset(tok)


_wrap_route("/api/chat", guarded_chat)
_wrap_route("/api/chat/stream", guarded_stream)
_wrap_route("/api/skill", guarded_skill)

_orig_register = legacy.api_register
_orig_login = legacy.api_login
_orig_logout = legacy.api_logout


async def auth_register(req):
    res = await _orig_register(req)
    _save_tokens()
    return res


async def auth_login(req):
    res = await _orig_login(req)
    _save_tokens()
    return res


async def auth_logout(req):
    res = await _orig_logout(req)
    _save_tokens()
    return res


_wrap_route("/api/auth/register", auth_register)
_wrap_route("/api/auth/login", auth_login)
_wrap_route("/api/auth/logout", auth_logout)


# ---- 飞书 OAuth 绑定（只存用户身份，用于账号页显示已登录 + 浏览器会话免登） ----
def _feishu_cfg_for_uid(uid: str) -> dict:
    p = pathlib.Path(__file__).resolve().parent.parent / "data" / "users" / uid / "outputs" / "_push.json"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    domain = str(data.get("feishu_domain") or "feishu").strip().lower()
    return {
        "app_id": str(data.get("feishu_app_id") or ""),
        "app_secret": str(data.get("feishu_app_secret") or ""),
        "domain": domain if domain in ("feishu", "larksuite") else "feishu",
        "redirect_uri": str(data.get("feishu_redirect_uri") or "").strip(),
    }


def _feishu_binding_path(uid: str) -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent / "data" / "users" / uid / "feishu_account.json"


def _feishu_oauth_host(cfg: dict) -> str:
    return "open.larksuite.com" if cfg.get("domain") == "larksuite" else "open.feishu.cn"


def _feishu_callback_html(title: str, message: str, ok: bool = True) -> HTMLResponse:
    color = "#16a34a" if ok else "#dc2626"
    safe_title = html.escape(title)
    safe_msg = html.escape(message)
    return HTMLResponse(
        "<!doctype html><html><head><meta charset='utf-8'><title>"
        + safe_title
        + "</title></head><body style=\"margin:0;min-height:100vh;display:flex;align-items:center;"
        "justify-content:center;background:#f7f8fa;font-family:system-ui,-apple-system,'Segoe UI',sans-serif\">"
        "<div style='background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px 40px;"
        "box-shadow:0 8px 30px rgba(0,0,0,.06);text-align:center;max-width:460px'>"
        "<h2 style='margin:0 0 10px;color:" + color + ";font-size:20px'>" + safe_title + "</h2>"
        "<p style='margin:0;color:#4b5563;line-height:1.7;font-size:14px'>" + safe_msg + "</p>"
        "<p style='margin:18px 0 0;color:#9ca3af;font-size:12px'>可以关闭此页面，回到 Easel 查看状态。</p>"
        "</div></body></html>",
        status_code=200 if ok else 400,
    )


@app.get("/api/auth/feishu/status")
async def api_feishu_status():
    uid = _uid()
    p = _feishu_binding_path(uid)
    if p.is_file():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            return {"logged_in": True, "name": str(d.get("name") or ""),
                    "avatar": str(d.get("avatar") or ""), "bound_at": d.get("bound_at")}
        except Exception:
            pass
    return {"logged_in": False}


@app.post("/api/auth/feishu/start")
async def api_feishu_start(request: Request):
    uid = _uid()
    cfg = _feishu_cfg_for_uid(uid)
    if not cfg["app_id"] or not cfg["app_secret"]:
        raise HTTPException(400, "请先在 设置 → 推送配置 → 飞书多维表格 填写 App ID / App Secret")
    redirect_uri = cfg.get("redirect_uri") or (str(request.base_url).rstrip("/") + "/api/auth/feishu/callback")
    ts = str(int(time.time()))
    nonce = uuid.uuid4().hex[:8]
    raw = f"{uid}.{ts}.{nonce}"
    sig = hmac.new(cfg["app_secret"].encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    state = raw + "." + sig
    qs = urllib.parse.urlencode({
        "app_id": cfg["app_id"],
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
    })
    url = f"https://{_feishu_oauth_host(cfg)}/open-apis/authen/v1/authorize?{qs}"
    return {"url": url, "redirect_uri": redirect_uri}


async def _feishu_user_token(cfg: dict, code: str, redirect_uri: str) -> str:
    host = _feishu_oauth_host(cfg)
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"https://{host}/open-apis/authen/v2/oauth/token",
            json={"grant_type": "authorization_code", "client_id": cfg["app_id"],
                  "client_secret": cfg["app_secret"], "code": code, "redirect_uri": redirect_uri},
        )
        try:
            v2 = r.json()
        except Exception:
            v2 = {}
        token = str(v2.get("access_token") or (v2.get("data") or {}).get("access_token") or "")
        if token:
            return token
        # 兼容旧版：app_access_token + authen/v1/access_token
        app = await client.post(
            f"https://{host}/open-apis/auth/v3/app_access_token/internal",
            json={"app_id": cfg["app_id"], "app_secret": cfg["app_secret"]},
        )
        try:
            app_data = app.json()
        except Exception:
            app_data = {}
        app_token = str(app_data.get("app_access_token") or (app_data.get("data") or {}).get("app_access_token") or "")
        if not app_token:
            raise HTTPException(502, f"飞书应用令牌获取失败：{app_data.get('msg') or v2.get('msg') or '未知错误'}")
        r1 = await client.post(
            f"https://{host}/open-apis/authen/v1/access_token",
            headers={"Authorization": "Bearer " + app_token},
            json={"grant_type": "authorization_code", "code": code},
        )
        try:
            v1 = r1.json()
        except Exception:
            v1 = {}
        token = str((v1.get("data") or {}).get("access_token") or v1.get("access_token") or "")
        if not token:
            raise HTTPException(502, f"飞书用户令牌获取失败：{v1.get('msg') or v2.get('msg') or '未知错误'}")
        return token


async def _feishu_user_info(cfg: dict, token: str) -> dict:
    host = _feishu_oauth_host(cfg)
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"https://{host}/open-apis/authen/v1/user_info",
                             headers={"Authorization": "Bearer " + token})
    try:
        data = r.json()
    except Exception:
        data = {}
    user = data.get("data") or {}
    if not user.get("open_id"):
        raise HTTPException(502, f"飞书用户信息获取失败：{data.get('msg') or '未知错误'}")
    return user


@app.get("/api/auth/feishu/callback")
async def api_feishu_callback(request: Request, code: str = "", state: str = "",
                               error: str = "", error_description: str = ""):
    if error:
        return _feishu_callback_html("飞书登录未完成", error_description or error, ok=False)
    parts = (state or "").split(".")
    if len(parts) != 4 or not code:
        return _feishu_callback_html("飞书登录失败", "回调参数不完整，请重新发起登录。", ok=False)
    uid, ts_s, nonce, sig = parts
    cfg = _feishu_cfg_for_uid(uid)
    if not cfg["app_id"] or not cfg["app_secret"]:
        return _feishu_callback_html("飞书登录失败", "当前账号没有飞书应用配置。", ok=False)
    expect = hmac.new(cfg["app_secret"].encode("utf-8"),
                      f"{uid}.{ts_s}.{nonce}".encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expect):
        return _feishu_callback_html("飞书登录失败", "登录状态校验失败，请重新发起。", ok=False)
    try:
        if time.time() - int(ts_s) > 900:
            return _feishu_callback_html("飞书登录已过期", "请回到 Easel 重新点击飞书登录。", ok=False)
    except ValueError:
        return _feishu_callback_html("飞书登录失败", "登录状态无效，请重新发起。", ok=False)
    redirect_uri = cfg.get("redirect_uri") or (str(request.base_url).rstrip("/") + "/api/auth/feishu/callback")
    try:
        token = await _feishu_user_token(cfg, code, redirect_uri)
        user = await _feishu_user_info(cfg, token)
        p = _feishu_binding_path(uid)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({
            "open_id": str(user.get("open_id") or ""),
            "union_id": str(user.get("union_id") or ""),
            "name": str(user.get("name") or user.get("en_name") or ""),
            "avatar": str(user.get("avatar_url") or ""),
            "bound_at": int(time.time()),
            "domain": cfg["domain"],
        }, ensure_ascii=False), encoding="utf-8")
        return _feishu_callback_html("飞书登录成功", f"已绑定飞书账号：{user.get('name') or ''}")
    except HTTPException as exc:
        return _feishu_callback_html("飞书登录失败", str(exc.detail), ok=False)
    except Exception as exc:  # noqa: BLE001
        return _feishu_callback_html("飞书登录失败", str(exc)[:200], ok=False)


@app.post("/api/auth/feishu/logout")
async def api_feishu_logout():
    uid = _uid()
    try:
        _feishu_binding_path(uid).unlink()
    except FileNotFoundError:
        pass
    except OSError as exc:
        raise HTTPException(500, f"解除绑定失败：{exc}")
    return {"ok": True}

_PUSH_FILE_NAME = "_push.json"


def _push_file():
    return _outputs() / _PUSH_FILE_NAME


def _load_push() -> dict:
    p = _push_file()
    if p.is_file():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                raw_webhook = str(data.get("wecom_webhook") or data.get("wecom") or "")
                if "qyapi.weixin.qq.com/cgi-bin/webhook/send" not in raw_webhook:
                    raw_webhook = ""
                domain = str(data.get("feishu_domain") or "feishu").strip().lower()
                if domain not in ("feishu", "larksuite"):
                    domain = "feishu"
                return {
                    "wecom_webhook": raw_webhook,
                    "wecom_bot_id": str(data.get("wecom_bot_id") or ""),
                    "wecom_bot_secret_set": bool(data.get("wecom_bot_secret_set")),
                    "dingtalk": str(data.get("dingtalk") or ""),
                    "dingtalk_secret": str(data.get("dingtalk_secret") or ""),
                    "feishu_app_id": str(data.get("feishu_app_id") or ""),
                    "feishu_app_secret": str(data.get("feishu_app_secret") or ""),
                    "feishu_app_secret_set": bool(data.get("feishu_app_secret_set")),
                    "feishu_domain": domain,
                    "feishu_folder_token": str(data.get("feishu_folder_token") or ""),
                    "feishu_redirect_uri": str(data.get("feishu_redirect_uri") or ""),
                    "feishu_bitable_app_token": str(data.get("feishu_bitable_app_token") or ""),
                    "feishu_bitable_url": str(data.get("feishu_bitable_url") or ""),
                    "feishu_table_schedule_id": str(data.get("feishu_table_schedule_id") or ""),
                    "feishu_table_projects_id": str(data.get("feishu_table_projects_id") or ""),
                }
        except Exception:
            pass
    return {"wecom_webhook": "", "wecom_bot_id": "", "wecom_bot_secret_set": False,
            "dingtalk": "", "dingtalk_secret": "",
            "feishu_app_id": "", "feishu_app_secret": "", "feishu_app_secret_set": False,
            "feishu_domain": "feishu", "feishu_folder_token": "", "feishu_redirect_uri": "",
            "feishu_bitable_app_token": "", "feishu_bitable_url": "",
            "feishu_table_schedule_id": "", "feishu_table_projects_id": ""}


def _save_push(data: dict):
    p = _push_file()
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(p)


def _openclaw_cmd() -> Path:
    return Path(__file__).resolve().parents[3] / "dist" / "node" / "openclaw.cmd"


def _get_wecom_bot() -> dict:
    try:
        oc = json.loads((Path.home() / ".openclaw-easel" / "openclaw.json").read_text(encoding="utf-8"))
        wecom = ((oc.get("channels") or {}).get("wecom") or {})
        return {"bot_id": str(wecom.get("botId") or ""), "secret_set": bool(wecom.get("secret"))}
    except Exception:
        return {"bot_id": "", "secret_set": False}


def _set_wecom_bot(bot_id: str, bot_secret: str):
    cmd = _openclaw_cmd()
    if not cmd.is_file():
        raise RuntimeError("找不到 OpenClaw CLI")
    args = [str(cmd), "--profile", "easel", "config", "set"]
    if bot_id:
        r = subprocess.run(args + ["channels.wecom.botId", bot_id], capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=60)
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "写入 Bot ID 失败")[:300])
    if bot_secret:
        r = subprocess.run(args + ["channels.wecom.secret", bot_secret], capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=60)
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "写入 Secret 失败")[:300])
    if bot_id or bot_secret:
        subprocess.run(args + ["channels.wecom.enabled", "true"], capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=60)


def _push_markdown(title: str, url: str, note: str) -> str:
    parts = [f"### {title}", f"[打开预览]({url})"]
    if note:
        parts.append(note)
    parts.append("> 预览链接有时效，正式发布后请用公开链接。")
    return "\n\n".join(parts)


async def _send_wecom(webhook: str, text: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(webhook, json={"msgtype": "markdown", "markdown": {"content": text}})
    try:
        data = r.json()
    except Exception:
        data = {}
    if r.status_code != 200 or data.get("errcode") not in (0, None):
        raise RuntimeError(f"企业微信群机器人返回 {r.status_code}: {data or r.text[:200]}")
    return "企业微信群机器人已发送"


async def _send_dingtalk(webhook: str, secret: str, title: str, text: str):
    url = webhook
    if secret:
        ts = str(int(time.time() * 1000))
        digest = hmac.new(secret.encode("utf-8"), f"{ts}\n{secret}".encode("utf-8"), hashlib.sha256).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(digest))
        url += ("&" if "?" in url else "?") + f"timestamp={ts}&sign={sign}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json={"msgtype": "markdown", "markdown": {"title": title, "text": text}})
    try:
        data = r.json()
    except Exception:
        data = {}
    if r.status_code != 200 or data.get("errcode") not in (0, None):
        raise RuntimeError(f"钉钉返回 {r.status_code}: {data or r.text[:200]}")
    return "钉钉已发送"


def _feishu_host(domain: str) -> str:
    return "open.larksuite.com" if (domain or "").lower() == "larksuite" else "open.feishu.cn"


async def _feishu_tenant_token(app_id: str, app_secret: str, domain: str) -> str:
    """校验飞书自建应用凭证，返回 tenant_access_token（不回显 secret）。"""
    if not app_id or not app_secret:
        raise RuntimeError("未配置飞书 App ID / App Secret")
    url = f"https://{_feishu_host(domain)}/open-apis/auth/v3/tenant_access_token/internal"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json={"app_id": app_id, "app_secret": app_secret})
    try:
        data = r.json()
    except Exception:
        data = {}
    token = str(data.get("tenant_access_token") or "")
    if r.status_code != 200 or not token:
        raise RuntimeError(f"飞书凭证校验失败：{data.get('msg') or data.get('code') or r.text[:200]}")
    return token


@app.get("/api/push/config")
async def api_push_config_get(request: Request):
    _uid()
    bot = _get_wecom_bot()
    cfg = _load_push()
    return {
        "wecom_bot_id": bot["bot_id"] or cfg.get("wecom_bot_id", ""),
        "wecom_bot_secret_set": bot["secret_set"] or bool(cfg.get("wecom_bot_secret_set")),
        "wecom_webhook": cfg["wecom_webhook"],
        "dingtalk": cfg["dingtalk"],
        "dingtalk_secret": cfg["dingtalk_secret"],
        "feishu_app_id": cfg["feishu_app_id"],
        "feishu_app_secret_set": bool(cfg["feishu_app_secret_set"]),
        "feishu_domain": cfg["feishu_domain"],
        "feishu_folder_token": cfg["feishu_folder_token"],
        "feishu_redirect_uri": cfg.get("feishu_redirect_uri") or (
            str(request.base_url).rstrip("/") + "/api/auth/feishu/callback"),
    }


@app.post("/api/push/config")
async def api_push_config_save(payload: dict = Body(...)):
    _uid()
    bot_id = str(payload.get("wecom_bot_id") or "").strip()
    bot_secret = str(payload.get("wecom_bot_secret") or "").strip()
    webhook = str(payload.get("wecom_webhook") or "").strip()
    dingtalk = str(payload.get("dingtalk") or "").strip()
    dingtalk_secret = str(payload.get("dingtalk_secret") or "").strip()
    feishu_app_id = str(payload.get("feishu_app_id") or "").strip()
    feishu_app_secret = str(payload.get("feishu_app_secret") or "").strip()
    feishu_domain = str(payload.get("feishu_domain") or "feishu").strip().lower()
    feishu_folder_token = str(payload.get("feishu_folder_token") or "").strip()
    feishu_redirect_uri = str(payload.get("feishu_redirect_uri") or "").strip()
    if feishu_domain not in ("feishu", "larksuite"):
        raise HTTPException(400, "飞书版本只能是 feishu（国内版）或 larksuite（国际版）")
    if feishu_redirect_uri and not feishu_redirect_uri.startswith(("http://", "https://")):
        raise HTTPException(400, "飞书 OAuth 回调地址必须是 http(s) 地址")
    if webhook and not webhook.startswith("http"):
        raise HTTPException(400, "企业微信群机器人 Webhook 必须是 http(s) 地址")
    if dingtalk and not dingtalk.startswith("http"):
        raise HTTPException(400, "钉钉 Webhook 必须是 http(s) 地址")
    if bot_id or bot_secret:
        try:
            _set_wecom_bot(bot_id, bot_secret)
        except Exception as e:
            raise HTTPException(500, f"写入企业微信智能机器人配置失败：{e}")
    state = _get_wecom_bot()
    prev = _load_push()
    saved_feishu_secret = feishu_app_secret or prev.get("feishu_app_secret", "")
    _save_push({
        "wecom_webhook": webhook,
        "wecom_bot_id": bot_id or state["bot_id"],
        "wecom_bot_secret_set": bool(bot_secret or state["secret_set"]),
        "dingtalk": dingtalk,
        "dingtalk_secret": dingtalk_secret,
        "feishu_app_id": feishu_app_id,
        "feishu_app_secret": saved_feishu_secret,
        "feishu_app_secret_set": bool(saved_feishu_secret),
        "feishu_domain": feishu_domain,
        "feishu_folder_token": feishu_folder_token,
        "feishu_redirect_uri": feishu_redirect_uri,
        "feishu_bitable_app_token": prev.get("feishu_bitable_app_token", ""),
        "feishu_bitable_url": prev.get("feishu_bitable_url", ""),
        "feishu_table_schedule_id": prev.get("feishu_table_schedule_id", ""),
        "feishu_table_projects_id": prev.get("feishu_table_projects_id", ""),
    })
    return {"ok": True}


@app.post("/api/push/test")
async def api_push_test(payload: dict = Body(...)):
    _uid()
    cfg = _load_push()
    channels = payload.get("channels") or ["wecom", "dingtalk"]
    text = _push_markdown("推送测试", "https://mp.weixin.qq.com/", "这是一条测试消息。")
    results = {}
    for ch in channels:
        try:
            if ch == "wecom":
                if not cfg["wecom_webhook"]:
                    raise RuntimeError("未配置企业微信群机器人 Webhook；智能机器人请在对话里推送")
                results[ch] = {"ok": True, "message": await _send_wecom(cfg["wecom_webhook"], text)}
            elif ch == "dingtalk":
                if not cfg["dingtalk"]:
                    raise RuntimeError("未配置钉钉 Webhook")
                results[ch] = {"ok": True, "message": await _send_dingtalk(
                    cfg["dingtalk"], cfg["dingtalk_secret"], "推送测试", text)}
            elif ch == "feishu":
                await _feishu_tenant_token(
                    cfg["feishu_app_id"], cfg["feishu_app_secret"], cfg["feishu_domain"])
                results[ch] = {"ok": True, "message": "飞书应用凭证有效，可调用多维表格 API"}
        except Exception as e:
            results[ch] = {"ok": False, "message": str(e)[:300]}
    return {"ok": all(x.get("ok") for x in results.values()), "results": results}


@app.post("/api/push")
async def api_push(payload: dict = Body(...)):
    _uid()
    title = str(payload.get("title") or "").strip()
    url = str(payload.get("url") or "").strip()
    note = str(payload.get("note") or "").strip()
    channels = payload.get("channels") or ["wecom", "dingtalk"]
    if not title:
        raise HTTPException(400, "标题不能为空")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "预览链接必须是 http(s) 地址")
    cfg = _load_push()
    text = _push_markdown(title, url, note)
    results = {}
    for ch in channels:
        try:
            if ch == "wecom":
                if not cfg["wecom_webhook"]:
                    raise RuntimeError("未配置企业微信群机器人 Webhook；智能机器人请在对话里推送")
                results[ch] = {"ok": True, "message": await _send_wecom(cfg["wecom_webhook"], text)}
            elif ch == "dingtalk":
                if not cfg["dingtalk"]:
                    raise RuntimeError("未配置钉钉 Webhook")
                results[ch] = {"ok": True, "message": await _send_dingtalk(
                    cfg["dingtalk"], cfg["dingtalk_secret"], title, text)}
        except Exception as e:
            results[ch] = {"ok": False, "message": str(e)[:300]}
    if not results:
        raise HTTPException(400, "没有选择推送渠道")
    return {"ok": all(x.get("ok") for x in results.values()), "results": results}


# ---- 官网 Maywide（Next.js 后台）账号：凭证式登录 ----
_MAYWIDE_PLATFORM = "maywide"
if _MAYWIDE_PLATFORM not in getattr(legacy, "LOGIN_RUNNERS", {}):
    legacy.LOGIN_RUNNERS[_MAYWIDE_PLATFORM] = {
        "name": "官网 Maywide",
        "backend": "cms",
        "note": "官网后台（Next.js）",
    }

_orig_cms_verify = getattr(legacy, "_cms_verify", None)


def _maywide_verify(platform, acc):
    if platform != _MAYWIDE_PLATFORM:
        return _orig_cms_verify(platform, acc) if _orig_cms_verify else (False, "未配置校验器")
    site = str(acc.get("siteUrl") or "").strip().rstrip("/")
    user = str(acc.get("username") or "").strip()
    secret = str(acc.get("secret") or "")
    if not site.startswith(("http://", "https://")):
        site = "http://" + site
    if site.endswith("/admin"):
        site = site[:-6].rstrip("/")
    if not (site and user and secret):
        return False, "站点地址 / 用户名 / 密码都要填"
    try:
        body = json.dumps({"username": user, "password": secret}).encode("utf-8")
        req = urllib.request.Request(
            site + "/api/admin/login",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8", "replace")
            status = r.status
        data = json.loads(raw) if raw else {}
        if status == 200 and data.get("ok", True):
            return True, "验证通过：" + user
        return False, str(data.get("message") or "登录失败")
    except Exception as exc:
        return False, "登录请求失败：" + type(exc).__name__


if _orig_cms_verify:
    legacy._cms_verify = _maywide_verify


# ---- 官网资源发布（Next.js 后台 /admin/content/resource）----
_IMAGE_EXTS = getattr(legacy, "IMAGE_EXTS", {".png", ".jpg", ".jpeg", ".webp", ".gif"})


def _maywide_md_to_html(text: str) -> str:
    t = str(text or "").strip()
    if not t:
        return ""
    if re.search(r"<(p|h[1-6]|ul|ol|div|img|br)\b", t, re.I):
        return t
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" />', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    blocks = []
    for block in re.split(r"\n\s*\n", t):
        block = block.strip()
        if not block:
            continue
        if block.startswith("### "):
            blocks.append("<h3>" + block[4:] + "</h3>")
        elif block.startswith("## "):
            blocks.append("<h2>" + block[3:] + "</h2>")
        elif block.startswith("# "):
            blocks.append("<h1>" + block[2:] + "</h1>")
        elif all(line.strip().startswith(("- ", "* ")) for line in block.splitlines()):
            items = "".join("<li>" + line.strip()[2:] + "</li>" for line in block.splitlines())
            blocks.append("<ul>" + items + "</ul>")
        else:
            blocks.append("<p>" + block.replace("\n", "<br />") + "</p>")
    return "\n".join(blocks)


def _maywide_publish_sync(title: str, body: str, media, tags: str) -> str:
    import requests

    cfg = legacy._cms_get("maywide")
    if not legacy._cms_has("maywide"):
        raise RuntimeError("请先在账号页配置官网 Maywide 账号")
    site = str(cfg.get("siteUrl") or "").strip().rstrip("/")
    if not site.startswith(("http://", "https://")):
        site = "http://" + site
    if site.endswith("/admin"):
        site = site[:-6].rstrip("/")

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    s = requests.Session()
    s.headers.update({"User-Agent": ua})
    r = s.post(site + "/api/admin/login", json={
        "username": cfg.get("username", ""), "password": cfg.get("secret", ""),
    }, timeout=20)
    if r.status_code != 200 or not (r.json() or {}).get("ok"):
        raise RuntimeError("官网后台登录失败")

    cover_url = ""
    for rel in (media or []):
        try:
            full = legacy._safe_output_path(rel)
        except Exception:
            continue
        if getattr(full, "suffix", "").lower() not in _IMAGE_EXTS or not full.is_file():
            continue
        ext = full.suffix.lower()
        ctype = {".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")
        with open(full, "rb") as fh:
            up = s.post(site + "/api/admin/media", files={"file": (full.name, fh, ctype)}, timeout=60)
        if up.status_code == 200:
            cover_url = str((up.json() or {}).get("url") or "")
            if cover_url:
                break

    html_body = _maywide_md_to_html(body) or ("<p>" + html.escape(title) + "</p>")
    plain = re.sub(r"<[^>]+>", "", html_body)
    plain = re.sub(r"\s+", " ", html.unescape(plain)).strip()
    summary = plain[:120] or title[:120]
    known_types = ["行业报告", "白皮书", "指南", "方案", "资料"]
    resource_type = next((k for k in known_types if k in str(tags or "")), "行业报告")
    slug = "resource-" + time.strftime("%Y%m%d%H%M%S")
    record = {
        "status": "draft",
        "seoTitle": title[:70],
        "seoDescription": summary[:200],
        "shareImage": cover_url,
        "canonicalPath": "/resources/" + slug,
        "slug": slug,
        "resourceType": resource_type,
        "title": title,
        "summary": summary,
        "cover": cover_url,
        "publishedAt": time.strftime("%Y-%m-%d"),
        "topic": "",
        "body": html_body,
        "sort": 0,
    }
    cr = s.post(site + "/api/admin/content/resource", json=record, timeout=30)
    if cr.status_code != 200:
        raise RuntimeError("创建资源失败：" + (cr.text or "")[:200])
    rid = (cr.json() or {}).get("id")
    if not rid:
        raise RuntimeError("创建资源成功但未返回 id")
    pub = s.post(site + "/api/admin/content/resource/" + str(rid) + "?action=publish", timeout=30)
    if pub.status_code != 200:
        raise RuntimeError("资源已创建为草稿，但发布失败（id=" + str(rid) + "）")
    return site + "/resources/" + slug


@app.post("/api/maywide/publish")
async def _api_maywide_publish(request: Request):
    _uid()
    payload = await request.json()
    title = str((payload or {}).get("title") or "").strip()
    body = str((payload or {}).get("body") or "")
    media = list((payload or {}).get("media") or [])
    tags = str((payload or {}).get("tags") or "")
    if not title and not body.strip():
        raise HTTPException(400, "标题/正文不能为空")
    try:
        url = await asyncio.to_thread(_maywide_publish_sync, title, body, media, tags)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"官网发布失败：{exc}")
    return {"ok": True, "message": "已发布到官网资源", "detail": url}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("EASEL_WEB_PORT", "7866")))
