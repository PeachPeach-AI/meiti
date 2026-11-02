#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node 24.16+（或 26.1+）后重试。" >&2
  exit 1
fi
exec node scripts/launch.mjs
