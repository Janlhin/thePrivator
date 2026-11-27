#requires -Version 7.4
[CmdletBinding()]
param()

# T-020: script baseline check.
#
# Three machine-decidable counts, all over Git-tracked files only (vendored
# trees such as node_modules are not tracked and are excluded anyway):
#
# 1. Windows command scripts: tracked files ending in `.cmd` or `.bat`.
#    Count must be 0 (D-003: pwsh only, no `.cmd`/`.bat`).
#
# 2. Forbidden shell hosts in own code: tracked files outside `node_modules/`,
#    `dist/`, `.venv/`, `tmp/` that invoke `cmd.exe`/`cmd /c`/`cmd /k` or the
#    Windows PowerShell host `powershell.exe`. Markdown files quote the
#    prohibition itself (AGENTS.md/DECISIONS.md/TASKS.md/README.md); those are
#    documentation mentions, not invocations, so the host regex scans code and
#    config files only. Comment lines (`# ...`) are skipped: prose describing
#    the prohibition is not a host call either.
#
# 3. pwsh -File entry convention:
#    - every own `.ps1` referenced from `package.json` (scripts and
#      lint-staged) must be launched via `pwsh ... -File`;
#    - every tracked `.husky/*` hook must be an `exec pwsh ... -File ...` line
#      and must not call `sh`/`bash`/`cmd` directly;
#    - every own `.ps1` that invokes another own `.ps1` (outside the
#      `node_modules/.bin` vendor shims) must go through `pwsh`/`$pwsh` with
#      `-File`. Comment lines and a `\.ps1` token inside a regex literal are
#      not launch references.
#    CI workflow `shell:` settings are owned by T-011 and are not counted here.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repoRoot
try {
  $tracked = @(& git ls-files)

  # --- Count 1: tracked `.cmd` / `.bat` files ----------------------------
  $cmdBat = @($tracked | Where-Object { $_ -match '\.(cmd|bat)$' })

  # --- Count 2: forbidden shell hosts in own code ------------------------
  $ownFiles = @($tracked | Where-Object {
    $_ -notmatch '^(node_modules|dist|\.venv|tmp)/' -and
    $_ -notmatch '\.md$'
  })

  # Only real shell-host invocations count: `cmd.exe`, `cmd /c`, `cmd /k`, or
  # `powershell.exe`. A Python/JS local variable or dict key named `cmd` is
  # not a shell call and must not match.
  $cmdExePattern = '(?i)(?<![\w-])cmd\.exe(?![\w])'
  $cmdFlagPattern = '(?i)(?<![\w-])cmd\s+/[ck]\b'
  $psHostPattern = '(?i)powershell\.exe(?![\w])'
  $forbidden = New-Object System.Collections.Generic.List[string]
  foreach ($file in $ownFiles) {
    $lines = [IO.File]::ReadAllLines((Join-Path $repoRoot $file))
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i].TrimStart().StartsWith('#')) { continue }
      if ($lines[$i] -match $cmdExePattern -or $lines[$i] -match $cmdFlagPattern -or $lines[$i] -match $psHostPattern) {
        $forbidden.Add("${file}:$($i + 1)")
      }
    }
  }

  # --- Count 3: pwsh -File entry convention -----------------------------
  $entryViolations = New-Object System.Collections.Generic.List[string]

  $pkg = Get-Content (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
  foreach ($prop in $pkg.scripts.PSObject.Properties) {
    $value = [string]$prop.Value
    if ($value -match '\.ps1' -and $value -notmatch 'pwsh\b.*-File\b') {
      $entryViolations.Add("package.json: scripts.$($prop.Name)")
    }
  }
  foreach ($prop in $pkg.'lint-staged'.PSObject.Properties) {
    $value = @($prop.Value) -join ' '
    if ($value -match '\.ps1' -and $value -notmatch 'pwsh\b.*-File\b') {
      $entryViolations.Add("package.json: lint-staged.$($prop.Name)")
    }
  }

  $huskyFiles = @($tracked | Where-Object { $_ -match '^\.husky/' })
  foreach ($file in $huskyFiles) {
    $lines = [IO.File]::ReadAllLines((Join-Path $repoRoot $file))
    for ($i = 0; $i -lt $lines.Count; $i++) {
      $line = $lines[$i]
      if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
      if ($line -notmatch '^\s*exec\s+pwsh\b') {
        $entryViolations.Add("${file}:$($i + 1): hook must start with 'exec pwsh'")
        continue
      }
      if ($line -notmatch '-File\b') {
        $entryViolations.Add("${file}:$($i + 1): missing '-File'")
      }
      if ($line -match '\b(?:sh|bash|cmd)\b') {
        $entryViolations.Add("${file}:$($i + 1): direct sh/bash/cmd call")
      }
    }
  }

  $ownPs1 = @($tracked | Where-Object { $_ -match '\.ps1$' })
  foreach ($file in $ownPs1) {
    $lines = [IO.File]::ReadAllLines((Join-Path $repoRoot $file))
    for ($i = 0; $i -lt $lines.Count; $i++) {
      $line = $lines[$i]
      if ($line.TrimStart().StartsWith('#')) { continue }
      # A real script path looks like `dir/name.ps1`; a `\.ps1` token inside a
      # regex literal (e.g. `'\.ps1$'`) is not a launch reference.
      if ($line -notmatch '[\w/.-]+\.ps1') { continue }
      if ($line -match 'node_modules[\\/]\.bin' -or $line -match '\$bin\b' -or $line -match '\.bin') { continue }
      if ($line -match 'Test-Path') { continue }
      if ($line -notmatch '(pwsh|\$pwsh)\b.*-File\b') {
        $entryViolations.Add("${file}:$($i + 1): own .ps1 launch without pwsh -File")
      }
    }
  }

  Write-Host "cmd/bat files: $($cmdBat.Count)"
  Write-Host "forbidden shell host calls: $($forbidden.Count)"
  Write-Host "pwsh -File entry violations: $($entryViolations.Count)"

  $failures = @()
  if ($cmdBat.Count -gt 0) { $failures += 'cmd/bat' }
  if ($forbidden.Count -gt 0) { $failures += 'forbidden hosts' }
  if ($entryViolations.Count -gt 0) { $failures += 'entry convention' }

  if ($failures.Count -eq 0) {
    Write-Host 'script baseline: all three counts are 0' -ForegroundColor Green
    exit 0
  }

  foreach ($entry in $cmdBat) { Write-Host "  cmd/bat: $entry" -ForegroundColor Red }
  foreach ($entry in $forbidden) { Write-Host "  forbidden: $entry" -ForegroundColor Red }
  foreach ($entry in $entryViolations) { Write-Host "  entry: $entry" -ForegroundColor Red }
  Write-Host "script baseline failed: $($failures -join ', ')" -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}
