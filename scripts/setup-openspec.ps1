$ErrorActionPreference = 'Stop'
$previousAppData = $env:APPDATA
$previousTelemetry = $env:OPENSPEC_TELEMETRY
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $env:APPDATA = Join-Path (Get-Location) '.setup/appdata'
    $env:OPENSPEC_TELEMETRY = '0'
    openspec config set profile custom
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure OpenSpec profile.' }
    openspec config set workflows '["propose","explore","apply","update","sync","archive","new","continue","ff","verify","bulk-archive","onboard"]'
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure OpenSpec workflows.' }
    openspec init --tools codex --profile custom --no-animation
    if ($LASTEXITCODE -ne 0) { throw 'Could not install OpenSpec workflows.' }
} finally {
    $env:APPDATA = $previousAppData
    $env:OPENSPEC_TELEMETRY = $previousTelemetry
    Pop-Location
}
