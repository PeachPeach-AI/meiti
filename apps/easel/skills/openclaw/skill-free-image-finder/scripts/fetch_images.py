#!/usr/bin/env python3
"""fetch_images.py — 公网无水印图片检索与下载.

来源是对外开放 API 的正规图库，**不走搜索引擎**（搜索结果里混水印图）：
  - openverse（默认，无需 Key，CC 授权图片，支持商用过滤）
  - pexels / unsplash / pixabay（各自平台申请免费 Key，配环境变量启用）

子命令：
  search   列出候选图（JSON 行），不下载
  download 批量下载前 N 张到 outputs/images，并生成 attribution.txt 授权清单

环境变量（可选，申请了哪个平台的 Key 就配哪个）：
  PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY

退出码 0 成功；2 参数/Key 错误；3 全部来源不可达。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

try:  # Windows 控制台 GBK 防崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
IMG_MAGIC = (b"\xff\xd8\xff", b"\x89PNG", b"GIF8", b"RIFF")  # jpg/png/gif/webp(RIFF)
SOURCES = ("openverse", "pexels", "unsplash", "pixabay")


def _http_json(url: str, headers: dict | None = None, timeout: int = 25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json",
                                               **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _key(platform: str) -> str:
    """Key 取值优先级：环境变量 > skills/<本skill>/config/keys.json。"""
    v = os.environ.get({"pexels": "PEXELS_API_KEY", "unsplash": "UNSPLASH_ACCESS_KEY",
                        "pixabay": "PIXABAY_API_KEY"}[platform], "").strip()
    if v:
        return v
    try:
        cfg = json.loads((Path(__file__).resolve().parent.parent / "config"
                          / "keys.json").read_text(encoding="utf-8"))
        return str((cfg.get(platform) or "")).strip()
    except Exception:
        return ""


def _norm(item: dict) -> dict:
    keys = ("source", "title", "url", "width", "height", "creator", "license", "page_url")
    out = {}
    for k in keys:
        out[k] = item.get(k)
    out["license"] = out["license"] or ""
    return out


# --------------------------------------------------------------------------- #
# 来源实现：返回查询后的候选列表（已统一字段）
# --------------------------------------------------------------------------- #
def q_openverse(q: str, limit: int, **kw) -> list[dict]:
    """Openverse：无需 Key。license_type=commercial → CC0/BY/BY-SA 等可商用许可。"""
    url = ("https://api.openverse.org/v1/images/?q=" + urllib.parse.quote(q) +
           f"&page_size={min(limit, 20)}&license_type=commercial&filter_dead=false")
    data = _http_json(url)
    out = []
    for r in data.get("results", [])[:limit]:
        out.append(_norm({
            "source": "openverse",
            "title": r.get("title") or q,
            "url": r.get("url"),
            "width": r.get("width"), "height": r.get("height"),
            "creator": r.get("creator") or r.get("creator_url") or "unknown",
            "license": (f"{(r.get('license') or '').upper()} "
                        f"{r.get('license_version') or ''}").strip(),
            "page_url": r.get("foreign_landing_url"),
        }))
    return out


def q_pexels(q: str, limit: int, **kw) -> list[dict]:
    key = _key("pexels")
    if not key:
        sys.exit("pexels 需要 Key：环境变量 PEXELS_API_KEY（https://www.pexels.com/api/ 免费申请）")
    url = (f"https://api.pexels.com/v1/search?query={urllib.parse.quote(q)}"
           f"&per_page={min(limit, 80)}")
    data = _http_json(url, headers={"Authorization": key})
    out = []
    for r in data.get("photos", [])[:limit]:
        src = r.get("src") or {}
        out.append(_norm({
            "source": "pexels",
            "title": (r.get("alt") or q)[:80],
            "url": src.get("original") or src.get("large2x") or src.get("large"),
            "width": r.get("width"), "height": r.get("height"),
            "creator": r.get("photographer") or "unknown",
            "license": "Pexels License（可商用，无需署名）",
            "page_url": r.get("url"),
        }))
    return out


def q_unsplash(q: str, limit: int, **kw) -> list[dict]:
    key = _key("unsplash")
    if not key:
        sys.exit("unsplash 需要 Key：环境变量 UNSPLASH_ACCESS_KEY（https://unsplash.com/developers）")
    url = (f"https://api.unsplash.com/search/photos?query={urllib.parse.quote(q)}"
           f"&per_page={min(limit, 30)}")
    data = _http_json(url, headers={"Authorization": f"Client-ID {key}"})
    out = []
    for r in data.get("results", [])[:limit]:
        out.append(_norm({
            "source": "unsplash",
            "title": ((r.get("alt_description") or "") or q)[:80],
            "url": (r.get("urls") or {}).get("regular"),
            "width": r.get("width"), "height": r.get("height"),
            "creator": (r.get("user") or {}).get("name") or "unknown",
            "license": "Unsplash License（可商用，无需署名）",
            "page_url": (r.get("links") or {}).get("html"),
        }))
    return out


def q_pixabay(q: str, limit: int, **kw) -> list[dict]:
    key = _key("pixabay")
    if not key:
        sys.exit("pixabay 需要 Key：环境变量 PIXABAY_API_KEY（https://pixabay.com/api/docs/）")
    url = (f"https://pixabay.com/api/?key={urllib.parse.quote(key)}"
           f"&q={urllib.parse.quote(q)}&image_type=photo&per_page={min(limit, 80)}&safesearch=true")
    data = _http_json(url)
    out = []
    for r in data.get("hits", [])[:limit]:
        out.append(_norm({
            "source": "pixabay",
            "title": r.get("tags") or q,
            "url": r.get("largeImageURL") or r.get("webformatURL"),
            "width": r.get("imageWidth"), "height": r.get("imageHeight"),
            "creator": r.get("user") or "unknown",
            "license": "Pixabay Content License（可商用，无需署名）",
            "page_url": f"https://pixabay.com/photos/?id={r.get('id')}" if r.get("id") else "",
        }))
    return out


QUERY = {"openverse": q_openverse, "pexels": q_pexels, "unsplash": q_unsplash, "pixabay": q_pixabay}


def _search(q: str, source: str, limit: int) -> list[dict]:
    order = [source] if source != "auto" else ["pexels", "pixabay", "unsplash", "openverse"]
    errs = []
    for s in order:
        try:
            results = QUERY[s](q, limit)
        except SystemExit as e:  # 某 Key 没配 → 提示后自动换下一个来源
            errs.append(f"{s}: {e}")
            continue
        except Exception as e:  # 网络/限流 → 换下一个
            errs.append(f"{s}: {type(e).__name__}: {str(e)[:120]}")
            continue
        if results:
            return results
        errs.append(f"{s}: 无结果")
    sys.exit("所有来源都失败：\n  " + "\n  ".join(errs))


def _download(url: str, out: Path, min_width: int, title: str) -> tuple[bool, int, int]:
    """下载单图。返回 (ok, 宽, 高)。水印防御层：只用图库直链 + 最小分辨率校验。"""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        head = r.read(4)
        if not head.startswith(IMG_MAGIC):
            return False, 0, 0
        blob = head + r.read(30 * 1024 * 1024)  # 单图上限 30MB
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(blob)
    w = h = 0
    try:
        from PIL import Image
        with Image.open(out) as im:
            w, h = im.size
        if w < min_width:
            out.unlink(missing_ok=True)
            return False, w, h
    except ImportError:
        pass  # 无 PIL 跳过尺寸校验
    return True, w, h


def _slugify(text: str, fallback: str = "img") -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", (text or "").strip())[:24].strip("-")
    return s.replace("--", "-") if s else fallback


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    for name, help_ in (("search", "列出候选图"), ("download", "下载前 N 张 + 授权清单")):
        p = sub.add_parser(name, help=help_)
        p.add_argument("-q", "--query", required=True, help="关键词（中文/英文均可）")
        p.add_argument("--source", choices=("auto", *SOURCES), default="auto",
                       help="auto = 有 Key 的平台优先，兜底 openverse")
        p.add_argument("--min-width", type=int, default=1280, help="最小宽（过滤低清/水印小图）")
    sp = sub.choices["search"]
    sp.add_argument("--limit", type=int, default=12)
    dp = sub.choices["download"]
    dp.add_argument("--out", help="输出目录（默认 outputs/images）")
    dp.add_argument("--count", type=int, default=3, help="下载张数")

    a = ap.parse_args()
    if not (a.query or "").strip():
        sys.exit("关键词不能为空")

    if a.cmd == "search":
        print(f"# source={a.source} query={a.query!r}")
        for i, it in enumerate(_search(a.query, a.source, a.limit), 1):
            print(json.dumps({"no": i, **it}, ensure_ascii=False))
        return 0

    out_dir = Path(a.out) if a.out else ROOT / "outputs" / "images"
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    results = _search(a.query, a.source, a.limit * 2 + 5)  # 多查一些，容得下坏图
    saved, manifest = [], []
    for it in results:
        if len(saved) >= max(1, a.count):
            break
        if not it.get("url"):
            continue
        ext = Path(urllib.parse.urlparse(it["url"]).path).suffix.lower() or ".jpg"
        ext = {".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp",
               ".gif": ".gif"}.get(ext, ".jpg")
        fname = f"{_slugify(a.query)}-{len(saved) + 1:02d}{ext}"
        try:
            ok, w, h = _download(it["url"], out_dir / fname, a.min_width, it["title"])
        except Exception as e:  # noqa: BLE001
            ok = False
            w = h = 0
            print(f"# 跳过（下载失败 {str(e)[:60]}）: {it['page_url'] or it['url']}")
        if not ok:
            if w and a.min_width > 1:
                print(f"# 跳过（宽 {w} < {a.min_width}）: {it['page_url'] or it['url']}")
            continue
        line = (f"{fname} | {w}x{h} | {it['source']} | {it['license']} | "
                f"作者: {it['creator']} | {it['page_url']}")
        saved.append(str((out_dir / fname).relative_to(ROOT)) if str(out_dir).startswith(
            str(ROOT)) else str(out_dir / fname))
        manifest.append(line)
        print("[下载] " + line)

    if saved:
        att = out_dir / "attribution.txt"
        with att.open("a", encoding="utf-8") as f:
            f.write(f"\n# 查询: {a.query}  时间: {__import__('time').strftime('%Y-%m-%d %H:%M')}\n")
            f.write("\n".join(manifest) + "\n")
        print(f"# {len(saved)} 张已存 {out_dir}；授权清单 {att}")
        print("img_path: " + "\nimg_path: ".join(saved))
        return 0
    print("# 没有可下载结果：放宽 --min-width、换关键词或换 --source 再试")
    return 3


if __name__ == "__main__":
    sys.exit(main())
