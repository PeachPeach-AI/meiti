#!/usr/bin/env python3
"""route.py — 「账号登录 & 自动发布」命令路由器.

把「平台 → 底层脚本 + 真实参数」的映射固化，Agent 不用记各发布脚本的参数差异：
  platforms        列出全部平台及其登录/发布后端
  cmd <p> login    生成登录命令（--run 直接执行）
  cmd <p> login-qr headless 二维码登录（web 平台）
  cmd <p> status   生成登录态检查命令
  cmd <p> publish [--title --content --media a,b --tags t1,t2 --exec --run ...]

约定：
  - 默认只打印命令；加 --run 才执行（子进程，UTF-8 输出，防 GBK 崩溃）。
  - publish 不带 --exec 为 dry-run；真实发布必须 --exec --run 且经用户确认。
  - 媒体路径需绝对路径或 outputs/ 相对路径，脚本会校验存在。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

try:  # Windows 控制台默认 GBK，统一 UTF-8 防打印 emoji 崩溃
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# <root>/skills/openclaw/<skill>/scripts/route.py → parents[4] = 项目根
ROOT = Path(__file__).resolve().parents[4]
SHARED = ROOT / "skills" / "shared" / "scripts"
PRINTERS = Path("outputs") / "_login"


def _py() -> str:
    v = ROOT / ".venv" / "Scripts" / "python.exe"
    return v.as_posix() if v.is_file() else sys.executable


# 平台注册表：脚本 + 子命令风格
# style: xhs(-style: publish/publish-video, 参数 --title/--content/--images/--video)
#        douyin 同 xhs；web: web_publisher（--platform/--title/--desc/--media）
XHS = {"xiaohongshu": {"name": "小红书", "script": SHARED / "xhs_publish.py", "kind": "xhs",
                        "note": "Windows 登录自动有头；headless 会被判 IP 风险"}}
DOUYIN = {"douyin": {"name": "抖音", "script": SHARED / "douyin_publish.py", "kind": "xhs",
                     "note": "发布为异步，可能触发短信验证"}}
WEB = {
    "kuaishou": "快手", "weixin-channels": "视频号", "zhihu": "知乎",
    "weibo": "微博", "toutiao": "今日头条", "baijiahao": "百家号", "sohu": "搜狐号",
}
WEB_T = {k: {"name": v, "script": SHARED / "web_publisher.py", "kind": "web",
             "note": "统一 Playwright 引擎"} for k, v in WEB.items()}
PLATS: dict[str, dict] = {**XHS, **DOUYIN, **WEB_T,
    "bilibili": {"name": "B站", "script": ROOT / "skills" / "openclaw" / "skill-bilibili-upload"
                 / "scripts" / "bili_upload.py", "kind": "other",
                 "note": "TV 扫码 API → biliup cookie；发布见 skill-bilibili-upload"},
    "wechat-oa": {"name": "微信公众号", "script": SHARED / "weixin_mp_stats.py", "kind": "mp",
                  "note": "登录=公众号后台扫码；发布委派 skill-wechat-publisher（只到草稿箱）"},
    "maywide": {"name": "官网·资源", "script": None, "kind": "api",
                "note": "账号密码 + POST /api/maywide/publish（Easel 本机 7866，Bearer token）"},
}
ARTICLE_ONLY = {"zhihu"}  # 专栏文章，无需媒体
QR_PLATFORMS = set(WEB) | set(ARTICLE_ONLY)


def _media_ok(medias: list[str], where: str) -> None:
    base = ROOT / "outputs"
    for m in medias:
        p = Path(m) if os.path.isabs(m) else base / m
        if not p.is_file():
            sys.exit(f"媒体不存在：{m}\n（绝对路径，或相对 outputs/：{p}）")


def _login_cmd(p: str, a) -> list[str]:
    cfg = PLATS[p]
    if cfg["kind"] == "web":
        return [_py(), cfg["script"].as_posix(), "login-qr", "--platform", p,
                "--qr-out", (PRINTERS / f"{p}.png").as_posix(),
                "--status-file", (PRINTERS / f"{p}.status.json").as_posix(),
                "--timeout", str(a.timeout or 180)]
    if cfg["kind"] == "xhs":
        cmd = [_py(), cfg["script"].as_posix(), "login",
               "--qr-out", (PRINTERS / f"{p}.png").as_posix(),
               "--status-file", (PRINTERS / f"{p}.status.json").as_posix(),
               "--timeout", str(a.timeout or 180)]
        if a.headed:
            cmd.append("--headed")  # Windows 下 xhs 已自动有头，显式 --headed 供其他平台
    elif cfg["kind"] == "mp" and p == "wechat-oa":
        cmd = [_py(), cfg["script"].as_posix(), "login"]
    else:
        sys.exit(f"{p} 登录走专属 SKILL 或账号页，请直接查看；无通用命令。")
    return cmd


def _status_cmd(p: str) -> list[str]:
    cfg = PLATS[p]
    if cfg["kind"] in ("web",) or (cfg["kind"] == "xhs" and p == "douyin"):
        return [_py(), cfg["script"].as_posix(), "whoami", "--platform", p]
    if p == "wechat-oa":
        return [_py(), cfg["script"].as_posix(), "whoami"]
    if p == "bilibili":
        return [_py(), cfg["script"].as_posix(), "check"]
    sys.exit(f"{p} 无 whoami 子命令：小红书看 Web 账号页卡片；官网看账号页「验证」按钮。")


def _publish_cmd(p: str, a, auto_exec: bool) -> list[str]:
    cfg = PLATS[p]
    title = (a.title or "").strip()
    body = (getattr(a, "content", None) or getattr(a, "desc", None) or "").strip()
    if not title:
        sys.exit("缺少 --title")
    if cfg["kind"] == "other":
        sys.exit(f"发布 {p} 请委派对应 SKILL：bilibili→skill-bilibili-upload；"
                 "wechat-oa→skill-wechat-publisher；wordpress/typecho→cms_publish.py；"
                 "maywide→POST /api/maywide/publish。")
    if not body:
        sys.exit("缺少正文（--content）")
    is_xhs = cfg["kind"] == "xhs"
    medias = [m.strip() for m in (a.media or "").split(",") if m.strip()]
    if medias:
        _media_ok(medias, p)
    cmd = [_py(), cfg["script"].as_posix()]
    if p in ARTICLE_ONLY:
        cmd += ["publish", "--platform", p, "--title", title, "--desc", body]
        if a.tags:
            cmd += ["--tags", a.tags]
        cmd += ["--exec"] if (a.exec_ or auto_exec) else []
        if a.headed:
            cmd.append("--headed")
        return cmd
    if is_xhs:
        use_video = a.video or (a.media and len(medias) == 1 and
                                Path(medias[0]).suffix.lower() in (".mp4", ".mov", ".webm"))
        if use_video:
            vid = a.video or medias[0]
            _media_ok([vid], p)
            cmd += ["publish-video", "--title", title, "--content", body, "--video", vid]
        else:
            if not medias:
                sys.exit("小红书图文发布需要 --media 图片（绝对路径，逗号分隔）")
            cmd += ["publish", "--title", title, "--content", body, "--images", ",".join(medias)]
        if a.tags:
            cmd += ["--tags", a.tags]
        if a.exec_ or auto_exec:
            cmd.append("--exec")
        if a.headed:
            cmd.append("--headed")
        cmd += ["--no-proxy"] if a.no_proxy else []
    else:  # web 平台
        if not medias and p not in ARTICLE_ONLY:
            sys.exit(f"{p} 发布需要 --media（图片或 mp4，绝对路径，逗号分隔）")
        cmd += ["publish", "--platform", p, "--title", title, "--desc", body]
        if medias:
            cmd += ["--media", ",".join(medias)]
        if a.tags:
            cmd += ["--tags", a.tags]
        if a.exec_ or auto_exec:
            cmd.append("--exec")
        if a.headed:
            cmd.append("--headed")
    return cmd


def _show_or_run(cmd: list[str], do_run: bool) -> None:
    printable = subprocess.list2cmdline(cmd) if os.name == "nt" else " ".join(cmd)
    if not do_run:
        print(printable)
        print("# 仅预览。确认后追加 --run 执行；publish 首次执行前需用户确认内容。")
        return
    print(">> " + printable)
    try:
        env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
        rc = subprocess.run(cmd, cwd=str(ROOT), shell=False, env=env).returncode
    except KeyboardInterrupt:
        sys.exit(130)
    sys.exit(rc)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("platforms", help="列出平台及后端")

    c = sub.add_parser("cmd", help="生成/执行平台命令")
    c.add_argument("platform", choices=sorted(PLATS))
    c.add_argument("action", choices=["login", "login-qr", "status", "publish"])
    c.add_argument("--title"), c.add_argument("--content"), c.add_argument("--desc")
    c.add_argument("--video"), c.add_argument("--media", help="图片/视频路径，逗号分隔")
    c.add_argument("--tags"), c.add_argument("--exec", dest="exec_", action="store_true")
    c.add_argument("--run", action="store_true", help="直接执行（默认只打印命令）")
    c.add_argument("--headed", action="store_true")
    c.add_argument("--no-proxy", action="store_true")
    c.add_argument("--timeout", type=int)

    args = ap.parse_args()
    if args.cmd == "platforms":
        print(f"{'平台':<18}{'名称':<10}{'后端':<16}{'说明'}")
        for k, v in sorted(PLATS.items()):
            name = v["script"].name if v["script"] else "-"
            print(f"{k:<18}{v['name']:<10}{name:<16}{v['note']}")
        return 0

    p, act = args.platform, args.action
    if act == "publish":
        _show_or_run(_publish_cmd(p, args, auto_exec=False), args.run)
    elif act == "status":
        _show_or_run(_status_cmd(p), args.run)
    else:
        _show_or_run(_login_cmd(p, args), args.run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
