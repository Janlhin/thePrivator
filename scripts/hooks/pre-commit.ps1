#requires -Version 7.4
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location -LiteralPath $repoRoot
try {
  $bin = Join-Path $repoRoot 'node_modules/.bin'
  $pwsh = (Get-Command pwsh -ErrorAction Stop).Source

  & (Join-Path $bin 'lint-staged.ps1')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & $pwsh -NoLogo -NoProfile -File 'scripts/verify.ps1' -Only typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # Generated artefacts must already be committed; regenerate and prove the tree
  # is unchanged. The pathspec is narrowed to the generated tree on purpose.
  if (Test-Path -LiteralPath 'scripts/docs-sync.ps1') {
    & $pwsh -NoLogo -NoProfile -File 'scripts/docs-sync.ps1'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git diff --exit-code -- docs/generated
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Generated docs are stale: run npm run docs:sync and commit the result.' -ForegroundColor Red
      exit 1
    }
  }
}
finally {
  Pop-Location
}
