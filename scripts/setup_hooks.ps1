# Install git pre-push hook for AI log submission (Windows PowerShell).
# Run once after cloning: powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$HookFile = Join-Path $RepoRoot '.git\hooks\pre-push'

# Git on Windows runs hooks via shebang/Git Bash.
# MUST be UTF-8 without BOM and LF line endings — BOM breaks "#!/usr/bin/env bash"
# and causes: cannot spawn .git/hooks/pre-push: No such file or directory
$HookBody = @"
#!/usr/bin/env bash
# Pre-push: sweep recent Antigravity / Gemini prompts, then submit AI logs.
bash scripts/_pyrun.sh scripts/log_antigravity.py --auto || true
bash scripts/_pyrun.sh scripts/submit_log.py || true
exit 0
"@

$HookBody = $HookBody -replace "`r`n", "`n" -replace "`r", "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($HookFile, $HookBody, $utf8NoBom)

Write-Host "[ai-log] Git pre-push hook installed (UTF-8 no BOM, LF)."

$AiLogDir = Join-Path $RepoRoot '.ai-log'
if (-not (Test-Path $AiLogDir)) {
    New-Item -ItemType Directory -Path $AiLogDir | Out-Null
}
$GitKeep = Join-Path $AiLogDir '.gitkeep'
if (-not (Test-Path $GitKeep)) {
    New-Item -ItemType File -Path $GitKeep | Out-Null
}

Write-Host "[ai-log] Setup complete. Configure AI_LOG_SERVER in your .env file."
