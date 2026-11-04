#!/usr/bin/env python3
"""feishu_docs.py — 飞书云文档接入（应用身份 tenant_access_token）.

凭证来源（优先级从高到低，与 skill-feishu-bitable 完全一致）：
  --app-id/--app-secret > 环境变量 FEISHU_APP_ID/FEISHU_APP_SECRET
  > data/users/*/outputs/_push.json 里的 feishu_app_id/feishu_app_secret

子命令：
  check        校验凭证 + tenant_access_token（顺带打印应用身份）
  create       Markdown → 新飞书文档（标题 + 正文块），返回文档链接
  append       把 Markdown 追加到已有文档末尾
  read         读文档：标题 + 全部文本块（按层级还原成近似 Markdown）
  permission   把文档设为组织内可读（可选）

Markdown 支持范围: #~###### 标题 / 列表 / 引用 / 代码块 / 普通段落；图片暂不支持
（飞书文档图块需先走 drive 上传，按需再扩）。
输出统一 JSON 行或 >>> 前缀的人类可读行，退出码 0 成功 / 2 参数错 / 3 权限错。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
BASE_FEISHU = "https://open.feishu.cn/open-apis"
BASE_LARK = "https://open.larksuite.com/open-apis"
_URL_ID = re.compile(r"(?:https?://[^/\s]*feishu\.cn|larksuite\.com)?/[a-z]*/([\w]{20,})")


class FeishuError(Exception):
    pass


def out(obj: Any) -> None:
    print(json.dumps(obj, ensure_ascii=False))


def find_push_file(explicit: str | None) -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    if os.environ.get("FEISHU_APP_ID", "").strip():
        return None  # 走环境变量
    for p in sorted((ROOT / "data" / "users").glob("*/outputs/_push.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if str(d.get("feishu_app_id") or "").strip() and \
                str(d.get("feishu_app_secret") or "").strip():
            return p
    return None


def load_credentials(args) -> dict:
    src = find_push_file(getattr(args, "push_file", None))
    cfg: dict = {}
    if src:
        cfg = json.loads(src.read_text(encoding="utf-8"))
    app_id = (args.app_id or os.environ.get("FEISHU_APP_ID")
              or cfg.get("feishu_app_id") or "").strip()
    secret = (args.app_secret or os.environ.get("FEISHU_APP_SECRET")
              or cfg.get("feishu_app_secret") or "").strip()
    domain = args.domain if args.domain != "auto" else (
        "larksuite" if str(cfg.get("domain")) == "larksuite" or "larksuite" in
        str(cfg.get("feishu_base") or "") else "feishu")
    if not app_id or not secret:
        sys.exit("缺 App ID / App Secret：去飞书开放平台「企业自建应用」拿，"
                 "然后 --app-id/--app-secret、环境变量，或在 Web 端账号配置里保存一次")
    return {"app_id": app_id, "app_secret": secret, "domain": domain}


class Client:
    def __init__(self, cfg: dict):
        self.base = BASE_LARK if cfg["domain"] == "larksuite" else BASE_FEISHU
        self.app_id, self.secret = cfg["app_id"], cfg["app_secret"]
        self.token = ""

    def _req(self, method: str, path: str, body=None, auth=True, timeout=40,
             query: dict | None = None):
        url = self.base + path
        if query:
            url += "?" + urllib.parse.urlencode(query)
        req = urllib.request.Request(url, method=method,
                                     headers={"Content-Type": "application/json"})
        if auth:
            if not self.token:
                self.auth()
            req.add_header("Authorization", "Bearer " + self.token)
        req.data = json.dumps(body).encode() if body is not None else b"{}"
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:1500]
            raise FeishuError(f"HTTP {e.code} {path}: {detail}") from None

    # ---------------------------------------------------------------- auth #
    def auth(self) -> None:
        data = self._req("POST", "/auth/v3/tenant_access_token/internal",
                         {"app_id": self.app_id, "app_secret": self.secret},
                         auth=False)
        if data.get("code") != 0:
            raise FeishuError(f"拿 tenant_access_token 失败：{data.get('code')} "
                              f"{data.get('msg')}（检查 App ID/Secret、应用是否发布可用范围）")
        self.token = data["tenant_access_token"]

    # ---------------------------------------------------------------- docs #
    def doc_create(self, title: str, folder_token: str = "") -> dict:
        body = {"title": title}
        if folder_token:
            body["folder_token"] = folder_token
        return self._req("POST", "/docx/v1/documents", body)

    def blocks_children(self, doc_id: str, block_id: str, children: list[dict],
                        index: int | None = None):
        body: dict = {"children": children}
        if index is not None:
            body["index"] = index
        q = {"document_revision_id": -1}
        return self._req("POST",
                         f"/docx/v1/documents/{doc_id}/blocks/{block_id}/children",
                         body, query=q)

    def blocks_list(self, doc_id: str) -> list[dict]:
        items, token = [], ""
        while True:
            url = self.base + f"/docx/v1/documents/{doc_id}/blocks?page_size=500"
            if token:
                url += f"&page_token={token}"
            req = urllib.request.Request(url,
                                         headers={"Authorization": "Bearer " + self.token})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            if data.get("code") != 0:
                raise FeishuError(f"{data.get('code')} {data.get('msg')}")
            d = data.get("data") or {}
            items += d.get("items") or []
            token = (d.get("page_token") or "")
            if not (d.get("has_more") and token):
                break
        return items

    def doc_meta(self, doc_id: str) -> dict:
        return self._req("GET", f"/docx/v1/documents/{doc_id}")

    def delete(self, doc_id: str) -> dict:
        # 移入回收站：DELETE /drive/v1/files/{token}?type=docx
        self._req("DELETE", f"/drive/v1/files/{doc_id}?type=docx", None)
        return {"ok": True}

    def set_readable(self, doc_id: str, obj_type: str = "docx") -> dict:
        self._req("PATCH", f"/drive/v1/permissions/{doc_id}/public?type={obj_type}",
                  {"external_access_entity": "tenant_readable"})  # 组织内可读
        return {"ok": True}


# ------------------------------------------------------------------------ md #
_MD_HEADING = re.compile(r"^(#{1,9})\s+(.*)$")
_MD_UL = re.compile(r"^[-*]\s+(.*)$")
_MD_OL = re.compile(r"^(\d+)[.、]\s+(.*)$")


def _text_block(text: str) -> dict:
    return {"block_type": 2, "text": {"elements": [{"text_run": {"text": text}}],
                                      "style": {}}}


def md_to_blocks(md: str) -> list[dict]:
    """Markdown 结构 → 飞书块首轮白名单（段落/标题/列表/引用/代码）。"""
    blocks, code_open, code_buf = [], False, []
    inline = lambda s: re.sub(r"\*\*(.+?)\*\*", r"\1", s)  # noqa: E731  粗体标记去掉
    for line in (md or "").replace("\r\n", "\n").split("\n"):
        if line.strip().startswith("```"):
            if code_open:
                blocks.append({"block_type": 14, "code": {"elements": [
                    {"text_run": {"text": "".join(code_buf)}}], "style": {}}})
                code_open, code_buf = False, []
            else:
                code_open = True
            continue
        if code_open:
            code_buf.append(line + "\n")
            continue
        s = line.rstrip()
        if not s.strip():
            continue
        m = _MD_HEADING.match(s.strip())
        if m:
            blocks.append({"block_type": m.group(1).count("#") + 2,  # h1→3, h2→4 …
                           "text": {"elements": [{"text_run": {"text": inline(m.group(2))}}],
                                    "style": {}}})
            continue
        m = _MD_UL.match(s.strip())
        if m:
            blocks.append({"block_type": 12, "bullet": {"elements": [
                {"text_run": {"text": inline(m.group(1))}}], "style": {}}})
            continue
        m = _MD_OL.match(s.strip())
        if m:
            blocks.append({"block_type": 13, "ordered": {"elements": [
                {"text_run": {"text": inline(m.group(2))}}], "style": {}}})
            continue
        if s.strip().startswith(">"):
            blocks.append({"block_type": 15, "quote": {"elements": [
                {"text_run": {"text": inline(s.strip().lstrip("> "))}}], "style": {}}})
            continue
        blocks.append(_text_block(inline(s)))
    if code_open and code_buf:  # 未闭合的代码块兜底
        blocks.append({"block_type": 14, "code": {"elements": [
            {"text_run": {"text": "".join(code_buf)}}], "style": {}}})
    return blocks or [_text_block("")]


def blocks_to_md(blocks: list[dict]) -> str:
    type_key = {1: "page", 2: "text", 12: "bullet", 13: "ordered", 14: "code", 15: "quote"}

    def node_of(b: dict) -> dict:
        bt = b.get("block_type")
        key = type_key.get(bt, f"heading{bt - 2}" if 3 <= bt <= 11 else "text")
        return b.get(key) or {}

    def texts(b: dict) -> str:
        el = node_of(b).get("elements") or []
        return "".join(e.get("text_run", {}).get("text", "") for e in el)

    if len(blocks) and blocks[0].get("block_type") == 1:
        blocks = blocks[1:]
    lines = []
    for b in blocks:
        t, bt = texts(b), b.get("block_type")
        if 3 <= bt <= 11:
            lines.append("#" * (bt - 2) + " " + t)
        elif bt == 12:
            lines.append("- " + t)
        elif bt == 13:
            lines.append("1. " + t)
        elif bt == 14:
            lines.append("```\n" + t + "\n```")
        elif bt == 15:
            lines.append("> " + t)
        elif t:
            lines.append(t)
    return "\n\n".join(x for x in lines if x)


def _doc_id(arg: str) -> str:
    m = _URL_ID.search(arg or "")
    return m.group(1) if m else (arg or "").strip()


def _chunks(children: list[dict], n: int = 45):
    for i in range(0, len(children), n):
        yield children[i:i + n]


def _readfile(p: str) -> str:
    path = Path(p) if os.path.isabs(p) else ROOT / p
    if not path.is_file():
        sys.exit(f"文件不存在：{p}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--push-file", help="指定 _push.json（默认自动搜索 data/users/*/）")
    ap.add_argument("--app-id"), ap.add_argument("--app-secret")
    ap.add_argument("--domain", choices=("auto", "feishu", "larksuite"), default="auto")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="校验凭证与 token")

    c = sub.add_parser("create", help="Markdown → 新飞书文档")
    c.add_argument("--title", required=True)
    c.add_argument("--file", help="Markdown 文件路径（outputs/ 相对或绝对）")
    c.add_argument("--text", help="直接给 Markdown 文本（小段内容）")
    c.add_argument("--folder-token", default="")
    c.add_argument("--open-read", action="store_true", help="顺手设为组织内可读")

    a = sub.add_parser("append", help="把 Markdown 追加到已有文档")
    a.add_argument("--doc", required=True, help="docx token 或文档链接")
    g = a.add_mutually_exclusive_group()
    g.add_argument("--file"), g.add_argument("--text")

    r = sub.add_parser("read", help="读文档文本")
    r.add_argument("--doc", required=True)

    pm = sub.add_parser("permission", help="组织内可读")
    pm.add_argument("--doc", required=True)

    dl = sub.add_parser("delete", help="移入回收站（删除测试产物用）")
    dl.add_argument("--doc", required=True)

    args = ap.parse_args()
    try:
        cl = Client(load_credentials(args))
        if args.cmd == "check":
            cl.auth()
            out({"ok": True, "tenant_token_len": len(cl.token), "base": cl.base})
            return 0
        if args.cmd == "create":
            md = args.text or (_readfile(args.file) if args.file else "")
            if not md.strip():
                sys.exit("正文为空：给 --file 或 --text")
            r0 = cl.doc_create(args.title, args.folder_token)
            doc_id = (r0.get("data") or {}).get("document", {}).get("document_id", "")
            if not doc_id:
                raise FeishuError("创建文档未返回 document_id")
            n = 0
            for chunk in _chunks(md_to_blocks(md)):
                cl.blocks_children(doc_id, doc_id, chunk, index=None)
                n += len(chunk)
                time.sleep(0.15)
            if args.open_read:
                cl.set_readable(doc_id)
            url = f"https://feishu.cn/docx/{doc_id}"
            out({"ok": True, "doc_id": doc_id, "blocks": n, "url": url})
            print(f">>> 已创建飞书文档：{url}")
            return 0
        if args.cmd == "append":
            doc_id = _doc_id(args.doc)
            md = args.text or (_readfile(args.file) if args.file else "")
            n = 0
            for chunk in _chunks(md_to_blocks(md)):
                cl.blocks_children(doc_id, doc_id, chunk, index=None)
                n += len(chunk)
                time.sleep(0.15)
            out({"ok": True, "appended_blocks": n, "doc_id": doc_id})
            return 0
        if args.cmd == "read":
            doc_id = _doc_id(args.doc)
            meta = cl.doc_meta(doc_id)
            title = (meta.get("data") or {}).get("document", {}).get("title", "")
            print(f"=== {title} ===")
            print(blocks_to_md(cl.blocks_list(doc_id)))
            return 0
        if args.cmd == "permission":
            doc_id = _doc_id(args.doc)
            cl.set_readable(doc_id)
            out({"ok": True, "doc_id": doc_id, "message": "已设为组织内可读"})
            return 0
        if args.cmd == "delete":
            doc_id = _doc_id(args.doc)
            cl.delete(doc_id)
            out({"ok": True, "doc_id": doc_id, "message": "已移入回收站"})
            return 0
    except FeishuError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
