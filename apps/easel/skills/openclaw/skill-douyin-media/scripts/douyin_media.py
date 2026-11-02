#!/usr/bin/env python3
"""抖音素材解析：无水印视频 / 音频 / 封面 / 字幕。

优先用本机已登录的 DouyinProfile + Playwright 解析抖音页面（无需第三方 key）；
也可配置自建解析 API（Evil0ctal v5 / ucmao media-parser）作为服务端方案。
字幕优先用视频自带 caption；没有则用本地 faster-whisper（asr.py）转写。

用法（在 Easel 项目根）：
  python skills/openclaw/skill-douyin-media/scripts/douyin_media.py check
  python skills/openclaw/skill-douyin-media/scripts/douyin_media.py parse --url "https://v.douyin.com/xxx/"
  python skills/openclaw/skill-douyin-media/scripts/douyin_media.py download --url "..." --out outputs/抖音素材
  python skills/openclaw/skill-douyin-media/scripts/douyin_media.py all --url "..." --out outputs/抖音素材

自建 API（可选）：
  DOUYIN_API_BASE=http://127.0.0.1:8080     # Evil0ctal v5 或 media-parser
  DOUYIN_API_KEY=dtk_xxx                    # Evil0ctal v5 需要；media-parser 可留空
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PROFILE = Path.home() / ".easel-browser-profiles" / "DouyinProfile"
sys.path.insert(0, str(ROOT / "skills" / "shared" / "scripts"))
import browser_stealth  # noqa: E402
import profile_lock  # noqa: E402
AUTH_COOKIE_NAMES = {
    "sessionid", "sessionid_ss", "sid_guard", "uid_tt", "uid_tt_ss",
    "sid_tt", "passport_auth_status", "passport_assist_user",
}
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def out(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def die(msg: str, code: int = 1) -> None:
    print(f"抖音解析失败：{msg}", file=sys.stderr)
    raise SystemExit(code)


def find_ffmpeg() -> str | None:
    p = shutil.which("ffmpeg")
    if p:
        return p
    for c in [
        Path(r"C:\ffmpeg-8.1.1-full_build\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"),
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
    ]:
        if c.is_file():
            return str(c)
    return None


def api_config() -> dict:
    return {
        "base": os.environ.get("DOUYIN_API_BASE", "").strip().rstrip("/"),
        "key": os.environ.get("DOUYIN_API_KEY", "").strip(),
    }


# ── 本地页面解析 ─────────────────────────────────────────────────────
def _load_page_json(page) -> list[dict]:
    payloads = []
    for sid in ("RENDER_DATA", "__NEXT_DATA__", "SIGI_STATE"):
        try:
            raw = page.eval_on_selector(
                f"script#{sid}", "el => el.textContent || ''"
            )
        except Exception:
            continue
        if not raw:
            continue
        for candidate in (raw, urllib.parse.unquote(raw)):
            try:
                payloads.append(json.loads(candidate))
                break
            except Exception:
                continue
    for expr in ("window._ROUTER_DATA", "window.__INITIAL_STATE__"):
        try:
            data = page.evaluate(f"() => {expr} || null")
            if isinstance(data, (dict, list)):
                payloads.append(data)
        except Exception:
            pass
    return payloads


def _walk_find(obj, pred, depth=0):
    if depth > 12:
        return None
    if isinstance(obj, dict):
        try:
            if pred(obj):
                return obj
        except Exception:
            pass
        for v in obj.values():
            r = _walk_find(v, pred, depth + 1)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _walk_find(v, pred, depth + 1)
            if r is not None:
                return r
    return None


def _pick_url(value) -> str:
    if isinstance(value, str):
        return value if value.startswith("http") else ""
    if isinstance(value, list):
        for x in value:
            u = _pick_url(x)
            if u:
                return u
    if isinstance(value, dict):
        for k in ("url_list", "uri", "url", "src"):
            u = _pick_url(value.get(k))
            if u:
                return u
    return ""


def _extract_from_payloads(payloads: list[dict]) -> dict:
    def is_aweme(d):
        return isinstance(d, dict) and ("aweme_id" in d or "awemeId" in d) and (
            "video" in d or "desc" in d or "images" in d
        )
    aweme = None
    for p in payloads:
        aweme = _walk_find(p, is_aweme)
        if aweme:
            break
    if not aweme:
        return {}
    video = aweme.get("video") or {}
    music = aweme.get("music") or {}
    author = aweme.get("author") or {}
    captions = []

    def collect_caption(d):
        if isinstance(d, dict):
            for k, v in d.items():
                kl = k.lower()
                if "caption" in kl or "subtitle" in kl:
                    u = _pick_url(v)
                    if u and u not in captions:
                        captions.append(u)
                    if isinstance(v, str) and v.startswith("http") and v not in captions:
                        captions.append(v)
                collect_caption(v)
        elif isinstance(d, list):
            for v in d:
                collect_caption(v)
    collect_caption(video)
    collect_caption(aweme.get("caption_info") or {})
    collect_caption(aweme.get("caption_infos") or {})

    return {
        "aweme_id": str(aweme.get("aweme_id") or aweme.get("awemeId") or ""),
        "title": str(aweme.get("desc") or aweme.get("preview_title") or "").strip(),
        "author": str(author.get("nickname") or author.get("unique_id") or "").strip(),
        "video_url": _pick_url(video.get("play_addr")) or _pick_url(video.get("play_addr_h264"))
                     or _pick_url(video.get("download_addr")) or _pick_url(video),
        "audio_url": _pick_url(music.get("play_url")) or _pick_url(music),
        "audio_is_music": bool(_pick_url(music.get("play_url")) or _pick_url(music)),
        "cover_url": _pick_url(video.get("cover")) or _pick_url(video.get("origin_cover"))
                     or _pick_url(video.get("dynamic_cover")),
        "captions": captions,
        "duration_ms": video.get("duration"),
        "stats": aweme.get("statistics") or {},
    }


def _meta_from_page(page) -> dict:
    def meta(prop):
        try:
            el = page.query_selector(f'meta[property="{prop}"], meta[name="{prop}"]')
            return (el.get_attribute("content") or "").strip() if el else ""
        except Exception:
            return ""
    video = meta("og:video") or meta("og:video:url")
    image = meta("og:image")
    title = meta("og:title")
    desc = meta("og:description") or meta("description")
    if not (video or image or title):
        return {}
    return {"title": title or desc, "video_url": video, "cover_url": image,
            "audio_url": "", "captions": [], "author": "", "aweme_id": ""}


def _profile_has_auth() -> bool:
    cookie = PROFILE / "Default" / "Network" / "Cookies"
    if not cookie.is_file():
        return False
    try:
        import sqlite3
        c = sqlite3.connect(f"file:{cookie}?mode=ro", uri=True)
        rows = c.execute(
            "select name from cookies where host_key like '%douyin%' "
            "and (value != '' or length(encrypted_value) > 0)"
        ).fetchall()
        return any(n in AUTH_COOKIE_NAMES for (n,) in rows)
    except Exception:
        return False


def parse_local(url: str, headed: bool = False) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # noqa: BLE001
        die(f"缺少 playwright：{exc}")
    if not PROFILE.is_dir():
        die(f"找不到抖音登录目录：{PROFILE}（先在账号页登录抖音）")
    # 与登录/发布共用同一把锁，避免解析素材时把登录态/SingletonLock 冲掉
    lock = profile_lock.acquire(PROFILE, wait_s=30)
    if lock is None:
        die(f"抖音登录目录正被登录/发布占用（PID={profile_lock.holder_pid(PROFILE)}），请稍后重试")
    with sync_playwright() as p:
        try:
            kwargs = dict(
                headless=not headed, locale="zh-CN",
                args=["--disable-blink-features=AutomationControlled",
                      "--no-first-run", "--no-default-browser-check"],
                timeout=30000,
            )
            kwargs.update(browser_stealth.context_kwargs())
            ctx = p.chromium.launch_persistent_context(str(PROFILE), **kwargs)
            ctx.add_init_script(browser_stealth.INIT_SCRIPT)
        except Exception as exc:  # noqa: BLE001
            profile_lock.release(lock)
            die(f"打不开抖音浏览器（可能正在发布/登录，或被其他进程占用）：{exc}")
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            detail: dict = {}

            def on_response(resp):
                if detail or "/aweme/detail/" not in resp.url:
                    return
                try:
                    j = resp.json()
                    if isinstance(j, dict) and isinstance(j.get("aweme_detail"), dict):
                        detail.update(j)
                except Exception:
                    pass

            page.on("response", on_response)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception:
                pass
            page.wait_for_timeout(8000)
            final_url = page.url
            payloads = ([detail] if detail else []) + _load_page_json(page)
            data = _extract_from_payloads(payloads)
            if not data:
                data = _meta_from_page(page)
            if data:
                data["url"] = final_url
                data["source"] = "local-page"
                return data
            if "share/forward" in final_url:
                die("这个短链是分享转发页，不是视频页；请打开具体视频后复制链接")
            die("页面里没有找到视频数据（可能需要登录/改版，或链接不是单条视频）")
        finally:
            try:
                ctx.close()
            except Exception:
                pass
            profile_lock.release(lock)


# ── 自建 API ─────────────────────────────────────────────────────────
def parse_api(url: str, cfg: dict) -> dict:
    import httpx
    base, key = cfg["base"], cfg["key"]
    headers = {"User-Agent": UA}
    if key:
        headers["X-API-Key"] = key
        headers["Authorization"] = "Bearer " + key
    # 1) media-parser: /api/v1/parse?url=
    candidates = [
        f"{base}/api/v1/parse",
        f"{base}/api/v1/douyin/video",
        f"{base}/api/hybrid/video_data",
    ]
    last = None
    for u in candidates:
        try:
            r = httpx.get(u, params={"url": url}, headers=headers, timeout=40, follow_redirects=True)
            if r.status_code != 200:
                last = f"{u} -> HTTP {r.status_code}: {r.text[:160]}"
                continue
            d = r.json()
            data = d.get("data") if isinstance(d, dict) else None
            if not isinstance(data, dict):
                data = d if isinstance(d, dict) else {}
            # media-parser
            if data.get("video_url"):
                return {
                    "aweme_id": str(data.get("id") or data.get("aweme_id") or ""),
                    "title": str(data.get("title") or data.get("desc") or ""),
                    "author": str((data.get("author") or {}).get("name") if isinstance(data.get("author"), dict) else data.get("author") or ""),
                    "video_url": data.get("video_url") or "",
                    "audio_url": data.get("audio_url") or "",
                    "cover_url": data.get("cover_url") or "",
                    "captions": data.get("captions") or [],
                    "source": "api:" + u,
                }
            # Evil0ctal v5 normalized shape: find first mp4/mp3 in data recursively
            found = {"video_url": "", "audio_url": "", "cover_url": ""}
            def walk(o):
                if isinstance(o, dict):
                    for k, v in o.items():
                        kl = k.lower()
                        s = v if isinstance(v, str) else ""
                        if s.startswith("http"):
                            if not found["video_url"] and (".mp4" in s or kl in ("video_url", "play_url")):
                                found["video_url"] = s
                            elif not found["audio_url"] and (".mp3" in s or ".m4a" in s or kl in ("audio_url", "music_url")):
                                found["audio_url"] = s
                            elif not found["cover_url"] and (".jpg" in s or ".jpeg" in s or ".png" in s or ".webp" in s):
                                found["cover_url"] = s
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)
            walk(data)
            if found["video_url"]:
                found.update({
                    "aweme_id": str(data.get("aweme_id") or data.get("id") or ""),
                    "title": str(data.get("desc") or data.get("title") or ""),
                    "author": str(data.get("author") or ""),
                    "captions": data.get("captions") or [],
                    "source": "api:" + u,
                })
                return found
            last = f"{u} -> 200 但未识别视频字段：{json.dumps(d, ensure_ascii=False)[:200]}"
        except Exception as exc:  # noqa: BLE001
            last = f"{u} -> {exc}"
    raise RuntimeError(last or "自建 API 无响应")


def parse(url: str, headed: bool = False) -> dict:
    cfg = api_config()
    if cfg["base"]:
        try:
            d = parse_api(url, cfg)
            d["url"] = url
            return d
        except Exception as exc:  # noqa: BLE001
            print(f"[douyin] 自建 API 失败，回退本地页面：{exc}", file=sys.stderr)
    return parse_local(url, headed=headed)


# ── 下载 / 音频 / 字幕 ───────────────────────────────────────────────
def _download(url: str, dest: Path, referer: str = "https://www.douyin.com/") -> Path:
    import httpx
    dest.parent.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": UA, "Referer": referer}
    with httpx.stream("GET", url, headers=headers, timeout=120, follow_redirects=True) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_bytes(1024 * 256):
                f.write(chunk)
    return dest


def _safe_name(s: str, fallback: str = "douyin") -> str:
    s = re.sub(r'[\\/:*?"<>|]+', "_", (s or "").strip())
    return (s[:60] or fallback).strip(" ._")


def extract_audio(video: Path, out_audio: Path) -> Path | None:
    ff = find_ffmpeg()
    if not ff:
        die("没有找到 ffmpeg，无法提取音频")
    out_audio.parent.mkdir(parents=True, exist_ok=True)
    cmd = [ff, "-y", "-i", str(video), "-vn", "-c:a", "aac", "-b:a", "192k", str(out_audio)]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0 or not out_audio.is_file():
        err = p.stderr or ""
        if "does not contain any stream" in err or "no stream" in err.lower():
            return None
        die(f"ffmpeg 提取音频失败：{err[-300:]}")
    return out_audio


def make_subtitle(input_media: Path, out_srt: Path, model: str = "base",
                  engine: str = "auto") -> Path:
    import importlib.util
    local_ok = importlib.util.find_spec("faster_whisper") is not None

    def _local() -> Path:
        asr = ROOT / "skills" / "shared" / "scripts" / "asr.py"
        if not asr.is_file():
            die("缺少 asr.py")
        cmd = [sys.executable, str(asr), "transcribe", "-i", str(input_media), "-o", str(out_srt),
               "--language", "zh", "--model", model, "--format", "srt"]
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if p.returncode != 0 or not out_srt.is_file():
            msg = (p.stderr or p.stdout or "").strip()
            die(f"本地 ASR 失败：{msg[-500:]}")
        return out_srt

    def _cloud() -> Path:
        cloud = ROOT / "skills" / "openclaw" / "skill-douyin-media" / "scripts" / "dashscope_asr.py"
        if not cloud.is_file():
            die("缺少 dashscope_asr.py")
        cmd = [sys.executable, str(cloud), "-i", str(input_media), "-o", str(out_srt)]
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if p.returncode != 0 or not out_srt.is_file():
            msg = (p.stderr or p.stdout or "").strip()
            die(f"云 ASR 失败：{msg[-500:]}")
        return out_srt

    if engine == "local":
        if not local_ok:
            die("未安装 faster-whisper。安装：\n  pip install faster-whisper\n"
                "或改用 --subtitle-engine dashscope")
        return _local()
    if engine == "dashscope":
        return _cloud()
    # auto
    if local_ok:
        return _local()
    print("[douyin] 本地 faster-whisper 未安装，改用 DashScope 云转写", file=sys.stderr)
    return _cloud()


def download_all(data: dict, out_dir: Path) -> dict:
    out_dir = Path(out_dir)
    assets = out_dir / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    name = _safe_name(data.get("aweme_id") or data.get("title") or "douyin")
    result = {"out": str(out_dir), "video": "", "audio": "", "cover": "", "subtitle": "",
              "audio_is_music": bool(data.get("audio_is_music"))}
    if data.get("video_url"):
        v = _download(data["video_url"], assets / f"{name}.mp4", data.get("url") or "https://www.douyin.com/")
        result["video"] = str(v)
        audio = extract_audio(v, out_dir / f"{name}.m4a")
        result["audio"] = str(audio) if audio else ""
        result["audio_is_music"] = False
        if not audio:
            result["audio_error"] = "视频没有音轨（或只有画面）"
    elif data.get("audio_url"):
        a = _download(data["audio_url"], out_dir / f"{name}.m4a", data.get("url") or "https://www.douyin.com/")
        result["audio"] = str(a)
        result["audio_is_music"] = True
    else:
        die("没有拿到视频/音频直链（链接可能需要登录，或页面改版）")
    if data.get("cover_url"):
        try:
            result["cover"] = str(_download(data["cover_url"], assets / f"{name}-cover.jpg",
                                            data.get("url") or "https://www.douyin.com/"))
        except Exception as exc:  # noqa: BLE001
            print(f"[douyin] 封面下载失败：{exc}", file=sys.stderr)
    # 自带字幕优先
    for cap in data.get("captions") or []:
        try:
            ext = ".vtt" if ".vtt" in cap.lower() else ".srt"
            result["subtitle"] = str(_download(cap, out_dir / f"{name}{ext}",
                                               data.get("url") or "https://www.douyin.com/"))
            break
        except Exception:
            continue
    (out_dir / "meta.json").write_text(
        json.dumps({**data, "files": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def cmd_check(_a) -> int:
    ff = find_ffmpeg()
    try:
        import playwright  # noqa: F401
        pw = True
    except Exception:
        pw = False
    try:
        import faster_whisper  # noqa: F401
        fw = True
    except Exception:
        fw = False
    cfg = api_config()
    key_set = bool(os.environ.get("DASHSCOPE_API_KEY", "").strip())
    if not key_set:
        try:
            key_set = "DASHSCOPE_API_KEY=" in (ROOT / ".env").read_text(encoding="utf-8")
        except OSError:
            pass
    subtitle_backend = "local" if fw else ("dashscope" if key_set else "none")
    out({
        "ok": bool(pw and ff),
        "ffmpeg": ff or "未找到",
        "playwright": pw,
        "faster_whisper": fw,
        "dashscope_key_set": key_set,
        "subtitle_backend": subtitle_backend,
        "douyin_profile": str(PROFILE),
        "profile_logged_in": _profile_has_auth(),
        "api_base": cfg["base"] or "未配置（使用本地页面解析）",
        "api_key_set": bool(cfg["key"]),
    })
    return 0


def cmd_parse(a) -> int:
    out(parse(a.url, headed=a.headed))
    return 0


def cmd_download(a) -> int:
    data = parse(a.url, headed=a.headed)
    out(download_all(data, Path(a.out)))
    return 0


def cmd_all(a) -> int:
    data = parse(a.url, headed=a.headed)
    res = download_all(data, Path(a.out))
    if not res.get("subtitle"):
        if res.get("audio_is_music"):
            res["subtitle_error"] = "只有背景音乐（music.play_url），没有视频人声；换带人声的视频再转写"
        elif not res.get("audio"):
            res["subtitle_error"] = "视频没有音轨，无法生成字幕"
        elif not a.no_subtitle:
            try:
                srt = make_subtitle(Path(res["audio"]), Path(a.out) / "subtitle.srt",
                                    a.model, a.subtitle_engine)
                res["subtitle"] = str(srt)
            except SystemExit as exc:
                res["subtitle_error"] = str(exc)
    out(res)
    return 0


def build_parser():
    ap = argparse.ArgumentParser(description="抖音视频/音频/字幕解析（本地 Playwright 或自建 API）")
    ap.add_argument("--headed", action="store_true", help="显示浏览器窗口（调试用）")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check")
    p.set_defaults(func=cmd_check)
    p = sub.add_parser("parse")
    p.add_argument("--url", required=True)
    p.set_defaults(func=cmd_parse)
    p = sub.add_parser("download")
    p.add_argument("--url", required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_download)
    p = sub.add_parser("all")
    p.add_argument("--url", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--model", default="base")
    p.add_argument("--subtitle-engine", choices=["auto", "local", "dashscope"], default="auto")
    p.add_argument("--no-subtitle", action="store_true")
    p.set_defaults(func=cmd_all)
    return ap


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    a = build_parser().parse_args()
    return a.func(a)


if __name__ == "__main__":
    raise SystemExit(main())
