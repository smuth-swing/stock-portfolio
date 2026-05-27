
$sd = "c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$rs = "$sd\on_resume_check.ps1"
$tn = "StockApp_OnResume"

Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$rs`""
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "Done: $tn" -ForegroundColor Green
schtasks /query /tn $tn /fo LIST
