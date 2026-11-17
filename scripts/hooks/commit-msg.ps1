#requires -Version 7.4
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$MessageFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location -LiteralPath $repoRoot
try {
  & (Join-Path $repoRoot 'node_modules/.bin/commitlint.ps1') --edit $MessageFile
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Commit message rejected by commitlint.' -ForegroundColor Red
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}
