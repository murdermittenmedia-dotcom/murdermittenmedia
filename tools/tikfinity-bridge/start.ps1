param(
  [ValidateSet('run', 'pair', 'simulate', 'check-config')]
  [string]$Command = 'run'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Install official Node.js 22 or newer, then reopen PowerShell.'
  exit 1
}
$major = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { Write-Error 'Node.js 22 or newer is required.'; exit 1 }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/ws'))) {
  Write-Error 'Run npm install in this folder first. No global package install is needed.'
  exit 1
}
$nodeCommand = switch ($Command) {
  'simulate' { '--simulate' }
  'check-config' { '--check-config' }
  default { $Command }
}
& node (Join-Path $PSScriptRoot 'bridge.mjs') $nodeCommand
exit $LASTEXITCODE
