#!/usr/bin/env python3
"""飞书多维表格：按 Agent 的 spec 新建表 / 写记录 / 增量同步。

凭证优先从「设置 → 推送配置」保存的 _push.json 读取，也可用环境变量覆盖。
不依赖第三方库，不打印 App Secret / tenant_access_token。

用法（在 Easel 项目根执行）：
  python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py check
  python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py list-tables --app-token <token>
  python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py create --spec spec.json
  python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py sync \
      --app-token <app> --table-id <tbl> --key 篇目 --records records.json

spec.json 结构：
{
  "name": "Easel 内容排期",
  "folder_token": "",
  "tables": [{
    "name": "内容排期",
    "fields": [
      {"name": "篇目", "type": "text"},
      {"name": "日期", "type": "date"},
      {"name": "平台", "type": "text"},
      {"name": "状态", "type": "select", "options": ["待写","草稿","已排期","已发布"]},
      {"name": "备注", "type": "text"},
      {"name": "链接", "type": "url"}
    ],
    "records": [
      {"篇目":"...","日期":"2026-10-24 20:00","平台":"公众号","状态":"待写","链接":"https://..."}
    ]
  }]
}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_FEISHU = "https://open.feishu.cn/open-apis"
BASE_LARK = "https://open.larksuite.com/open-apis"
TZ = timezone(timedelta(hours=8))

TYPE_MAP = {
    "text": 1, "文本": 1, "string": 1,
    "number": 2, "数字": 2,
    "select": 3, "single_select": 3, "单选": 3,
    "date": 5, "日期": 5, "datetime": 5,
    "url": 15, "链接": 15,
    "checkbox": 7, "多选": 4, "multiselect": 4,
}


class FeishuError(RuntimeError):
    pass


def out(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_push_file(explicit: str | None) -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    env_id = os.environ.get("FEISHU_APP_ID", "").strip()
    env_secret = os.environ.get("FEISHU_APP_SECRET", "").strip()
    if env_id and env_secret:
        return None
    root = project_root()
    candidates = sorted(
        (root / "data" / "users").glob("*/outputs/_push.json"),
        key=lambda p: p.stat().st_mtime if p.is_file() else 0,
        reverse=True,
    )
    for p in candidates:
        try:
            d = load_json(p)
        except Exception:
            continue
        if str(d.get("feishu_app_id") or "").strip() and str(d.get("feishu_app_secret") or "").strip():
            return p
    return candidates[0] if candidates else None


def load_credentials(args) -> dict:
    push_file = find_push_file(getattr(args, "push_file", None))
    cfg = {}
    if push_file and push_file.is_file():
        try:
            cfg = load_json(push_file)
        except Exception:
            cfg = {}
    app_id = (args.app_id or os.environ.get("FEISHU_APP_ID") or cfg.get("feishu_app_id") or "").strip()
    app_secret = (args.app_secret or os.environ.get("FEISHU_APP_SECRET") or cfg.get("feishu_app_secret") or "").strip()
    domain = (args.domain or os.environ.get("FEISHU_DOMAIN") or cfg.get("feishu_domain") or "feishu").strip().lower()
    folder = (getattr(args, "folder_token", None) or os.environ.get("FEISHU_FOLDER_TOKEN")
              or cfg.get("feishu_folder_token") or "").strip()
    if not app_id or not app_secret:
        raise FeishuError("未配置飞书 App ID / App Secret：请到 设置 → 推送配置 → 飞书多维表格 填写")
    return {"app_id": app_id, "app_secret": app_secret, "domain": domain,
            "folder_token": folder, "push_file": str(push_file) if push_file else ""}


class Client:
    def __init__(self, cfg: dict):
        self.base = BASE_LARK if cfg["domain"] == "larksuite" else BASE_FEISHU
        self.app_id = cfg["app_id"]
        self.app_secret = cfg["app_secret"]
        self.token = ""

    def _request(self, method: str, path: str, body=None, auth=True, timeout=40):
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json; charset=utf-8"}
        if auth:
            if not self.token:
                self.auth()
            headers["Authorization"] = "Bearer " + self.token
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")
            try:
                payload = json.loads(raw)
            except Exception:
                raise FeishuError(f"HTTP {exc.code}: {raw[:300]}") from exc
        except Exception as exc:  # noqa: BLE001
            raise FeishuError(f"请求失败：{exc}") from exc
        if payload.get("code") not in (0, None):
            raise FeishuError(f"飞书返回错误 {payload.get('code')}: {payload.get('msg')}")
        data = payload.get("data")
        if isinstance(data, dict):
            return data
        # 鉴权接口把 tenant_access_token 放在顶层，不在 data 里
        return {k: v for k, v in payload.items() if k not in ("code", "msg")}

    def auth(self):
        data = self._request(
            "POST", "/auth/v3/tenant_access_token/internal",
            {"app_id": self.app_id, "app_secret": self.app_secret}, auth=False)
        self.token = data.get("tenant_access_token") or ""
        if not self.token:
            raise FeishuError("飞书未返回 tenant_access_token")

    def create_app(self, name: str, folder_token: str = ""):
        body = {"name": name}
        if folder_token:
            body["folder_token"] = folder_token
        return self._request("POST", "/bitable/v1/apps", body)

    def list_tables(self, app_token: str):
        return self._request("GET", f"/bitable/v1/apps/{app_token}/tables?page_size=200").get("items", [])

    def create_table(self, app_token: str, table: dict):
        return self._request("POST", f"/bitable/v1/apps/{app_token}/tables", {"table": table})

    def rename_table(self, app_token: str, table_id: str, name: str):
        return self._request("PATCH", f"/bitable/v1/apps/{app_token}/tables/{table_id}", {"name": name})

    def list_fields(self, app_token: str, table_id: str):
        return self._request("GET", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields?page_size=200").get("items", [])

    def add_field(self, app_token: str, table_id: str, field: dict):
        return self._request("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields", field)

    def update_field(self, app_token: str, table_id: str, field_id: str, patch: dict):
        return self._request("PUT", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields/{field_id}", patch)

    def delete_field(self, app_token: str, table_id: str, field_id: str):
        return self._request("DELETE", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields/{field_id}")

    def list_records(self, app_token: str, table_id: str):
        rows, page = [], ""
        while True:
            q = f"?page_size=500" + (f"&page_token={urllib.parse.quote(page)}" if page else "")
            data = self._request("GET", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records{q}")
            rows.extend(data.get("items", []))
            if not data.get("has_more"):
                break
            page = data.get("page_token") or ""
            if not page:
                break
        return rows

    def batch_create(self, app_token: str, table_id: str, records: list[dict]):
        created = 0
        for i in range(0, len(records), 500):
            chunk = records[i:i + 500]
            data = self._request(
                "POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_create",
                {"records": chunk})
            created += len(data.get("records", []))
        return created

    def batch_update(self, app_token: str, table_id: str, records: list[dict]):
        updated = 0
        for i in range(0, len(records), 500):
            chunk = records[i:i + 500]
            data = self._request(
                "POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_update",
                {"records": chunk})
            updated += len(data.get("records", []))
        return updated

    def batch_delete(self, app_token: str, table_id: str, record_ids: list[str]):
        deleted = 0
        for i in range(0, len(record_ids), 500):
            chunk = record_ids[i:i + 500]
            self._request(
                "POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_delete",
                {"records": chunk})
            deleted += len(chunk)
        return deleted


def normalize_type(value) -> int:
    if isinstance(value, int):
        return value
    key = str(value or "text").strip().lower()
    if key not in TYPE_MAP:
        raise FeishuError(f"不支持的字段类型：{value}（可用 text/number/select/date/url）")
    return TYPE_MAP[key]


def field_payload(field: dict) -> dict:
    name = str(field.get("name") or field.get("field_name") or "").strip()
    if not name:
        raise FeishuError("字段缺少 name")
    ftype = normalize_type(field.get("type", "text"))
    payload = {"field_name": name, "type": ftype}
    if ftype == 3:
        opts = field.get("options") or []
        if not isinstance(opts, list):
            raise FeishuError(f"字段 {name} 的 options 必须是数组")
        payload["property"] = {"options": [{"name": str(x)} for x in opts]}
    elif ftype == 5:
        payload["property"] = {"date_formatter": str(field.get("date_formatter") or "yyyy/MM/dd HH:mm"),
                               "auto_fill": False}
    elif ftype == 2:
        payload["property"] = {"formatter": str(field.get("formatter") or "0")}
    return payload


def parse_date_ms(value) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    s = str(value or "").strip()
    if not s:
        return int(time.time() * 1000)
    if s.isdigit():
        return int(s)
    s = s.replace("/", "-")
    try:
        if len(s) == 10:
            dt = datetime.fromisoformat(s + " 00:00")
        else:
            dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return int(dt.timestamp() * 1000)
    except Exception:
        raise FeishuError(f"无法解析日期：{value}（用 2026-10-24 或 2026-10-24 20:00）")


def record_payload(fields_spec: list[dict], row: dict) -> dict:
    by_name = {str(f.get("name") or f.get("field_name")): f for f in fields_spec}
    payload = {}
    for key, value in row.items():
        spec = by_name.get(str(key))
        ftype = normalize_type(spec.get("type", "text")) if spec else 1
        if ftype == 5:
            payload[str(key)] = parse_date_ms(value)
        elif ftype == 15:
            if isinstance(value, dict):
                payload[str(key)] = value
            else:
                payload[str(key)] = {"link": str(value), "text": str(value)}
        elif ftype == 7:
            payload[str(key)] = bool(value)
        elif ftype == 2:
            try:
                payload[str(key)] = float(value)
            except Exception:
                payload[str(key)] = value
        else:
            payload[str(key)] = "" if value is None else str(value)
    return payload


def ensure_default_table(client: Client, app_token: str, default_table_id: str, table_spec: dict):
    """把新建应用默认表改造成 spec 的第一张表；返回 table_id。"""
    fields_spec = table_spec.get("fields") or []
    if not fields_spec:
        raise FeishuError(f"表 {table_spec.get('name')} 没有 fields")
    if normalize_type(fields_spec[0].get("type", "text")) != 1:
        raise FeishuError("第一张表的第一个字段必须是 text（作为主字段）")
    client.rename_table(app_token, default_table_id, str(table_spec.get("name") or "数据表"))
    current = client.list_fields(app_token, default_table_id)
    primary = next((f for f in current if f.get("is_primary")), None)
    if not primary:
        raise FeishuError("默认表没有主字段")
    first = field_payload(fields_spec[0])
    client.update_field(app_token, default_table_id, primary["field_id"],
                        {"field_name": first["field_name"], "type": 1})
    for f in current:
        if f["field_id"] != primary["field_id"]:
            client.delete_field(app_token, default_table_id, f["field_id"])
    for f in fields_spec[1:]:
        client.add_field(app_token, default_table_id, field_payload(f))
    return default_table_id


def create_table_and_find(client: Client, app_token: str, table_spec: dict):
    name = str(table_spec.get("name") or "").strip()
    if not name:
        raise FeishuError("表缺少 name")
    fields = [field_payload(f) for f in (table_spec.get("fields") or [])]
    if not fields:
        raise FeishuError(f"表 {name} 没有 fields")
    before = {t["table_id"] for t in client.list_tables(app_token)}
    client.create_table(app_token, {"name": name, "default_view_name": "全部记录", "fields": fields})
    for t in client.list_tables(app_token):
        if t["name"] == name and t["table_id"] not in before:
            return t["table_id"]
    for t in client.list_tables(app_token):
        if t["name"] == name:
            return t["table_id"]
    raise FeishuError(f"创建表 {name} 后找不到 table_id")


def clean_empty_records(client: Client, app_token: str, table_id: str) -> int:
    rows = client.list_records(app_token, table_id)
    empty = [r["record_id"] for r in rows
             if not r.get("fields") or not any(v not in (None, "", []) for v in (r.get("fields") or {}).values())]
    return client.batch_delete(app_token, table_id, empty) if empty else 0


def cmd_check(args):
    cfg = load_credentials(args)
    client = Client(cfg)
    client.auth()
    result = {"ok": True, "app_id": cfg["app_id"], "domain": cfg["domain"],
              "folder_token_set": bool(cfg["folder_token"]), "push_file": cfg["push_file"]}
    if args.app_token:
        result["tables"] = [{"name": t["name"], "table_id": t["table_id"]}
                            for t in client.list_tables(args.app_token)]
    out(result)


def cmd_list_tables(args):
    cfg = load_credentials(args)
    client = Client(cfg)
    out({"ok": True, "tables": [{"name": t["name"], "table_id": t["table_id"]}
                                for t in client.list_tables(args.app_token)]})


def load_spec(args) -> dict:
    raw = args.spec
    p = Path(raw)
    if p.is_file():
        return load_json(p)
    try:
        return json.loads(raw)
    except Exception as exc:
        raise FeishuError(f"--spec 不是有效 JSON 文件或内联 JSON：{exc}") from exc


def cmd_create(args):
    cfg = load_credentials(args)
    client = Client(cfg)
    spec = load_spec(args)
    name = str(args.name or spec.get("name") or "").strip()
    if not name:
        raise FeishuError("缺少多维表格名称（--name 或 spec.name）")
    tables = spec.get("tables") or []
    if not tables:
        raise FeishuError("spec.tables 不能为空")
    folder = str(args.folder_token or spec.get("folder_token") or cfg["folder_token"] or "").strip()
    created = client.create_app(name, folder)
    app = created.get("app") or {}
    app_token = app.get("app_token") or created.get("app_token")
    default_table = created.get("default_table_id") or ""
    if not app_token:
        raise FeishuError("创建多维表格失败：未返回 app_token")
    if not default_table:
        ts = client.list_tables(app_token)
        default_table = ts[0]["table_id"] if ts else ""

    result_tables = []
    for idx, table_spec in enumerate(tables):
        if idx == 0 and default_table:
            table_id = ensure_default_table(client, app_token, default_table, table_spec)
        else:
            table_id = create_table_and_find(client, app_token, table_spec)
        rows = table_spec.get("records") or []
        records = [{"fields": record_payload(table_spec.get("fields") or [], row)} for row in rows]
        inserted = client.batch_create(app_token, table_id, records) if records else 0
        removed = clean_empty_records(client, app_token, table_id)
        result_tables.append({"name": table_spec.get("name"), "table_id": table_id,
                              "records": inserted, "empty_removed": removed})
    url = app.get("url") or f"https://my.feishu.cn/base/{app_token}"
    result = {"ok": True, "name": name, "app_token": app_token, "url": url,
              "folder_token": folder, "tables": result_tables}
    if args.out:
        Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    out(result)


def load_records(args) -> list[dict]:
    p = Path(args.records)
    if p.is_file():
        data = load_json(p)
    else:
        data = json.loads(args.records)
    if isinstance(data, dict):
        data = data.get("records") or []
    if not isinstance(data, list):
        raise FeishuError("records 必须是数组")
    return data


def cmd_sync(args):
    cfg = load_credentials(args)
    client = Client(cfg)
    rows = load_records(args)
    if not rows:
        out({"ok": True, "created": 0, "updated": 0, "message": "没有记录"})
        return
    key = str(args.key or "").strip()
    fields_spec = []
    if key:
        fields_spec = [{"name": key, "type": "text"}]
    existing = client.list_records(args.app_token, args.table_id)
    index = {}
    if key:
        for r in existing:
            v = (r.get("fields") or {}).get(key)
            if isinstance(v, list):
                v = v[0].get("text") if v and isinstance(v[0], dict) else v
            if v not in (None, ""):
                index[str(v)] = r["record_id"]
    to_update, to_create = [], []
    for row in rows:
        payload = {"fields": {k: (v if not isinstance(v, list) else v) for k, v in row.items()}}
        if key and str(row.get(key, "")) in index:
            to_update.append({"record_id": index[str(row.get(key, ""))], **payload})
        else:
            to_create.append(payload)
    updated = client.batch_update(args.app_token, args.table_id, to_update) if to_update else 0
    created = client.batch_create(args.app_token, args.table_id, to_create) if to_create else 0
    out({"ok": True, "created": created, "updated": updated, "key": key or None})


def build_parser():
    ap = argparse.ArgumentParser(description="飞书多维表格：新建 / 写记录 / 增量同步")
    ap.add_argument("--push-file", help="_push.json 路径（默认自动找当前用户）")
    ap.add_argument("--app-id", help="覆盖 App ID")
    ap.add_argument("--app-secret", help="覆盖 App Secret")
    ap.add_argument("--domain", choices=["feishu", "larksuite"], help="飞书版本")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("check", help="校验凭证；可顺带列出表")
    p.add_argument("--app-token", default="")
    p.add_argument("--folder-token", default="")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("list-tables", help="列出一张多维表格的所有数据表")
    p.add_argument("--app-token", required=True)
    p.add_argument("--folder-token", default="")
    p.set_defaults(func=cmd_list_tables)

    p = sub.add_parser("create", help="按 spec 新建多维表格、建表并写记录")
    p.add_argument("--spec", required=True, help="spec JSON 文件路径或内联 JSON")
    p.add_argument("--name", default="", help="多维表格名称（覆盖 spec.name）")
    p.add_argument("--folder-token", default="", help="目标文件夹 token（可选）")
    p.add_argument("--out", default="", help="把结果 JSON 写到文件")
    p.set_defaults(func=cmd_create)

    p = sub.add_parser("sync", help="按 key 字段增量更新/新增记录")
    p.add_argument("--app-token", required=True)
    p.add_argument("--table-id", required=True)
    p.add_argument("--records", required=True, help="记录 JSON 文件路径或内联 JSON 数组")
    p.add_argument("--key", default="", help="用于匹配已有记录的字段名，例如 篇目")
    p.add_argument("--folder-token", default="")
    p.set_defaults(func=cmd_sync)
    return ap


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        args = build_parser().parse_args()
        args.func(args)
        return 0
    except FeishuError as exc:
        print(f"飞书多维表格失败：{exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"飞书多维表格异常：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
