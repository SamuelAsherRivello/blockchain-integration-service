[CmdletBinding()]
param(
  [ValidateRange(1, 168)]
  [int]$DurationHours = 12,
  [ValidateRange(5, 300)]
  [int]$HealthCheckSeconds = 30
)

$ErrorActionPreference = 'Stop'

$slidevRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $slidevRoot '..\..\..')).Path
$logDirectory = Join-Path $repositoryRoot 'output\logs\slidev-landing\stable'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$services = @(
  @{ Name = 'seriph'; Script = 'dev:seriph'; Port = 3042; Path = '/slidev/seriph/1' },
  @{ Name = 'apple-basic'; Script = 'dev:apple-basic'; Port = 3043; Path = '/slidev/apple-basic/1' },
  @{ Name = 'dracula'; Script = 'dev:dracula'; Port = 3044; Path = '/slidev/dracula/1' },
  @{ Name = 'template'; Script = 'dev:template'; Port = 3045; Path = '/slidev/template/1' },
  @{ Name = 'modrian-template-1'; Script = 'dev:modrian-template-1'; Port = 3046; Path = '/slidev/modrian-template-1/1' },
  @{ Name = 'modrian-template-2'; Script = 'dev:modrian-template-2'; Port = 3047; Path = '/slidev/modrian-template-2/1' },
  @{ Name = 'modrian-template-3'; Script = 'dev:modrian-template-3'; Port = 3048; Path = '/slidev/modrian-template-3/1' },
  @{ Name = 'modrian-template'; Script = 'dev:modrian-template'; Port = 3049; Path = '/slidev/modrian-template/1' },
  @{ Name = 'blockchain-for-game-designers'; Script = 'dev:blockchain-for-game-designers'; Port = 3051; Path = '/slidev/blockchain-for-game-designers/1' },
  @{ Name = 'bitcoin-for-games'; Script = 'dev:bitcoin-for-games'; Port = 3056; Path = '/slidev/bitcoin-for-games/1' },
  @{ Name = 'outro'; Script = 'dev:outro'; Port = 3052; Path = '/slidev/outro/1' },
  @{ Name = 'landing'; Script = 'dev'; Port = 3032; Path = '/' }
)

function Write-SupervisorLog([string]$Message) {
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath (Join-Path $logDirectory 'supervisor.log') -Value $line
  Write-Host $line
}

function Test-PreviewRoute([int]$Port, [string]$Path) {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port$Path" -UseBasicParsing -TimeoutSec 10
    return $response.StatusCode -eq 200 -and $response.Content -match 'Slidev|slidev'
  }
  catch {
    return $false
  }
}

function Get-LandingLinkPaths {
  $response = Invoke-WebRequest -Uri 'http://localhost:3032/' -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'Slidev Presentations') {
    throw 'The landing page did not return the expected document.'
  }

  $paths = @(
    $response.Links |
      ForEach-Object href |
      Where-Object { $_ -is [string] -and $_.StartsWith('/') } |
      ForEach-Object { $_.Split('#')[0].Split('?')[0] } |
      Where-Object { $_ } |
      Sort-Object -Unique
  )

  if ($paths.Count -eq 0) {
    throw 'The landing page exposes no local preview links.'
  }

  return $paths
}

function Stop-ExpectedListener([hashtable]$Service) {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $Service.Port -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($null -ne $process -and $process.CommandLine -like "*$slidevRoot*" -and $process.CommandLine -match "--port\s+$($Service.Port)(\s|$)") {
      Write-SupervisorLog "Stopping unhealthy $($Service.Name) listener process $($listener.OwningProcess)."
      Stop-Process -Id $listener.OwningProcess -Force
    }
    elseif ($null -ne $process) {
      Write-SupervisorLog "Port $($Service.Port) is held by an unrelated process $($listener.OwningProcess); leaving it untouched."
    }
  }
}

function Start-PreviewService([hashtable]$Service) {
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdout = Join-Path $logDirectory "$($Service.Name)-$timestamp.stdout.log"
  $stderr = Join-Path $logDirectory "$($Service.Name)-$timestamp.stderr.log"
  Write-SupervisorLog "Starting $($Service.Name) with npm run $($Service.Script)."
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', $Service.Script -WorkingDirectory $slidevRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden | Out-Null
}

function Ensure-PreviewService([hashtable]$Service) {
  if (Test-PreviewRoute $Service.Port $Service.Path) {
    return $true
  }

  Stop-ExpectedListener $Service
  Start-PreviewService $Service

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 2
    if (Test-PreviewRoute $Service.Port $Service.Path) {
      Write-SupervisorLog "$($Service.Name) became healthy after $attempt check(s)."
      return $true
    }
  }

  Write-SupervisorLog "$($Service.Name) did not become healthy; it will be retried on the next health cycle."
  return $false
}

$deadline = (Get-Date).AddHours($DurationHours)
Write-SupervisorLog "Stable Slidev preview supervisor started; deadline: $($deadline.ToString('o'))."

while ((Get-Date) -lt $deadline) {
  # The landing page is the editing entry point. Check it first so one slow
  # template recovery cannot leave the editor unavailable for an entire sweep.
  [void](Ensure-PreviewService ($services | Where-Object Name -eq 'landing'))

  # Recover the independently served templates and decks after the entry point
  # is available. A failed deck must not delay the landing-server restart.
  foreach ($service in $services | Where-Object Name -ne 'landing') {
    [void](Ensure-PreviewService $service)
  }

  # A launcher process can fail while a deck was being recovered; make the
  # second check before exercising the shared-origin proxy routes.
  [void](Ensure-PreviewService ($services | Where-Object Name -eq 'landing'))

  # Confirm the launcher can proxy every declared preview route.
  foreach ($service in $services | Where-Object Name -ne 'landing') {
    if (-not (Test-PreviewRoute 3032 $service.Path)) {
      Write-SupervisorLog "Launcher proxy check failed for $($service.Name); it will be re-evaluated next cycle."
    }
  }

  # Treat the landing page as the source of truth for its current local links.
  try {
    foreach ($path in Get-LandingLinkPaths) {
      if (-not (Test-PreviewRoute 3032 $path)) {
        Write-SupervisorLog "Landing-page link check failed for $path; it will be re-evaluated next cycle."
      }
    }
  }
  catch {
    Write-SupervisorLog "Landing-page link discovery failed: $($_.Exception.Message)"
  }

  Write-SupervisorLog 'Health cycle completed.'
  Start-Sleep -Seconds $HealthCheckSeconds
}

Write-SupervisorLog 'Stable Slidev preview supervisor reached its configured duration and is stopping.'
