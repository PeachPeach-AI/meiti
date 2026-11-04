#!/usr/bin/env python3
"""zhihu_auto.py — 知乎自动答题：找题 → 挑题排队 → 逐题作答（发布复用 zhihu_answer.py）.

子命令：
  check   确认 ZhihuProfile 登录态（调 web_publisher whoami）
  find    关键词搜题：输出 JSON 行（url/title/回答数/摘要），可存盘
  plan    从 find 结果挑题生成作答计划（默认低竞争优先：回答数少、问题有流量）
  mark    把某题标记为已作答并登记答案文件，打印下一个待答
  next    查看计划里下一个待答题目

发布不在本脚本：逐题调 `skills/shared/scripts/zhihu_answer.py --question <url>
--content-file <答案.md> [--exec]`（dry-run 先行，用户确认后 --exec）。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
SHARED = ROOT / "skills" / "shared" / "scripts"
PLAN_DEFAULT = ROOT / "outputs" / "zhihu" / "auto-answer-plan.json"
ANSWER_DIR = ROOT / "outputs" / "zhihu_answers"
SEARCH_URL = "https://www.zhihu.com/search?type=content&q="
ANS_RE = re.compile(r"([\d,万\.]+)\s*个?回答")
_QID = re.compile(r"/question/(\d+)")


def _py() -> str:
    v = ROOT / ".venv" / "Scripts" / "python.exe"
    return v.as_posix() if v.is_file() else sys.executable


def _launch_ctx():
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, str(SHARED))
    import browser_stealth  # noqa: E402  去 headless 指纹
    browser_stealth.apply() if hasattr(browser_stealth, "apply") else None

    args = ["--disable-blink-features=AutomationControlled", "--no-sandbox",
            "--disable-dev-shm-usage", "--disable-gpu", "--mute-audio",
            "--no-first-run", "--no-default-browser-check"]
    pw = sync_playwright().start()
    ctx = pw.chromium.launch_persistent_context(
        str(Path.home() / ".easel-browser-profiles" / "ZhihuProfile"),
        headless=True, locale="zh-CN", args=args)
    return pw, ctx


def cmd_check() -> int:
    r = subprocess.run([_py(), str(SHARED / "web_publisher.py"), "whoami",
                        "--platform", "zhihu"], cwd=str(ROOT))
    return r.returncode


def cmd_find(args) -> None:
    pw, ctx = _launch_ctx()
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_default_timeout(45000)
    page.goto(SEARCH_URL + quote(args.q), wait_until="domcontentloaded")
    page.wait_for_timeout(3500)
    if "signin" in page.url or "signinform" in page.url:
        sys.exit("知乎要求登录才能搜索：先跑\n  python skills/openclaw/skill-login-and-publish"
                 "/scripts/route.py cmd zhihu login-qr --run\n登录后再 find。")
    for _ in range(4):  # 简单滚动加载
        page.mouse.wheel(0, 2400)
        page.wait_for_timeout(1200)
    try:  # 关掉「打开 App」浮层（存在才点）
        for sel in ("button:has-text('关闭')", ".Modal-closeButton"):
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                break
    except Exception:
        pass

    seen, results = set(), []
    cards = page.evaluate("""() => {
      const out=[];
      for (const a of document.querySelectorAll("a[href*='/question/']")) {
        const m=a.href.match(/\\/question\\/(\\d+)/); if(!m)continue;
        const t=(a.innerText||'').trim(); if(t.length<8)continue;
        let card=a.closest('.Card')||a.parentElement;
        let meta='';
        for (let i=0;i<4 && card && meta.length<40;i++,card=card.parentElement)
          meta=(card.innerText||'').replace(t,'').trim();
        out.push({qid:m[1], title:t, meta:meta.slice(0,160)});
      }
      return out;
    }""")
    for c in cards:
        if c["qid"] in seen:
            continue
        seen.add(c["qid"])
        m_ans = ANS_RE.search(c.get("meta") or "")
        heat = m_ans.group(1) if m_ans else ""
        if not heat:  # 搜索卡常无「N 个回答」，用「赞同 N」当竞争度代理
            m_up = re.search(r"赞同\s*([\d,\.]+万?)", c.get("meta") or "")
            heat = m_up.group(1) if m_up else ""
        results.append({"qid": c["qid"],
                        "url": f"https://www.zhihu.com/question/{c['qid']}",
                        "title": c["title"][:80],
                        "answers": heat,
                        "excerpt": (c.get("meta") or "")[:100]})
        if len(results) >= args.limit:
            break
    pw.stop()
    if not results:
        sys.exit("没抓到题目：换关键词，或知乎改版（搜卡片选择器在 zhihu_auto.py 顶部）")
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    if args.out:
        p = Path(args.out) if Path(args.out).is_absolute() else ROOT / args.out
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f">>> {len(results)} 题已存 {p}")


def _load_plan(path: Path) -> dict:
    if not path.is_file():
        sys.exit(f"计划不存在：{path}（先 find --out 或 plan 生成）")
    return json.loads(path.read_text(encoding="utf-8"))


def _ans_num(a: str) -> int:
    """热度代理值：回答数或赞同数。缺失=无热度信号，排最后（answer 计划时 Notes 里说明）。"""
    if not a:
        return 10 ** 6
    if "万" in a:
        return int(float(a.replace("万", "")) * 10000)
    return int(re.sub(r"[^\d]", "", a) or 0) or 10 ** 6


def cmd_plan(args) -> None:
    src = Path(args.from_file) if Path(args.from_file).is_absolute() else ROOT / args.from_file
    items = _load_plan(src)
    if isinstance(items, dict):
        items = items.get("questions") or items.get("items") or []
    picked = [q for q in items if _ans_num(q.get("answers", "")) <= args.max_answers]
    picked.sort(key=lambda q: _ans_num(q.get("answers", "")))  # 低竞争优先
    picked = picked[:args.pick]
    plan = {"created": time.strftime("%Y-%m-%d %H:%M"), "strategy": args.strategy,
            "queue": [{"url": q["url"], "title": q["title"], "answers": q.get("answers", ""),
                       "answer_file": "", "status": "pending"} for q in picked]}
    dest = Path(args.plan) if Path(args.plan).is_absolute() else ROOT / args.plan
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f">>> 计划 {len(picked)} 题 → {dest}")
    for q in plan["queue"]:
        print(f"  [ ] {q['answers']:>6}答  {q['title']}")


def _next(plan: dict):
    for q in plan["queue"]:
        if q["status"] != "done":
            return q
    return None


def cmd_mark(args) -> None:
    path = Path(args.plan) if Path(args.plan).is_absolute() else ROOT / args.plan
    plan = _load_plan(path)
    for q in plan["queue"]:
        if q["url"] == args.url or q["url"].endswith(args.url):
            q["status"] = "done"
            q["answer_file"] = args.answer_file
            break
    else:
        sys.exit(f"计划里没有这道题：{args.url}")
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    nxt = _next(plan)
    if nxt:
        print(f">>> 已登记。下一题：{nxt['title']}\n    {nxt['url']}")
        print("    作答后执行：")
        print(f"    python {SHARED / 'zhihu_answer.py'} --question {nxt['url']} "
              f"--content-file <答案.md> --exec")
    else:
        print(">>> 全部作答完成！")


def cmd_next(args) -> None:
    path = Path(args.plan) if Path(args.plan).is_absolute() else ROOT / args.plan
    plan = _load_plan(path)
    nxt = _next(plan)
    done = sum(1 for q in plan["queue"] if q["status"] == "done")
    print(f">>> 进度 {done}/{len(plan['queue'])}")
    if nxt:
        print(json.dumps(nxt, ensure_ascii=False))
        print(f"    发布命令：\n    python {SHARED / 'zhihu_answer.py'} --question {nxt['url']} "
              f"--content-file <答案.md> [--exec --headed]")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(func=lambda a: cmd_check())
    f = sub.add_parser("find", help="关键词搜题")
    f.add_argument("--q", required=True)
    f.add_argument("--limit", type=int, default=12)
    f.add_argument("--out", help="结果存盘（json），供 plan 用")
    f.set_defaults(func=cmd_find)
    p = sub.add_parser("plan", help="挑题生成作答计划")
    p.add_argument("--from-file", required=True, help="find --out 的结果文件")
    p.add_argument("--pick", type=int, default=3, help="挑几题（默认 3）")
    p.add_argument("--max-answers", type=int, default=200,
                   help="回答数上限（低竞争过滤，默认 200）")
    p.add_argument("--plan", default=str(PLAN_DEFAULT))
    p.add_argument("--strategy", default="low-competition")
    p.set_defaults(func=cmd_plan)
    m = sub.add_parser("mark", help="登记已作答")
    m.add_argument("--url", required=True)
    m.add_argument("--answer-file", required=True)
    m.add_argument("--plan", default=str(PLAN_DEFAULT))
    m.set_defaults(func=cmd_mark)
    n = sub.add_parser("next", help="查看下一题")
    n.add_argument("--plan", default=str(PLAN_DEFAULT))
    n.set_defaults(func=cmd_next)

    a = ap.parse_args()
    a.func(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
