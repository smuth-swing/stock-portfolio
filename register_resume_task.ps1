# register_resume_task.ps1
# Auto-elevate to Administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$sd = "c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$rs = "$sd\on_resume_check.ps1"
$tn = "StockApp_OnResume"

# Clean existing task
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue

# 1. Create task structure (Logon trigger + Battery settings)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$rs`""
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$trigger1 = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger1 -Principal $principal -Settings $settings | Out-Null

# 2. Export XML and merge 'Power-Troubleshooter' EventID 1 trigger
$xml = Export-ScheduledTask -TaskName $tn
$eventTriggerXml = @"
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
    </EventTrigger>
"@
$xml = $xml -replace '</Triggers>', "$eventTriggerXml`n</Triggers>"

# 3. Import updated XML
Register-ScheduledTask -TaskName $tn -Xml $xml -Force | Out-Null

Write-Host "Done: $tn (Logon + Resume Event triggers registered)" -ForegroundColor Green
schtasks /query /tn $tn /fo LIST
