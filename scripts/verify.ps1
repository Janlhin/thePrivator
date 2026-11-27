#requires -Version 7.4
[CmdletBinding()]
param(
  [ValidateSet('all', 'format', 'lint', 'stylelint', 'typecheck', 'test', 'deadcode', 'dupes', 'docs')]
  [string]$Only = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Manual $LASTEXITCODE checks below are the single source of truth for failures.
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repoRoot
try {
  $node = (Get-Command node -ErrorAction Stop).Source
  $vp = Join-Path $repoRoot 'node_modules/vite-plus/dist/bin.js'
  $bin = Join-Path $repoRoot 'node_modules/.bin'

  function Invoke-Step {
    param(
      [string]$Name,
      [scriptblock]$Body
    )
    if ($Only -ne 'all' -and $Only -ne $Name) { return }
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Body
    if ($LASTEXITCODE -ne 0) {
      Write-Host "verify failed at '$Name' (exit $LASTEXITCODE)" -ForegroundColor Red
      Pop-Location
      exit $LASTEXITCODE
    }
  }

  # Cheapest checks first, so a style or type slip fails in seconds rather than
  # after the whole suite has run.
  Invoke-Step 'format' { & $node $vp fmt src tests scripts --check }
  Invoke-Step 'lint' { & (Join-Path $bin 'oxlint.ps1') src --deny-warnings }
  Invoke-Step 'stylelint' { & (Join-Path $bin 'stylelint.ps1') 'src/**/*.css' }
  Invoke-Step 'typecheck' { & (Join-Path $bin 'tsc.ps1') --noEmit }
  Invoke-Step 'test' { & $node $vp test --coverage }
  Invoke-Step 'deadcode' { & (Join-Path $bin 'knip.ps1') }
  Invoke-Step 'dupes' { & (Join-Path $bin 'jscpd.ps1') src }
  Invoke-Step 'docs' { & $node (Join-Path $PSScriptRoot 'docs-verify.mjs') all }

  Write-Host 'verify passed' -ForegroundColor Green
}
finally {
  Pop-Location
}
