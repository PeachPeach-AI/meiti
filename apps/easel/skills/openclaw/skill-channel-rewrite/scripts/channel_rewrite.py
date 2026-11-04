#!/usr/bin/env python3
"""channel_rewrite.py — 母渠道 → 子渠道 内容改写登记与约束校验.

定位：**改写本身由 LLM 完成**（你/Agent 对照渠道约束重写），本脚本负责确定性部分：
  platforms   渠道注册表：母渠道/子渠道、字数与风格约束
  plan        按母稿生成各子渠道改写任务清单（LLM 核对清单用）
  check       校验改写稿：标题/正文字数是否超限、是否带了别的平台话题等
  save        把改写稿归档到 outputs/rewrite/<母稿>/，并生成索引 manifest

母渠道 = 内容母版的正式渠道（官网/公众号），母稿从这里「降维分发」到子渠道。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
REWRITE_DIR = ROOT / "outputs" / "rewrite"

PARENT = {
    "site": {"name": "官网（母渠道）", "title": 70, "body": 50000,
             "note": "长文母版：官网·资源，标签指定资料类型"},
    "wechat-oa": {"name": "公众号（母渠道）", "title": 64, "body": 50000,
                  "note": "正式叙述母版；发到公众号草稿箱"},
}
CHILD = {
    "xiaohongshu": {"name": "小红书", "title": 20, "body": 1000, "tags": "#话题，≤6 个",
                    "style": "口语+emoji+钩子首句；重情绪轻论证"},
    "douyin": {"name": "抖音", "title": 55, "body": 55, "tags": "#话题",
               "style": "正文≤55 字，前 5 秒钩子，短平快"},
    "bilibili": {"name": "B站", "title": 80, "body": 8000, "tags": "标签，≤10 个",
                 "style": "梗+分段小标题，口癖可保留"},
    "kuaishou": {"name": "快手", "title": 30, "body": 1000, "tags": "#话题 3-6 个",
                 "style": "朴实直接，北方向的口语"},
    "weixin-channels": {"name": "视频号", "title": 30, "body": 1000, "tags": "#话题",
                        "style": "中老年友好，少网络梗"},
    "zhihu": {"name": "知乎", "title": 70, "body": 5000, "tags": "不堆话题标签",
              "style": "专业长文：论点-论据-结论，先给答案"},
    "toutiao": {"name": "今日头条", "title": 30, "body": 5000, "tags": "≤3 个",
                "style": "标题带信息量（数字/悬念），正文口语"},
    "baijiahao": {"name": "百家号", "title": 30, "body": 5000, "tags": "≤3 个",
                  "style": "平实叙述，避免争议表述"},
    "sohu": {"name": "搜狐号", "title": 30, "body": 5000, "tags": "≤3 个",
             "style": "资讯口吻"},
    "weibo": {"name": "微博", "title": 0, "body": 2000, "tags": "#话题#",
              "style": "只改正文：短段+#话题#，首句抓眼"},
}
ALL = {**PARENT, **CHILD}


def _limits(pid: str) -> dict:
    cfg = ALL.get(pid) or {}
    if not cfg:
        sys.exit(f"未知渠道：{pid}（platforms 看注册表）")
    return cfg


def _read_md(p: str) -> str:
    path = Path(p) if os.path.isabs(p) else ROOT / p
    if not path.is_file():
        sys.exit(f"文件不存在：{p}")
    return path.read_text(encoding="utf-8")


def _split_title_body(md: str) -> tuple[str, str]:
    """首行 # 或首段视作标题，其余为正文。"""
    lines = md.replace("\r\n", "\n").strip().split("\n")
    if lines and lines[0].lstrip().startswith("#"):
        title = lines[0].lstrip().lstrip("#").strip()
        body = "\n".join(lines[1:]).strip()
    else:
        title, body = lines[0].strip()[:80], "\n".join(lines[1:]).strip() or lines[0]
    return title, body


def _slug(text: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", (text or "master").strip())[:24].strip("-")
    return s or "master"


def cmd_platforms() -> None:
    print(f"{'渠道':<16}{'名称':<14}{'标题':<8}{'正文':<8}风格/备注")
    for pid, cfg in ALL.items():
        print(f"{pid:<16}{cfg['name']:<14}"
              f"{'-' if not cfg['title'] else cfg['title']:<8}{cfg['body']:<8}"
              f"{cfg['note'] if pid in PARENT else cfg.get('style', '')}")


def cmd_plan(args) -> None:
    md = _read_md(args.master)
    title, body = _split_title_body(md)
    plan = {"master": {"source": args.master, "title": title,
                       "chars": len(re.sub(r"\s", "", body))},
            "channels": []}
    for pid in [x.strip() for x in (args.channels or "").split(",") if x.strip()]:
        cfg = _limits(pid)
        plan["channels"].append({
            "platform": pid, "name": cfg["name"],
            "title_limit": cfg["title"] or None, "body_limit": cfg["body"],
            "style": cfg.get("style", ""),
            "llm_checklist": [
                f"标题 ≤{cfg['title']} 全角字" if cfg["title"] else "无标题（正文首句做钩子）",
                f"正文压缩到 ≤{cfg['body']} 字" if len(re.sub(r'\s', '', body)) > cfg['body']
                else f"正文 ≤{cfg['body']} 字（目前不超，仍需按风格重写）",
                f"风格：{cfg.get('style', '')}",
                "母稿数据点必须保留；口水话删掉；结尾给关注/转化引导",
            ],
        })
    out = json.dumps(plan, ensure_ascii=False, indent=2)
    if args.out:
        p = Path(args.out) if Path(args.out).is_absolute() else ROOT / args.out
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(out, encoding="utf-8")
        print(f">>> 计划已存 {p}")
    print(out)


def cmd_check(args) -> None:
    cfg = _limits(args.platform)
    md = _read_md(args.file)
    title, body = _split_title_body(md)
    plain = re.sub(r"\s", "", re.sub(r"<[^>]+>", "", body))
    problems = []
    if cfg["title"] and len(title) > cfg["title"]:
        problems.append(f"标题超限：{len(title)} > {cfg['title']}")
    if len(plain) > cfg["body"]:
        problems.append(f"正文超限：{len(plain)} > {cfg['body']}")
    if args.platform == "xiaohongshu":
        tags = re.findall(r"#\S+", body)
        if len(tags) > 8:
            problems.append(f"小红书话题偏多：{len(tags)} 个（建议 ≤6）")
        if not tags:
            problems.append("小红书缺 #话题 标签")
    result = {"ok": not problems, "platform": args.platform,
              "title_chars": len(title), "body_chars": len(plain),
              "limits": {"title": cfg["title"], "body": cfg["body"]},
              "problems": problems}
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if not problems else 1)


def cmd_save(args) -> None:
    base = REWRITE_DIR / _slug(args.master_id or "master")
    base.mkdir(parents=True, exist_ok=True)
    dest = base / f"{args.platform}.md"
    src = Path(args.file) if os.path.isabs(args.file) else ROOT / args.file
    if not src.is_file():
        sys.exit(f"文件不存在：{args.file}")
    content = src.read_text(encoding="utf-8")
    dest.write_text(content, encoding="utf-8")  # 复制而非移动（可能跨盘）
    manifest = base / "manifest.json"
    idx = json.loads(manifest.read_text(encoding="utf-8")) if manifest.is_file() else {}
    idx.setdefault("master_id", base.name)
    idx.setdefault("variants", {})
    idx["variants"][args.platform] = {"file": str(dest), "ts": time.strftime("%Y-%m-%d %H:%M")}
    manifest.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f">>> 已归档 {dest}")
    print(f">>> 索引   {manifest}")
    print(f"variant_path: {dest}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("platforms").set_defaults(func=lambda a: cmd_platforms())
    p = sub.add_parser("plan", help="生成子渠道改写任务清单")
    p.add_argument("--master", required=True, help="母稿 md（outputs/ 相对或绝对路径）")
    p.add_argument("--channels", required=True, help="逗号分隔：xhs,douyin,zhihu…")
    p.add_argument("--out", help="计划也存盘（json）")
    p.set_defaults(func=cmd_plan)
    c = sub.add_parser("check", help="校验改写稿是否超限")
    c.add_argument("--platform", required=True, choices=sorted(ALL))
    c.add_argument("--file", required=True)
    c.set_defaults(func=cmd_check)
    s = sub.add_parser("save", help="归档改写稿 outputs/rewrite/<母稿>/")
    s.add_argument("--platform", required=True, choices=sorted(ALL))
    s.add_argument("--file", required=True, help="改写稿 md")
    s.add_argument("--master-id", default="master", help="母稿唯一名（建文件夹用）")
    s.set_defaults(func=cmd_save)
    args = ap.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
