$ErrorActionPreference = 'Stop'

$assetRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $assetRoot 'assets/rmc-icon-library-v1.png'
$destination = Join-Path $assetRoot 'assets/icons'
$names = @(
    'nft', 'blockchain', 'games', 'decentralized', 'metaverse', 'social-networks', 'immutable',
    'transparent', 'internet', 'wifi', 'user', 'multiplayer', 'token', 'trophy'
)

New-Item -ItemType Directory -Path $destination -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
    for ($row = 0; $row -lt 2; $row++) {
        $top = [Math]::Floor($row * $source.Height / 2)
        $bottom = [Math]::Floor(($row + 1) * $source.Height / 2)
        for ($column = 0; $column -lt 7; $column++) {
            $left = [Math]::Floor($column * $source.Width / 7)
            $right = [Math]::Floor(($column + 1) * $source.Width / 7)
            $icon = New-Object System.Drawing.Bitmap ($right - $left), ($bottom - $top), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($icon)
                try {
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $icon.Width, $icon.Height), (New-Object System.Drawing.Rectangle $left, $top, $icon.Width, $icon.Height), [System.Drawing.GraphicsUnit]::Pixel)
                }
                finally {
                    $graphics.Dispose()
                }
                $index = $row * 7 + $column
                $icon.Save((Join-Path $destination ($names[$index] + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $icon.Dispose()
            }
        }
    }
}
finally {
    $source.Dispose()
}
