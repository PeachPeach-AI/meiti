#!/usr/bin/env python3
"""把当前文章的微信预览链接推送到企业微信/钉钉群机器人（读取设置里的 _push.json）。"""
import argparse
import base64
import hashlib
import hmac
import json
import sys
import time
import urllib.parse
import urllib.request


def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def markdown(title: str, url: str, note: str) -> str:
    parts = [f"### {title}", f"[打开预览]({url})"]
    if note:
        parts.append(note)
    parts.append("> 预览链接有时效，正式发布后请用公开链接。")
    return "\n\n".join(parts)


def send_wecom(webhook: str, text: str) -> str:
    data = post_json(webhook, {"msgtype": "markdown", "markdown": {"content": text}})
    if data.get("errcode") not in (0, None):
        raise RuntimeError(f"企业微信：{data}")
    return "企业微信已发送"


def send_dingtalk(webhook: str, secret: str, title: str, text: str) -> str:
    url = webhook
    if secret:
        ts = str(int(time.time() * 1000))
        digest = hmac.new(secret.encode("utf-8"), f"{ts}\n{secret}".encode("utf-8"), hashlib.sha256).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(digest))
        url += ("&" if "?" in url else "?") + f"timestamp={ts}&sign={sign}"
    data = post_json(url, {"msgtype": "markdown", "markdown": {"title": title, "text": text}})
    if data.get("errcode") not in (0, None):
        raise RuntimeError(f"钉钉：{data}")
    return "钉钉已发送"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="内容库 outputs/_push.json 路径")
    ap.add_argument("--title", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--note", default="")
    ap.add_argument("--channels", default="wecom,dingtalk")
    a = ap.parse_args()
    cfg = json.loads(open(a.config, encoding="utf-8").read())
    text = markdown(a.title, a.url, a.note)
    results = {}
    for ch in [x.strip() for x in a.channels.split(",") if x.strip()]:
        try:
            if ch == "wecom":
                if not cfg.get("wecom"):
                    raise RuntimeError("未配置企业微信 Webhook")
                results[ch] = {"ok": True, "message": send_wecom(cfg["wecom"], text)}
            elif ch == "dingtalk":
                if not cfg.get("dingtalk"):
                    raise RuntimeError("未配置钉钉 Webhook")
                results[ch] = {"ok": True, "message": send_dingtalk(
                    cfg["dingtalk"], cfg.get("dingtalk_secret", ""), a.title, text)}
        except Exception as e:
            results[ch] = {"ok": False, "message": str(e)[:300]}
    print(json.dumps({"ok": all(x["ok"] for x in results.values()), "results": results}, ensure_ascii=False))
    return 0 if results and all(x["ok"] for x in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
