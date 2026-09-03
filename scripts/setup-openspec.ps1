$ErrorActionPreference = 'Stop'
$previousAppData = $env:APPDATA
$previousTelemetry = $env:OPENSPEC_TELEMETRY
Push-Location (Join-Path $PSScriptRoot '..')
try {
    # The tracked directory is .openspec; the stock CLI still discovers openspec.
    $projectRoot = (Get-Location).Path
    $specRoot = Join-Path $projectRoot '.openspec'
    $compatibilityPath = Join-Path $projectRoot 'openspec'
    if (!(Test-Path -LiteralPath $specRoot -PathType Container)) {
        throw 'Expected the tracked .openspec directory. No directories were moved.'
    }
    $existingLink = Get-Item -LiteralPath $compatibilityPath -Force -ErrorAction SilentlyContinue
    if ($existingLink) {
        if ($existingLink.LinkType -notin @('Junction', 'SymbolicLink')) {
            throw 'openspec already exists as a real directory. Refusing to overwrite it.'
        }
        $resolvedTarget = $existingLink.ResolveLinkTarget($true)
        if (!$resolvedTarget -or $resolvedTarget.FullName -ne $specRoot) {
            throw 'openspec points somewhere other than this project''s .openspec directory.'
        }
    } elseif ($IsWindows) {
        New-Item -ItemType Junction -Path $compatibilityPath -Target $specRoot | Out-Null
    } else {
        New-Item -ItemType SymbolicLink -Path $compatibilityPath -Target '.openspec' | Out-Null
    }
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
