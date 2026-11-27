#requires -Version 7.4
[CmdletBinding()]
param()

# T-019: root-level whitelist check.
#
# The whitelist is parsed from the "Top-level layout" table in README.md; it
# is not a second hard-coded list. Every backtick token in the first table cell
# becomes a registered entry:
#   - a token containing "/" is a directory prefix (e.g. `src/`);
#   - a token without "/" is an exact file match at the repository root.
#
# Root-level means a path tracked by `git ls-files` that contains no "/". Each
# such path must match a registered file token. Directory-prefix tokens cannot
# match a root-level file, so nothing at the root can hide under a subtree
# entry. Unregistered paths are printed and the script exits non-zero.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repoRoot
try {
  $readmePath = Join-Path $repoRoot 'README.md'
  $readmeLines = [IO.File]::ReadAllLines($readmePath)

  $inSection = $false
  $tokens = New-Object System.Collections.Generic.List[string]
  foreach ($line in $readmeLines) {
    if ($line -match '^###\s+Top-level layout\b') { $inSection = $true; continue }
    if ($inSection -and $line -match '^#{2,4}\s+') { break }
    if (-not $inSection) { continue }
    if ($line -notmatch '^\|') { continue }
    if ($line -match '^\|\s*Path\s*\|') { continue }
    if ($line -match '^\|\s*:?-{3,}:?\s*\|') { continue }

    $cells = $line -split '\|'
    $pathCell = if ($cells.Count -ge 2) { $cells[1].Trim() } else { '' }
    $tokenMatches = [regex]::Matches($pathCell, '`([^`]+)`')
    foreach ($tokenMatch in $tokenMatches) {
      $tokens.Add($tokenMatch.Groups[1].Value.Trim())
    }
  }

  $registeredFiles = @($tokens | Where-Object { $_ -notmatch '/' } | Sort-Object -Unique)
  $rootFiles = @(& git ls-files | Where-Object { $_ -notmatch '/' } | Sort-Object -Unique)
  $unregistered = @($rootFiles | Where-Object { $registeredFiles -notcontains $_ })

  Write-Host "README whitelist: $($registeredFiles.Count) root-level file entries"
  Write-Host "Tracked root-level paths: $($rootFiles.Count)"
  if ($unregistered.Count -eq 0) {
    Write-Host "root whitelist: all $($rootFiles.Count) root-level paths are registered" -ForegroundColor Green
    exit 0
  }

  Write-Host "root whitelist: $($unregistered.Count) root-level paths are NOT registered:" -ForegroundColor Red
  foreach ($entry in $unregistered) { Write-Host "  - $entry" -ForegroundColor Red }
  exit 1
}
finally {
  Pop-Location
}
