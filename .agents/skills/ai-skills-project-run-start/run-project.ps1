[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $ProjectRoot,
  [Parameter(Mandatory)] [int] $Port,
  [Parameter(Mandatory)] [string] $RoutesJson,
  [switch] $DisableHmr,
  [int] $PortCount = 20,
  [int] $StartupTimeoutSeconds = 15
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
$routes = $RoutesJson | ConvertFrom-Json

function Get-OwnedProcesses {
  Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.Name -in @('node.exe','npm.exe','cmd.exe') -and $_.CommandLine -and
    $_.CommandLine -like "*$root*"
  }
}
function Get-LogText([string] $path) {
  if (-not (Test-Path -LiteralPath $path)) { return '' }
  $text = Get-Content -Raw -LiteralPath $path -ErrorAction SilentlyContinue
  if ($null -eq $text) { return '' }
  return $text.Trim()
}
function Get-ListeningPids([int] $port) {
  try {
    return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess)
  } catch {
    $netstatLines = @(netstat.exe -ano -p tcp 2>$null | Select-String "LISTENING\s+$port\s*$")
    return @($netstatLines | ForEach-Object { if ($_.Line -match '\s+(\d+)\s*$') { [int]$Matches[1] } })
  }
}

$canInspectProcesses = $true
try { $owned = @(Get-OwnedProcesses) } catch { $canInspectProcesses = $false; $owned = @() }
if ($canInspectProcesses) {
  foreach ($process in $owned) {
    if ($process.ProcessId -and ([int]$process.ProcessId -gt 0)) {
      & taskkill.exe /PID ([int]$process.ProcessId) /T /F | Out-Null
    }
  }
  # Process-tree termination is asynchronous on Windows. Wait until the
  # project-owned launcher processes are actually gone before probing ports;
  # otherwise a stale Vite child can win the cleanup-to-launch race and make
  # the fresh strict-port launch report EADDRINUSE.
  $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(3)
  do {
    $remaining = @(Get-OwnedProcesses)
    if ($remaining.Count -eq 0) { break }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $cleanupDeadline)
  # If the final ownership scan is temporarily unavailable, continue with
  # strict-port launch attempts; never turn an inspection limitation into a
  # startup failure.
}

$candidate = $Port
$reuse = $false
do {
  $listener = @(Get-ListeningPids $candidate)
  if (-not $listener) { break }
  if (-not $canInspectProcesses) {
    $reuse = $true
    foreach ($route in $routes) {
      try { Invoke-WebRequest "http://127.0.0.1:$candidate$($route.route)" -UseBasicParsing -TimeoutSec 1 | Out-Null }
      catch { $reuse = $false; break }
    }
    if ($reuse) { break }
  }
  $candidate++
  Start-Sleep -Milliseconds 25
} while ($candidate -lt ($Port + $PortCount))
if ($listener -and $candidate -ge ($Port + $PortCount)) { throw "No free project port found from $Port through $($Port + $PortCount - 1)." }

$faucetCandidate = 5190
while ($faucetCandidate -eq $candidate -or @(Get-ListeningPids $faucetCandidate).Count -gt 0) {
  $faucetCandidate++
}

if (-not $reuse) {
  # Use strictPort so Vite cannot silently move to a different port than the
  # one selected by this helper. This also works when listener inspection is
  # restricted but the port is occupied by another process.
  $launchSucceeded = $false
  $logDirectory = Join-Path $root 'output/logs/project-run-start'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  while ($candidate -lt ($Port + $PortCount)) {
    $logPath = Join-Path $logDirectory ("codex-vite-" + $candidate + '-' + [guid]::NewGuid().ToString('N') + '.log')
    $hmrArgument = if ($DisableHmr) { ' --no-hmr' } else { '' }
    $child = Start-Process cmd.exe -ArgumentList "/d /c cd /d `"$root`" && npm run dev -- --host 127.0.0.1 --port $candidate --faucetPort $faucetCandidate --strictPort$hmrArgument > `"$logPath`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden -PassThru
    $startupDeadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
    do {
      $listener = @(Get-ListeningPids $candidate)
      $diagnostics = Get-LogText $logPath
      # An existing listener may belong to another project. Only this launch's
      # own Vite-ready output proves that the selected port is ours.
      if ($listener -or $diagnostics -match 'Project run mode:') { $launchSucceeded = $true; break }
      if ($child.HasExited) { break }
      Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $startupDeadline)
    if ($launchSucceeded) { break }
    if (-not $child.HasExited -and $child.ProcessId -and ([int]$child.ProcessId -gt 0)) {
      & taskkill.exe /PID ([int]$child.ProcessId) /T /F | Out-Null
    }
    $diagnostics = Get-LogText $logPath
    if ($diagnostics -match "Port $candidate .*in use|EADDRINUSE|strictPort") { $candidate++; continue }
    throw "Vite launcher failed on $candidate with code $($child.ExitCode). $diagnostics"
  }
  if (-not $launchSucceeded) { throw "No available project port found from $Port through $($Port + $PortCount - 1)." }
}

$checks = foreach ($route in $routes) {
  try {
    $response = Invoke-WebRequest "http://127.0.0.1:$candidate$($route.route)" -UseBasicParsing -TimeoutSec 2
    $title = if ($response.Content -match '<title[^>]*>\s*([^<]+?)\s*</title>') { $matches[1].Trim() } else { '' }
    [pscustomobject]@{ Label=$route.label; Route=$route.route; Status=$response.StatusCode; Title=$title; Url="http://127.0.0.1:$candidate$($route.route)" }
  } catch {
    [pscustomobject]@{ Label=$route.label; Route=$route.route; Status='host-verification-pending'; Title=''; Url="http://127.0.0.1:$candidate$($route.route)" }
  }
}
$checks | ConvertTo-Json -Compress
