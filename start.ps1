$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '未找到 Node.js。请安装 Node 24.16+（或 26.1+）后重试。' -ForegroundColor Red
  exit 1
}
node scripts/launch.mjs
