# register_uploader_task.ps1
# GitHub auto uploader task scheduler registration
# Auto-elevate to admin
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$taskName = "StockAutoGitHubUploader"
$description = "Excel file change detection and GitHub auto upload"
$ProjectDir = $PSScriptRoot
$PythonExe = 'C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe'
$UploaderScript = Join-Path $ProjectDir "auto_github_uploader.py"

# Remove existing task
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[INFO] Removed existing task '$taskName'"
}

# Python direct execution (no VBS wrapper for stability)
$action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$UploaderScript`"" -WorkingDirectory $ProjectDir

# Trigger: At logon with 30s delay
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLogon.Delay = "PT30S"

# Settings: unlimited execution, battery ignore, auto restart
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Register
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $description `
    -Action $action `
    -Trigger $triggerLogon `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host ""
Write-Host "=========================================="
Write-Host "[DONE] '$taskName' registered successfully!"
Write-Host "  - Auto start 30s after logon"
Write-Host "  - 5 auto restarts on failure (1min interval)"
Write-Host "  - Resume check via on_resume_check.ps1"
Write-Host "  - Daily restart via restart_server.ps1 at 21:10"
Write-Host "=========================================="

# Verify
$check = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "  State: $($check.State)"
}

Write-Host ""
Read-Host "Press Enter to close"
