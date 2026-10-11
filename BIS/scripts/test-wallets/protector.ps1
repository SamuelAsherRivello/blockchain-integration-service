param(
  [ValidateSet('protect', 'unprotect', 'secure', 'check')][string]$Mode,
  [string]$Target
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  if (-not $IsWindows) { throw 'unsupported' }
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  if ($Mode -eq 'secure' -or $Mode -eq 'check') {
    $item = Get-Item -LiteralPath $Target -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'reparse' }
    if ($Mode -eq 'secure') {
      if (-not $item.PSIsContainer) { throw 'not-directory' }
      $acl = [System.Security.AccessControl.DirectorySecurity]::new()
      $acl.SetOwner($sid)
      $acl.SetAccessRuleProtection($true, $false)
      foreach ($principal in @($sid, $systemSid)) {
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
          $principal, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
      }
      Set-Acl -LiteralPath $Target -AclObject $acl
    }
    $acl = Get-Acl -LiteralPath $Target
    if ($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'owner' }
    $hasUser = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -eq 'Allow') {
        if ($rule.IdentityReference.Value -notin @($sid.Value, $systemSid.Value)) { throw 'broad-access' }
        if ($rule.IdentityReference.Value -eq $sid.Value -and
            ($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::ReadData)) { $hasUser = $true }
      }
    }
    if (-not $hasUser) { throw 'no-user' }
    [Console]::Out.Write('ok')
  } else {
    Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
    $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd())
    $entropy = [System.Text.Encoding]::UTF8.GetBytes('BIS agent-test-wallets vault v1')
    try {
      if ($Mode -eq 'protect') {
        $result = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, 'CurrentUser')
      } else {
        $result = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, 'CurrentUser')
      }
      [Console]::Out.Write([Convert]::ToBase64String($result))
    } finally {
      if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
      if ($result) { [Array]::Clear($result, 0, $result.Length) }
    }
  }
} catch {
  # Never render PowerShell's exception record, invocation line or input values.
  [Console]::Error.Write('vault-protection-unavailable')
  exit 1
}
