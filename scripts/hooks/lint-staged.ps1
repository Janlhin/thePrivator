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
  $bin = Join-Path $repoRoot 'node_modules/.bin'

  $staged = @($Paths | Where-Object { Test-Path -LiteralPath $_ })
  if ($staged.Count -eq 0) {
    # lint-staged passes no paths when the diff touched nothing it tracks.
    return
  }

  $code = @($staged | Where-Object { $_ -match '\.(ts|tsx)$' })
  if ($code.Count -gt 0) {
    & (Join-Path $bin 'oxlint.ps1') @code --fix --deny-warnings
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  $css = @($staged | Where-Object { $_ -match '\.css$' })
  if ($css.Count -gt 0) {
    & (Join-Path $bin 'stylelint.ps1') @css --fix
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  # Markdown is deliberately left alone: oxfmt reflows prose and mangles CJK text.
  $formattable = @($staged | Where-Object { $_ -match '\.(ts|tsx|css|json|yml|yaml)$' })
  if ($formattable.Count -gt 0) {
    & $node (Join-Path $repoRoot 'node_modules/vite-plus/dist/bin.js') fmt @formattable
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
finally {
  Pop-Location
}
