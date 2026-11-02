#!/usr/bin/env python3
"""采集微信公众号文章（公开页面）。

用法：
    python wechat_article.py --url <文章链接>
输出一行 JSON：
    { ok, title, author, publishedAt, body, metrics:{reads,likes,woa}, comments:[...], note }

优先复用 9222 端口的 CDP 浏览器（与截流/智能体共用 Chrome）；
若未启动则拉起 Chrome（独立 WechatProfile），用真实浏览器渲染后再取 DOM。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

CDP = "http://127.0.0.1:9222"
PROFILE = Path.home() / ".easel-browser-profiles" / "WechatProfile"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")


def chrome_candidates() -> list[str]:
    env = os.environ
    return [
        (env.get("PROGRAMFILES") or "") + r"\Google\Chrome\Application\chrome.exe",
        (env.get("PROGRAMFILES(X86)") or "") + r"\Google\Chrome\Application\chrome.exe",
        (env.get("LOCALAPPDATA") or "") + r"\Google\Chrome\Application\chrome.exe",
        (env.get("PROGRAMFILES") or "") + r"\Microsoft\Edge\Application\msedge.exe",
        (env.get("PROGRAMFILES(X86)") or "") + r"\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]


def cdp_alive() -> bool:
    try:
        with urllib.request.urlopen(CDP + "/json/version", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def ensure_cdp(url: str) -> bool:
    if cdp_alive():
        return True
    exe = next((p for p in chrome_candidates() if p and Path(p).is_file()), None)
    if not exe:
        return False
    PROFILE.mkdir(parents=True, exist_ok=True)
    subprocess.Popen(
        [exe, "--remote-debugging-port=9222", "--remote-debugging-address=127.0.0.1",
         f"--user-data-dir={PROFILE}", "--no-first-run", "--no-default-browser-check", url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(20):
        time.sleep(0.7)
        if cdp_alive():
            return True
    return False


def parse_count(text: str) -> int | None:
    if not text:
        return None
    t = str(text).replace(",", "").strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(万|w|W)?", t)
    if not m:
        return None
    n = float(m.group(1))
    if m.group(2):
        n *= 10000
    return int(round(n))


EXTRACT_JS = r"""
() => {
  const one = (s) => document.querySelector(s);
  const txt = (s) => ((one(s) && one(s).innerText) || '').trim();
  const meta = (sel) => Array.from(document.querySelectorAll(sel)).map(e => (e.innerText || '').trim()).filter(Boolean);
  const items = Array.from(document.querySelectorAll(
    '#js_cmt_list .comment_item, #js_cmt_list .discuss_item, .comment_item, .discuss_item, [class*="comment_item"], [class*="discuss_item"]'
  ));
  const comments = items.map((el) => {
    const pick = (sel) => { const n = el.querySelector(sel); return n ? (n.innerText || '').trim() : ''; };
    return {
      author: pick('[class*="nickname"]') || pick('[class*="nick_name"]') || pick('.name'),
      text: pick('[class*="content"]') || pick('[class*="comment_text"]') || pick('.text'),
      likes: pick('[class*="like"]'),
      at: pick('[class*="time"]')
    };
  }).filter(c => c.text);
  return {
    title: txt('#activity-name') || txt('.rich_media_title') || document.title,
    author: txt('#js_name') || txt('.rich_media_meta_nickname') || txt('.rich_media_meta_link'),
    publishedAt: txt('#publish_time') || '',
    body: txt('#js_content') || txt('.rich_media_content'),
    readText: txt('#js_read_area') || txt('.read_num') || '',
    likeText: txt('#js_like_num') || txt('.like_num') || '',
    woaText: txt('#js_like_num') || '',
    commentText: txt('#js_cmt_list') || '',
    comments,
  };
}
"""


def collect_http(url: str) -> dict:
    """不依赖浏览器：直接抓文章 HTML（公开页）。"""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "zh-CN,zh;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read()
        status = r.status
        final = r.geturl()
    text = raw.decode("utf-8", errors="ignore")
    out = {
        "title": "", "author": "", "publishedAt": "", "body": "",
        "readText": "", "likeText": "", "woaText": "",
        "comments": [], "status": status, "finalUrl": final, "htmlLen": len(text),
    }
    try:
        from bs4 import BeautifulSoup
    except Exception:
        return out
    soup = BeautifulSoup(text, "html.parser")

    def txt(sel: str) -> str:
        el = soup.select_one(sel)
        return el.get_text(" ", strip=True) if el else ""

    out["title"] = txt("#activity-name") or txt(".rich_media_title")
    out["author"] = txt("#js_name") or txt(".rich_media_meta_nickname")
    out["publishedAt"] = txt("#publish_time")
    content = soup.find(id="js_content")
    out["body"] = content.get_text("\n", strip=True) if content else ""
    out["readText"] = txt("#js_read_area") or txt(".read_num")
    out["likeText"] = txt("#js_like_num") or txt(".like_num")
    try:
        for el in soup.select("#js_cmt_list .comment_item, #js_cmt_list .discuss_item, .comment_item, .discuss_item"):
            nick = el.select_one("[class*='nickname'], .name")
            body_el = el.select_one("[class*='content'], .text")
            like = el.select_one("[class*='like']")
            t = body_el.get_text(" ", strip=True) if body_el else ""
            if not t:
                continue
            out["comments"].append({
                "author": nick.get_text(" ", strip=True) if nick else "匿名",
                "text": t,
                "likes": like.get_text(" ", strip=True) if like else "",
                "at": "",
            })
    except Exception:
        pass
    return out


def collect(url: str, wait_ms: int = 3500) -> dict:
    try:
        http = collect_http(url)
        if http.get("title") and http.get("body") and "参数错误" not in http.get("title", ""):
            return http
    except Exception:
        pass

    from playwright.sync_api import sync_playwright

    if not ensure_cdp(url):
        return {"ok": False, "message": "无法启动浏览器（未找到 Chrome/Edge 或 CDP 未就绪）"}

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.new_page()
        try:
            page.set_default_timeout(30000)
            resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(wait_ms)
            data = page.evaluate(EXTRACT_JS)
            data["finalUrl"] = page.url
            data["status"] = resp.status if resp else None
            data["htmlLen"] = len(page.content())
            return data
        finally:
            try:
                page.close()
            except Exception:
                pass


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--wait-ms", type=int, default=3500)
    a = ap.parse_args()

    url = a.url.strip()
    if not re.match(r"^https?://", url, re.I):
        print(json.dumps({"ok": False, "message": "链接需要以 http(s):// 开头"}, ensure_ascii=False))
        return 2
    try:
        d = collect(url, a.wait_ms)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "message": str(e)}, ensure_ascii=False))
        return 1

    title = re.sub(r"\s+", " ", str(d.get("title") or "")).strip()
    body = str(d.get("body") or "").strip()
    if (not title) or (not body) or ("参数错误" in body) or (title in ("微信公众平台", "微信")):
        print(json.dumps({
            "ok": False,
            "message": "文章打不开（微信返回参数错误/已删除/链接失效）。请在浏览器里确认链接能正常打开后再试。",
            "finalUrl": d.get("finalUrl"),
        }, ensure_ascii=False))
        return 1

    comments = []
    for c in d.get("comments") or []:
        text = re.sub(r"\s+", " ", str(c.get("text") or "")).strip()
        if not text:
            continue
        comments.append({
            "author": re.sub(r"\s+", " ", str(c.get("author") or "匿名")).strip() or "匿名",
            "text": text,
            "likes": parse_count(c.get("likes")) or 0,
            "at": re.sub(r"\s+", " ", str(c.get("at") or "")).strip(),
        })

    out = {
        "ok": True,
        "url": url,
        "title": title,
        "author": re.sub(r"\s+", " ", str(d.get("author") or "")).strip(),
        "publishedAt": re.sub(r"\s+", " ", str(d.get("publishedAt") or "")).strip(),
        "body": body,
        "bodyLen": len(body),
        "metrics": {
            "reads": parse_count(d.get("readText")),
            "likes": parse_count(d.get("likeText")),
            "woa": parse_count(d.get("woaText")),
            "comments": len(comments),
        },
        "comments": comments,
        "note": "公众号留言需微信客户端鉴权加载，桌面浏览器通常拿不到（接口会返回验证页）；本报告仅统计页面公开 DOM 中展示的留言，多数文章为 0。阅读/在看为页面展示值。",
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
