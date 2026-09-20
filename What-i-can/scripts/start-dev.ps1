# scripts/start-dev.ps1
# Start mock + helpdesk in parallel, open debug UI.
# Usage:
#   .\scripts\start-dev.ps1
#   .\scripts\start-dev.ps1 -MockOnly
#   .\scripts\start-dev.ps1 -HelpdeskOnly

param(
  [switch]$MockOnly,
  [switch]$HelpdeskOnly,
  [string]$HelpdeskPath = "..\..",
  [int]$MockPort = 8788,
  [int]$HelpdeskPort = 8787
)

$ErrorActionPreference = 'Stop'
$mockPath = Join-Path $PSScriptRoot '..\mocks'

Write-Host "🚀 Starting A5 dev environment`n" -ForegroundColor Cyan

# Start mock
if (-not $HelpdeskOnly) {
  if (-not (Test-Path $mockPath)) {
    Write-Host "❌ Mock dir not found: $mockPath" -ForegroundColor Red
    Write-Host "   Run: cd What-i-can\mocks && wrangler init wellbeing-mock --type javascript"
    exit 1
  }
  Write-Host "  Mock    → http://localhost:$MockPort" -ForegroundColor Green
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$mockPath'; wrangler dev --port $MockPort"
  ) -WindowStyle Normal
}

# Start helpdesk
if (-not $MockOnly) {
  $helpdeskFull = (Resolve-Path $HelpdeskPath).Path
  if (-not (Test-Path $helpdeskFull)) {
    Write-Host "⚠️  Helpdesk path not found: $helpdeskFull" -ForegroundColor Yellow
    Write-Host "   Skipping helpdesk. Use -HelpdeskPath to point to your main app." -ForegroundColor Yellow
  } else {
    Write-Host "  Helpdesk → http://localhost:$HelpdeskPort" -ForegroundColor Green
    $env:WELLBEING_API_URL = "http://localhost:$MockPort"
    Start-Process powershell -ArgumentList @(
      "-NoExit",
      "-Command",
      "cd '$helpdeskFull'; `$env:WELLBEING_API_URL='http://localhost:$MockPort'; wrangler dev --port $HelpdeskPort"
    ) -WindowStyle Normal
  }
}

Start-Sleep -Seconds 4

# Open debug UI
Write-Host "`n🌐 Opening debug UI..." -ForegroundColor Cyan
$debugUrl = "http://localhost:$MockPort/debug-ui.html?mock=http://localhost:$MockPort"
Start-Process $debugUrl

Write-Host "`n📋 Quick reference:" -ForegroundColor Yellow
Write-Host "   Mock healthz:   http://localhost:$MockPort/v1/_debug/calls"
Write-Host "   Mock reset:     curl -X POST http://localhost:$MockPort/v1/_debug/reset"
Write-Host "   Mock break:     curl -X POST http://localhost:$MockPort/v1/_debug/break"
Write-Host "   Mock heal:      curl -X POST http://localhost:$MockPort/v1/_debug/heal"
Write-Host "   Debug UI:       $debugUrl"
Write-Host "`n   To stop: close the wrangler windows`n" -ForegroundColor Yellow
