# register_resume_task.ps1
# 절전/최대절전 복귀 시 자동 복구 — VBS 래퍼로 숨김 실행
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$sd = "c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$vbsFile = "$sd\run_resume_hidden.vbs"
$tn = "StockApp_OnResume"

# 기존 작업 삭제
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue

# 1. VBS 래퍼를 통해 숨김 실행 (wscript.exe 사용)
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsFile`""
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$trigger1 = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger1 -Principal $principal -Settings $settings | Out-Null

# 2. Export XML and merge 'Power-Troubleshooter' EventID 1 trigger
$xml = Export-ScheduledTask -TaskName $tn
$nl = [Environment]::NewLine
$eventTriggerXml = '    <EventTrigger>' + $nl + '      <Enabled>true</Enabled>' + $nl + '      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name=''Microsoft-Windows-Power-Troubleshooter''] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>' + $nl + '    </EventTrigger>'
$xml = $xml -replace '</Triggers>', ($eventTriggerXml + $nl + '</Triggers>')

# 3. Import updated XML
Register-ScheduledTask -TaskName $tn -Xml $xml -Force | Out-Null

Write-Host "완료: $tn (로그온 + 절전 복귀 이벤트 트리거, 숨김 실행)" -ForegroundColor Green
schtasks /query /tn $tn /fo LIST
