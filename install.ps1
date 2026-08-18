# One-click: copy the article-editor preset, then add this bundle to a DSH profile.
# Usage:
#   .\install.ps1
#   .\install.ps1 -Profile headless
#   .\install.ps1 -Harness C:\path\to\deepseek-harness
param(
  [string]$Profile = 'web',
  [string]$Harness = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$presetSrc = Join-Path $Root 'presets\article-editor'
$presetDst = Join-Path $env:USERPROFILE '.dsh\.agent-presets\article-editor'
New-Item -ItemType Directory -Force -Path (Split-Path $presetDst) | Out-Null
Copy-Item -Recurse -Force $presetSrc $presetDst
Write-Host "Preset copied to $presetDst"

$addArgs = @('plugin', '--profile', $Profile, 'add', $Root)
if ($Harness -and (Test-Path (Join-Path $Harness 'package.json'))) {
  Push-Location $Harness
  try {
    pnpm dsh @addArgs
  } finally {
    Pop-Location
  }
} elseif (Get-Command dsh -ErrorAction SilentlyContinue) {
  & dsh @addArgs
} else {
  Write-Host ""
  Write-Host "dsh is not on PATH. Either:"
  Write-Host "  1. Install the DeepSeek Harness CLI, then rerun this script"
  Write-Host "  2. From a harness checkout:  .\install.ps1 -Harness C:\path\to\deepseek-harness"
  Write-Host ""
  Write-Host "Manual equivalent:"
  Write-Host "  dsh plugin --profile $Profile add `"$Root`""
  exit 2
}

Write-Host ""
Write-Host "Installed into profile '$Profile'."
Write-Host "Web:      dsh --profile web     then pick preset  article-editor"
Write-Host "Headless: dsh --profile headless --preset article-editor `"your topic`""
Write-Host ""
Write-Host "If the editor still runs as ReAct, the host is missing the AgentLoop"
Write-Host "driver hook. See patches/agent-loop-prepare.snippet.ts"
