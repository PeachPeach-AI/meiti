#!/bin/sh
set -e
cd /app

if [ ! -f /root/.openclaw-easel/openclaw.json ]; then
  echo "[entrypoint] 首次启动，初始化 OpenClaw easel profile..."
  node scripts/init-easel.mjs
fi

exec node scripts/launch.mjs
