$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
# Console's default small synchronous buffers make large private frames spend
# seconds crossing pipes. Use bounded buffered streams, with the same JSON
# framing and a flush after each complete response.
$encoding = [System.Text.UTF8Encoding]::new($false, $true)
$originalIn = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), $encoding, $false, 65536)
$originalOut = [System.IO.StreamWriter]::new([Console]::OpenStandardOutput(), $encoding, 65536)
[Console]::SetIn($originalIn)
[Console]::SetOut($originalOut)
$helper = Join-Path $PSScriptRoot 'protector.ps1'
$maximumData = 4 * 1024 * 1024
$maximumFrame = $maximumData + 4096
$lastId = 0L
try {
  if (-not $IsWindows) { throw 'unsupported' }
  while ($null -ne ($line = $originalIn.ReadLine())) {
    $request = $null; $reader = $null; $writer = $null; $value = $null; $response = $null
    try {
      if ($line.Length -gt $maximumFrame) { throw 'frame' }
      $request = ConvertFrom-Json -InputObject $line -AsHashtable -Depth 4
      if ($request -isnot [System.Collections.IDictionary] -or $request.Count -ne 4 -or
          @($request.Keys | Where-Object { $_ -notin @('id', 'mode', 'target', 'data') }).Count -ne 0 -or
          ($request.id -isnot [long] -and $request.id -isnot [int])) { throw 'request' }
      $id = [long]$request.id
      if ($id -le $lastId -or $id -gt 9007199254740991L -or $request.mode -notin @('protect', 'unprotect', 'secure', 'check')) { throw 'request' }
      $lastId = $id
      if ($request.mode -in @('secure', 'check')) {
        if ($request.target -isnot [string] -or -not $request.target -or $request.target.Length -gt 32767 -or
            $request.target.Contains([char]0) -or $null -ne $request.data) { throw 'request' }
        $payload = ''
      } else {
        if ($null -ne $request.target -or $request.data -isnot [string] -or $request.data.Length -gt $maximumData -or
            $request.data -cnotmatch '^[A-Za-z0-9+/]*={0,2}$') { throw 'request' }
        $payload = $request.data
      }
      $reader = [System.IO.StringReader]::new($payload)
      $writer = [System.IO.StringWriter]::new([System.Globalization.CultureInfo]::InvariantCulture)
      [Console]::SetIn($reader); [Console]::SetOut($writer)
      $global:LASTEXITCODE = 0
      try {
        # Invoke the unchanged DPAPI/ACL helper in this runspace, never another process.
        & $helper -Mode $request.mode -Target $request.target | Out-Null
        if (-not $? -or $LASTEXITCODE -ne 0) { throw 'helper' }
      } finally {
        [Console]::SetIn($originalIn); [Console]::SetOut($originalOut)
      }
      $value = $writer.ToString()
      if ($request.mode -in @('secure', 'check')) {
        if ($value -cne 'ok') { throw 'response' }
      } elseif ($value.Length -gt $maximumData -or $value -cnotmatch '^[A-Za-z0-9+/]+={0,2}$') { throw 'response' }
      # Both fields have already been constrained to a positive integer and
      # canonical Base64 or "ok". Neither can contain a JSON metacharacter.
      # Avoid PowerShell's object serializer scanning multi-megabyte strings.
      $response = '{"id":' + $id.ToString([System.Globalization.CultureInfo]::InvariantCulture) + ',"value":"' + $value + '"}'
      if ([System.Text.Encoding]::UTF8.GetByteCount($response) -gt $maximumFrame) { throw 'frame' }
      $originalOut.WriteLine($response); $originalOut.Flush()
    } finally {
      [Console]::SetIn($originalIn); [Console]::SetOut($originalOut)
      if ($reader) { $reader.Dispose() }; if ($writer) { $writer.Dispose() }
      # No request, plaintext result or vault document is retained between calls.
      $line = $null; $payload = $null; $request = $null; $value = $null; $response = $null
      $reader = $null; $writer = $null
    }
  }
} catch {
  [Console]::Error.Write('vault-protection-unavailable')
  exit 1
} finally {
  [Console]::SetIn($originalIn); [Console]::SetOut($originalOut)
}
