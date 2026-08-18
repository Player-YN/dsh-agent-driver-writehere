# Remote one-liner (after this repo is on GitHub):
#   irm https://raw.githubusercontent.com/Player-YN/dsh-agent-driver-writehere/main/install-remote.ps1 | iex
#
# Override the source:
#   $env:WRITEHERE_PLUGIN = 'github:Player-YN/dsh-agent-driver-writehere'
#   $env:WRITEHERE_PROFILE = 'web'
#
# This script only calls the official `dsh plugin add` (pnpm inside the profile),
# then copies the shipped article-editor preset. It is not a second loader.

$ErrorActionPreference = 'Stop'
$Spec = $env:WRITEHERE_PLUGIN
if (-not $Spec) { $Spec = 'github:Player-YN/dsh-agent-driver-writehere' }
$Profile = $env:WRITEHERE_PROFILE
if (-not $Profile) { $Profile = 'web' }

if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
  Write-Host "dsh is not on PATH. Install DeepSeek Harness first, then rerun."
  exit 2
}

Write-Host "dsh plugin --profile $Profile add $Spec"
& dsh plugin --profile $Profile add $Spec
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$pkg = Join-Path $homeDir "profiles\$Profile\node_modules\dsh-agent-driver-writehere"
$presetSrc = Join-Path $pkg 'presets\article-editor'
$presetDst = Join-Path $homeDir '.agent-presets\article-editor'
if (Test-Path $presetSrc) {
  New-Item -ItemType Directory -Force -Path (Split-Path $presetDst) | Out-Null
  Copy-Item -Recurse -Force $presetSrc $presetDst
  Write-Host "Preset copied to $presetDst"
} else {
  Write-Host "Plugin installed; copy presets/article-editor to $presetDst if the editor preset is missing."
}

Write-Host "Done. Start: dsh --profile $Profile   then pick article-editor"
