[CmdletBinding()]
param([switch]$RunNow)

$TaskName = 'StockPortfolioDailyGuard'
$ProjectDir = $PSScriptRoot
$ScriptFile = Join-Path $ProjectDir 'daily_pc_guard.ps1'

if (-not (Test-Path -LiteralPath $ScriptFile)) { throw "Missing script: $ScriptFile" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptFile`"" -WorkingDirectory $ProjectDir
$daily = New-ScheduledTaskTrigger -Daily -At '09:00'
$logon = New-ScheduledTaskTrigger -AtLogOn
$logon.Delay = 'PT10M'
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($daily,$logon) -Settings $settings -Principal $principal -Description 'Daily health report and incremental backup for Stock Portfolio' -Force | Out-Null
Write-Host "Registered: $TaskName (daily 09:00 + logon delay 10m)" -ForegroundColor Green

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host 'Started once for verification.' -ForegroundColor Cyan
}
