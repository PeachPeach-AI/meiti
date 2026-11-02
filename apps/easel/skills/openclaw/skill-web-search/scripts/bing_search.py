#!/usr/bin/env python3
"""联网搜索兜底：Bing HTML 搜索（备援百度），无需任何 API key。

用法（在 Easel 项目根执行）：
    python skills/openclaw/skill-web-search/scripts/bing_search.py "关键词" --limit 8
    python skills/openclaw/skill-web-search/scripts/bing_search.py "关键词" --json

只依赖 Python 标准库。输出给 Agent 读取，结果链接交给 web_fetch 抓正文。
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
BING = "https://www.bing.com/search?q={q}&count=30&setlang=zh-Hans&mkt=zh-CN"
BAIDU = "https://www.baidu.com/s?wd={q}&rn=10&ie=utf-8"


def fetch(url: str, timeout: int) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
    try:
        return raw.decode(charset, "replace")
    except LookupError:
        return raw.decode("utf-8", "replace")


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_bing(page: str, limit: int) -> list[dict]:
    results: list[dict] = []
    for block in re.findall(
        r'<li[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>(.*?)</li>', page, re.S | re.I
    ):
        m = re.search(
            r'<h2[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.S | re.I
        )
        if not m:
            continue
        url = html.unescape(m.group(1))
        title = clean(m.group(2))
        if not title or not url.startswith("http"):
            continue
        sm = re.search(r"<p[^>]*>(.*?)</p>", block, re.S | re.I)
        results.append(
            {"title": title, "url": url, "snippet": clean(sm.group(1)) if sm else ""}
        )
        if len(results) >= limit:
            break
    return results


def parse_baidu(page: str, limit: int) -> list[dict]:
    titles = re.findall(
        r'<h3[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S | re.I
    )
    snippets = re.findall(
        r'class="[^"]*(?:content-right|c-abstract|content)[^"]*"[^>]*>(.*?)</(?:span|div)>',
        page,
        re.S | re.I,
    )
    results: list[dict] = []
    for i, (url, title) in enumerate(titles):
        title = clean(title)
        if not title or not url.startswith("http"):
            continue
        results.append(
            {
                "title": title,
                "url": html.unescape(url),
                "snippet": clean(snippets[i]) if i < len(snippets) else "",
            }
        )
        if len(results) >= limit:
            break
    return results


def search(query: str, limit: int, engine: str, timeout: int) -> tuple[str, list[dict]]:
    q = urllib.parse.quote_plus(query)
    errors: list[str] = []
    engines = ["bing", "baidu"] if engine == "auto" else [engine]
    for name in engines:
        try:
            page = fetch((BING if name == "bing" else BAIDU).format(q=q), timeout)
            rows = (parse_bing if name == "bing" else parse_baidu)(page, limit)
            if rows:
                return name, rows
            errors.append(f"{name}: 0 results")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{name}: {exc}")
    raise RuntimeError("; ".join(errors) or "no engine")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Bing/Baidu HTML search (no API key)")
    ap.add_argument("query", nargs="+", help="search keywords")
    ap.add_argument("--limit", type=int, default=8)
    ap.add_argument("--engine", choices=["auto", "bing", "baidu"], default="auto")
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    query = " ".join(args.query).strip()
    try:
        engine, rows = search(query, max(1, args.limit), args.engine, args.timeout)
    except Exception as exc:  # noqa: BLE001
        print(f"搜索失败：{exc}", file=sys.stderr)
        print("可改用 web_fetch 直接打开已知网址，或换关键词重试。", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"query": query, "engine": engine, "results": rows},
                         ensure_ascii=False, indent=2))
    else:
        print(f"# 搜索：{query}（{engine}，{len(rows)} 条）")
        for i, r in enumerate(rows, 1):
            print(f"\n{i}. {r['title']}\n   {r['url']}")
            if r.get("snippet"):
                print(f"   {r['snippet']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
