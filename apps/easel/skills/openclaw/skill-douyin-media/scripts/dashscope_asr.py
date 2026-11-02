#!/usr/bin/env python3
"""用 DashScope Paraformer 做音频转字幕（无需本地模型）。

流程：音频 → 临时公开 URL（uguu）→ DashScope 文件转写 → SRT/TXT。
适合本地 faster-whisper 模型下载不稳定时使用；会上传音频到临时公开文件床，
只处理用户有权处理的内容。

用法：
  python skills/openclaw/skill-douyin-media/scripts/dashscope_asr.py \
    -i outputs/项目/video.m4a -o outputs/项目/subtitle.srt
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[4]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"


def die(msg: str, code: int = 1) -> None:
    print(f"云转写失败：{msg}", file=sys.stderr)
    raise SystemExit(code)


def load_key() -> str:
    key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    if key:
        return key
    env = ROOT / ".env"
    try:
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("DASHSCOPE_API_KEY="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    die("未配置 DASHSCOPE_API_KEY（项目根 .env 或环境变量）")


def upload(audio: Path) -> str:
    with open(audio, "rb") as f:
        r = httpx.post(
            "https://uguu.se/upload.php",
            files={"files[]": (audio.name, f, "application/octet-stream")},
            headers={"User-Agent": UA}, timeout=120, follow_redirects=True,
        )
    if r.status_code != 200:
        die(f"临时文件上传失败 HTTP {r.status_code}：{r.text[:200]}")
    try:
        url = r.json()["files"][0]["url"]
    except Exception:
        die(f"临时文件上传返回异常：{r.text[:200]}")
    if not str(url).startswith("http"):
        die(f"临时文件 URL 无效：{url}")
    return str(url)


def submit(key: str, url: str, model: str) -> str:
    body = {"model": model, "input": {"file_urls": [url]},
            "parameters": {"language": "zh"}}
    r = httpx.post(
        "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
        headers={"Authorization": "Bearer " + key, "X-DashScope-Async": "enable",
                 "Content-Type": "application/json"},
        json=body, timeout=60,
    )
    try:
        d = r.json()
    except Exception:
        die(f"提交失败 HTTP {r.status_code}：{r.text[:300]}")
    task = (d.get("output") or {}).get("task_id")
    if not task:
        die(f"提交失败：{d.get('message') or d}")
    return task


def wait(key: str, task: str, timeout_s: int = 180) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        time.sleep(2)
        r = httpx.get("https://dashscope.aliyuncs.com/api/v1/tasks/" + task,
                      headers={"Authorization": "Bearer " + key}, timeout=30)
        try:
            d = r.json()
        except Exception:
            continue
        out = d.get("output") or {}
        st = out.get("task_status")
        if st == "SUCCEEDED":
            return out
        if st == "FAILED":
            die(f"任务失败：{out.get('message') or out.get('code') or d}")
    die(f"任务超时（{timeout_s}s）")


def transcription_url(out: dict) -> str:
    for item in out.get("results") or []:
        u = item.get("transcription_url")
        if u:
            return str(u)
        o = item.get("output") or {}
        if o.get("transcription_url"):
            return str(o["transcription_url"])
        for sub in o.get("results") or []:
            if sub.get("transcription_url"):
                return str(sub["transcription_url"])
    die("任务成功但没有 transcription_url")


def fmt_ts(ms: int) -> str:
    ms = max(0, int(ms))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_outputs(data: dict, out_path: Path) -> dict:
    transcripts = data.get("transcripts") or []
    sentences = []
    texts = []
    for tr in transcripts:
        if tr.get("text"):
            texts.append(str(tr["text"]).strip())
        for s in tr.get("sentences") or []:
            sentences.append(s)
    if not sentences and texts:
        # 没有时间戳时，按整段输出（时间从 0 开始）
        dur = (data.get("properties") or {}).get("original_duration_in_milliseconds") or 0
        sentences = [{"begin_time": 0, "end_time": dur, "text": "\n".join(texts)}]
    if not sentences:
        die("转写结果没有句子（音频里可能没有人声）")

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    is_txt = out_path.suffix.lower() == ".txt"
    if is_txt:
        out_path.write_text("\n".join((s.get("text") or "").strip() for s in sentences),
                            encoding="utf-8")
    else:
        lines = []
        for i, s in enumerate(sentences, 1):
            lines.append(str(i))
            lines.append(f"{fmt_ts(s.get('begin_time') or 0)} --> {fmt_ts(s.get('end_time') or 0)}")
            lines.append((s.get("text") or "").strip())
            lines.append("")
        out_path.write_text("\n".join(lines), encoding="utf-8")
        # 同时留一份纯文本，便于给文案用
        out_path.with_suffix(".txt").write_text(
            "\n".join((s.get("text") or "").strip() for s in sentences), encoding="utf-8")
    return {"out": str(out_path), "sentences": len(sentences),
            "chars": sum(len((s.get("text") or "").strip()) for s in sentences)}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="DashScope Paraformer 音频转字幕")
    ap.add_argument("-i", "--input", required=True)
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--model", default="paraformer-v2", choices=["paraformer-v2", "fun-asr"])
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--keep-json", action="store_true")
    a = ap.parse_args()
    audio = Path(a.input)
    if not audio.is_file():
        die(f"音频不存在：{audio}")
    key = load_key()
    print(f"[asr] 上传临时文件：{audio.name}", file=sys.stderr)
    url = upload(audio)
    print(f"[asr] 提交 {a.model}", file=sys.stderr)
    task = submit(key, url, a.model)
    out = wait(key, task, a.timeout)
    turl = transcription_url(out)
    data = httpx.get(turl, timeout=60).json()
    info = write_outputs(data, Path(a.out))
    if a.keep_json:
        Path(str(a.out) + ".json").write_text(json.dumps(data, ensure_ascii=False, indent=2),
                                              encoding="utf-8")
    print(json.dumps({"ok": True, **info, "model": a.model}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
