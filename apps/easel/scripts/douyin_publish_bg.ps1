param(
  [string]$Log = "",
  [string]$ErrLog = "",
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root '.venv\Scripts\python.exe'
$script = Join-Path $root 'skills\shared\scripts\douyin_publish.py'
if (-not (Test-Path -LiteralPath $py)) { throw "Python not found: $py" }
if (-not (Test-Path -LiteralPath $script)) { throw "douyin_publish.py not found: $script" }
if ($Rest.Count -gt 0 -and $Rest[0] -eq '--') { $Rest = $Rest[1..($Rest.Count - 1)] }
if (-not $Log) { $Log = Join-Path $root 'outputs\_login\douyin.publish.log' }
if (-not $ErrLog) { $ErrLog = $Log + '.err' }
$logDir = Split-Path -Parent $Log
if ($logDir) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
$env:PYTHONUNBUFFERED = '1'
$args = @('-u', $script) + $Rest
$p = Start-Process -FilePath $py -ArgumentList $args -WorkingDirectory $root `
  -RedirectStandardOutput $Log -RedirectStandardError $ErrLog `
  -WindowStyle Hidden -PassThru
[pscustomobject]@{
  ok = $true
  pid = $p.Id
  log = $Log
  err = $ErrLog
  args = $Rest -join ' '
} | ConvertTo-Json -Compress
