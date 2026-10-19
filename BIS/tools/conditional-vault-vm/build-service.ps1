$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source = Join-Path $repository 'output/tools/conditional-vault/emulator'
$commit = 'bd17836542c409d176a3ee61782e00a606d10f6c'
$image = 'bis-conditional-vault-emulator:bd17836542c4'
& (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Pinned upstream setup failed' }
# Never replace an existing funded service's image or key automatically.
$installed = docker image ls --quiet $image
if ($LASTEXITCODE -ne 0) { throw 'Docker unavailable' }
if ($installed) {
  docker image inspect --format '{{.Id}}' $image
  Write-Output 'Existing service image retained. Rebuilding/upgrading requires explicit operator migration.'
  exit 0
}
docker build --build-arg "VERSION=$commit" --build-arg TARGETOS=linux --build-arg TARGETARCH=amd64 --label "org.opencontainers.image.revision=$commit" --tag $image $source
if ($LASTEXITCODE -ne 0) { throw 'Service image build failed' }
docker image inspect --format '{{.Id}}' $image
if ($LASTEXITCODE -ne 0) { throw 'Built image identity unavailable' }
