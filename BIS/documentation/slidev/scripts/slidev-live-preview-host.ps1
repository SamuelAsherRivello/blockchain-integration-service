[CmdletBinding()]
param(
  [ValidateRange(1, 168)]
  [int]$DurationHours = 12,
  [ValidateRange(5, 300)]
  [int]$HealthCheckSeconds = 10
)

# Task Scheduler runs this adapter without a visible console. The runtime
# itself remains Node so process ownership, status, and browser tooling are
# identical to an in-app terminal invocation.
$slidevRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $slidevRoot
& 'C:\Program Files\nodejs\node.exe' 'scripts\slidev-live-preview.mjs' start --duration-hours $DurationHours --health-check-seconds $HealthCheckSeconds
exit $LASTEXITCODE
