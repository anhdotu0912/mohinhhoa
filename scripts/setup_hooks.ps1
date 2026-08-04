# Install git pre-push hook for AI log submission (Windows PowerShell).
# Run once after cloning: powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
#
# Background:
#   #!/usr/bin/env bash  → often resolves to C:\Windows\System32\bash.exe (WSL relay).
#   If WSL has no distro, push fails:
#     WSL ERROR: execvpe(/bin/bash) failed: No such file or directory
# Fix: use #!/bin/sh (Git for Windows) + absolute path to Git\bin\bash.exe inside the hook.

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$HookFile = Join-Path $RepoRoot '.git\hooks\pre-push'

function Find-GitExe([string]$Name) {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Git\bin\$Name"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\bin\$Name"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\bin\$Name")
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return $null
}

$GitBash = Find-GitExe 'bash.exe'
$GitSh = Find-GitExe 'sh.exe'

if (-not $GitBash -or -not $GitSh) {
    Write-Error @"
[ai-log] Khong tim thay Git for Windows (Git\bin\bash.exe / sh.exe).
Cai dat: https://git-scm.com/download/win
"@
}

$BashPosix = ($GitBash -replace '\\', '/')

# Single-quoted template so PowerShell does not expand $GIT_BASH
$HookBody = @'
#!/bin/sh
# Pre-push: sweep AI prompts, then submit .ai-log (never block push).
# Interpreter: Git for Windows /bin/sh (NOT WSL).
GIT_BASH="__GIT_BASH__"
"$GIT_BASH" scripts/_pyrun.sh scripts/log_antigravity.py --auto || true
"$GIT_BASH" scripts/_pyrun.sh scripts/submit_log.py || true
exit 0
'@

$HookBody = $HookBody.Replace('__GIT_BASH__', $BashPosix)
$HookBody = $HookBody -replace "`r`n", "`n" -replace "`r", "`n"

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($HookFile, $HookBody, $utf8NoBom)

Write-Host "[ai-log] Git pre-push hook installed."
Write-Host "[ai-log] Git Bash: $GitBash"
Write-Host "[ai-log] Shebang: #!/bin/sh (Git for Windows, avoids WSL)"

$AiLogDir = Join-Path $RepoRoot '.ai-log'
if (-not (Test-Path $AiLogDir)) {
    New-Item -ItemType Directory -Path $AiLogDir | Out-Null
}
$GitKeep = Join-Path $AiLogDir '.gitkeep'
if (-not (Test-Path $GitKeep)) {
    New-Item -ItemType File -Path $GitKeep | Out-Null
}

Write-Host "[ai-log] Setup complete. Hay push lai (dung xoa hook)."
