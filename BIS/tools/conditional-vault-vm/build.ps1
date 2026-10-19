$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$upstream = Join-Path $repository 'output/tools/conditional-vault/emulator'
$commit = 'bd17836542c409d176a3ee61782e00a606d10f6c'
if (-not (Test-Path -LiteralPath $upstream)) {
  New-Item -ItemType Directory -Force (Split-Path $upstream) | Out-Null
  git clone https://github.com/arkade-os/emulator $upstream
  if ($LASTEXITCODE -ne 0) { throw 'Upstream clone failed' }
  git -C $upstream checkout --detach $commit
  if ($LASTEXITCODE -ne 0) { throw 'Upstream revision selection failed' }
}
if ((git -C $upstream rev-parse HEAD) -ne $commit) { throw 'Unexpected upstream revision' }
git -C $upstream diff --exit-code HEAD -- pkg api-spec internal go.mod go.sum
if ($LASTEXITCODE -ne 0) { throw 'Upstream contract execution sources are modified' }
$destination = Join-Path $upstream 'cmd/bis-vault-vm'
New-Item -ItemType Directory -Force $destination | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'main.go') -Destination (Join-Path $destination 'main.go')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'clock-fixture_test.go') -Destination (Join-Path $upstream 'pkg/arkade/bis_clock_fixture_test.go')
Push-Location $upstream
try {
  go build -o conditional-vault-vm.exe ./cmd/bis-vault-vm
  if ($LASTEXITCODE -ne 0) { throw 'VM runner build failed' }
} finally { Pop-Location }
Push-Location (Join-Path $upstream 'pkg/arkade')
try {
  go test -c -o ../../conditional-vault-vm-clock.exe .
  if ($LASTEXITCODE -ne 0) { throw 'VM clock test build failed' }
} finally { Pop-Location }
