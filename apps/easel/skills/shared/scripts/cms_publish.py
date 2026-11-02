#!/usr/bin/env python3
"""把文章发布到账号库里已配置的 WordPress / Typecho。

Agent 直接调用本脚本即可，无需向用户索要站点地址或密码：
    python cms_publish.py --platform typecho --accounts <cms_accounts.json> \
        --title "标题" --content-file "草稿.md" [--tags "标签1,标签2"] [--draft]

输出一行 JSON：{"ok": true/false, "message": "...", "url": "..."}。
账号文件也可通过环境变量 EASEL_CMS_ACCOUNTS 指定。
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.request
import xmlrpc.client
from pathlib import Path

DEFAULT_ACCOUNTS = ""


def _load(platform: str, path: str) -> dict:
    p = Path(path or DEFAULT_ACCOUNTS)
    if not p.is_file():
        raise FileNotFoundError(f"账号配置不存在：{p}")
    data = json.loads(p.read_text(encoding="utf-8"))
    return data.get(platform) or {}


def _norm_url(url: str) -> str:
    s = (url or "").strip()
    if not s:
        return ""
    if not s.startswith(("http://", "https://")):
        s = "https://" + s
    return s.rstrip("/")


def _typecho(acc: dict, title: str, body: str, tags: str, publish: bool) -> dict:
    site = _norm_url(acc.get("siteUrl", ""))
    user = acc.get("username", "")
    secret = acc.get("secret", "")
    last: Exception | None = None
    for ep in (site + "/action/xmlrpc", site + "/index.php/action/xmlrpc"):
        try:
            proxy = xmlrpc.client.ServerProxy(ep, allow_none=True)
            pid = proxy.metaWeblog.newPost(
                "1", user, secret,
                {"title": title, "description": body, "mt_keywords": tags or ""},
                bool(publish),
            )
            return {
                "ok": True,
                "message": f"已{'发布' if publish else '存为草稿'}到 Typecho（id {pid}）",
                "id": pid,
                "endpoint": ep,
            }
        except Exception as e:  # noqa: BLE001
            last = e
    return {"ok": False, "message": str(last) if last else "Typecho 发布失败"}


def _wordpress(acc: dict, title: str, body: str, tags: str, publish: bool) -> dict:
    site = _norm_url(acc.get("siteUrl", ""))
    user = acc.get("username", "")
    secret = acc.get("secret", "")
    payload: dict = {
        "title": title,
        "content": body,
        "status": "publish" if publish else "draft",
    }
    if tags:
        payload["tags_input"] = [
            t.strip().lstrip("#")
            for t in tags.replace("#", ",").replace("，", ",").split(",")
            if t.strip()
        ]
    req = urllib.request.Request(
        site + "/wp-json/wp/v2/posts",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Basic " + base64.b64encode(f"{user}:{secret}".encode()).decode(),
        },
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read().decode("utf-8"))
    return {
        "ok": True,
        "message": f"已{'发布' if publish else '存为草稿'}到 WordPress",
        "url": d.get("link", ""),
        "id": d.get("id"),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="发布到已配置的 WordPress / Typecho")
    ap.add_argument("--platform", required=True, choices=["wordpress", "typecho"])
    ap.add_argument("--title", required=True)
    ap.add_argument("--content-file", required=True)
    ap.add_argument("--tags", default="")
    ap.add_argument("--accounts", default=os.environ.get("EASEL_CMS_ACCOUNTS", ""))
    ap.add_argument("--draft", action="store_true", help="存为草稿（默认直接发布）")
    ap.add_argument("--dry-run", action="store_true", help="只校验账号与文件，不实际发布")
    a = ap.parse_args()

    path = a.accounts or DEFAULT_ACCOUNTS
    if not path:
        print(json.dumps({"ok": False, "message": "未指定账号文件（--accounts 或 EASEL_CMS_ACCOUNTS）"}, ensure_ascii=False))
        return 2
    try:
        acc = _load(a.platform, path)
        body = Path(a.content_file).read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "message": str(e)}, ensure_ascii=False))
        return 2
    if not acc:
        print(json.dumps({"ok": False, "message": f"{a.platform} 账号未配置"}, ensure_ascii=False))
        return 2
    if a.dry_run:
        print(json.dumps({
            "ok": True,
            "message": f"账号已读取（{_norm_url(acc.get('siteUrl', ''))} / {acc.get('username', '')}），未实际发布",
            "platform": a.platform,
            "bytes": len(body.encode("utf-8")),
        }, ensure_ascii=False))
        return 0

    if a.platform == "typecho":
        r = _typecho(acc, a.title, body, a.tags, not a.draft)
    else:
        r = _wordpress(acc, a.title, body, a.tags, not a.draft)
    print(json.dumps(r, ensure_ascii=False))
    return 0 if r.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
