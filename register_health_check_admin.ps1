# register_health_check_admin.ps1
# Auto-elevate to Administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$taskName = "StockPortfolioHealthCheck"
$ps1File  = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1"

Write-Host "=== Server Health Check Scheduler Setup ===" -ForegroundColor Cyan
Write-Host "  Checks Flask server status every 1 hour and restarts if down"
Write-Host ""

# Clean existing task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Write-Host "[1] Cleaned existing task"

# Define action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File `"$ps1File`"" `
    -WorkingDirectory "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"

# Trigger: Run every 1 hour indefinitely
$trigger = New-ScheduledTaskTrigger -Once `
    -At (Get-Date).AddSeconds(10) `
    -RepetitionInterval  (New-TimeSpan -Hours 1) `
    -RepetitionDuration  (New-TimeSpan -Days 3650)

# Settings (Unbind battery restrictions)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit  (New-TimeSpan -Minutes 5) `
    -RestartCount        2 `
    -RestartInterval     (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances   IgnoreNew `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries

# Execution account
$principal = New-ScheduledTaskPrincipal `
    -UserId    $env:USERNAME `
    -LogonType Interactive `
    -RunLevel  Highest

# Register Task
Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -Principal  $principal `
    -Description "Checks Flask server (port 5000) every 1 hour and restarts if down" `
    -Force | Out-Null

Write-Host "[2] Task registration complete"
Write-Host ""

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "  Task Name : $($task.TaskName)"
    Write-Host "  State     : $($task.State)"
    Write-Host "  Next Run  : $($info.NextRunTime)"
    Write-Host "  Interval  : 1 hour"
    Write-Host ""
} else {
    Write-Host "=== FAILED ===" -ForegroundColor Red
}
Start-Sleep -Seconds 3
