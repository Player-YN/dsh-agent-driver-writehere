# Render README images from the HTML sources (Chrome headless).
$ErrorActionPreference = 'Stop'
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome or Edge not found' }

$docs = $PSScriptRoot
$jobs = @(
  @{ name = 'banner-en.png'; file = 'banner-en.html'; w = 1280; h = 640; scale = 2 }
  @{ name = 'banner-zh.png'; file = 'banner-zh.html'; w = 1280; h = 640; scale = 2 }
  @{ name = 'og.png'; file = 'banner-en.html'; w = 1280; h = 640; scale = 1 }
  @{ name = 'loop.png'; file = 'loop.html'; w = 1200; h = 340; scale = 2 }
  @{ name = 'card-tree.png'; file = 'card-tree.html'; w = 1440; h = 900; scale = 2 }
)
foreach ($j in $jobs) {
  $url = 'file:///' + (Join-Path $docs $j.file).Replace('\', '/')
  $out = Join-Path $docs $j.name
  $userData = Join-Path $env:TEMP ('dsh-wh-chrome-' + $j.name)
  New-Item -ItemType Directory -Force -Path $userData | Out-Null
  & $chrome --headless=new --disable-gpu --hide-scrollbars `
    --force-device-scale-factor=$($j.scale) --window-size="$($j.w),$($j.h)" `
    --user-data-dir=$userData --screenshot=$out $url
  if ($LASTEXITCODE -ne 0) { throw "render failed: $($j.name)" }
  Write-Host "wrote $out"
}
