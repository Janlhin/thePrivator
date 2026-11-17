#requires -Version 7.4
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Paths
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location -LiteralPath $repoRoot
try {
  $node = (Get-Command node -ErrorAction Stop).Source
  $vp = Join-Path $repoRoot 'node_modules/vite-plus/dist/bin.js'

  $targets = @($Paths | Where-Object { Test-Path -LiteralPath $_ } | Where-Object { $_ -notmatch '[\\/]tmp[\\/]' })
  if ($targets.Count -eq 0) {
    Write-Host 'format: nothing to do'
    return
  }

  & $node $vp fmt @targets
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & (Join-Path $repoRoot 'node_modules/.bin/stylelint.ps1') ($targets | Where-Object { $_ -match '\.css$' }) --fix
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host 'format: done' -ForegroundColor Green
}
finally {
  Pop-Location
}
