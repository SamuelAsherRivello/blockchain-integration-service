# Enter the wallet locally. Never place a phrase in a command argument or file.
$ErrorActionPreference = 'Stop'
$probeRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$probeSecret = Read-Host 'Enter the funded Signet wallet recovery phrase (hidden)' -AsSecureString
try {
    $probeStart = [System.Diagnostics.ProcessStartInfo]::new()
    $probeStart.FileName = (Get-Command node -CommandType Application).Source
    $probeStart.WorkingDirectory = $probeRoot
    $probeStart.UseShellExecute = $false
    $probeStart.RedirectStandardInput = $true
    $probeStart.ArgumentList.Add((Join-Path $PSScriptRoot 'probe-lto-contract.mjs'))
    $probeStart.ArgumentList.Add('--funded-stdin')
    $probeProcess = [System.Diagnostics.Process]::Start($probeStart)
    try {
        # This value travels only through an anonymous process pipe, never stdout.
        $probeProcess.StandardInput.WriteLine((ConvertFrom-SecureString $probeSecret -AsPlainText))
        $probeProcess.StandardInput.Close()
        $probeProcess.WaitForExit()
        $probeExit = $probeProcess.ExitCode
    } finally { $probeProcess.Dispose() }
} finally { $probeSecret.Dispose() }
exit $probeExit
