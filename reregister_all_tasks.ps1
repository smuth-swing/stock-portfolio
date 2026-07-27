# reregister_all_tasks.ps1
# 모든 작업 스케줄러 태스크를 VBS 래퍼로 재등록 (콘솔 창 완전 숨김)
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  주식 포트폴리오 - 전체 태스크 재등록 (숨김 실행 모드)" -ForegroundColor Cyan
Write-Host "  모든 PowerShell/CMD 창이 뜨지 않도록 VBS 래퍼 적용" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ==================== 1. StockPortfolioServer ====================
Write-Host "[1/5] StockPortfolioServer (서버 자동 시작)..." -ForegroundColor Yellow
$tn = "StockPortfolioServer"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$ProjectDir\run_server_hidden.vbs`"" -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopOnIdleEnd
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Flask 서버 (숨김)" -Force | Out-Null
Write-Host "  -> 완료" -ForegroundColor Green

# ==================== 2. StockAutoGitHubUploader ====================
Write-Host "[2/5] StockAutoGitHubUploader (GitHub 자동 업로드)..." -ForegroundColor Yellow
$tn = "StockAutoGitHubUploader"
Stop-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$ProjectDir\run_auto_uploader_hidden.vbs`"" -WorkingDirectory $ProjectDir
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLogon.Delay = "PT30S"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Days 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $triggerLogon -Settings $settings -Principal $principal -Description "GitHub 업로더 (숨김)" -Force | Out-Null
Write-Host "  -> 완료" -ForegroundColor Green

# ==================== 3. StockPortfolioHealthCheck ====================
Write-Host "[3/5] StockPortfolioHealthCheck (1시간 헬스체크)..." -ForegroundColor Yellow
$tn = "StockPortfolioHealthCheck"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$ProjectDir\run_health_check_hidden.vbs`"" -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "헬스체크 (숨김)" -Force | Out-Null
Write-Host "  -> 완료" -ForegroundColor Green

# ==================== 4. StockPortfolioRestart ====================
Write-Host "[4/5] StockPortfolioRestart (매일 21:10 재시작)..." -ForegroundColor Yellow
$tn = "StockPortfolioRestart"
Stop-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$ProjectDir\run_restart_hidden.vbs`"" -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Daily -At "21:10"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable -DontStopOnIdleEnd
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "서버 재시작 (숨김)" -Force | Out-Null
Write-Host "  -> 완료" -ForegroundColor Green

# ==================== 5. StockApp_OnResume ====================
Write-Host "[5/5] StockApp_OnResume (절전 복귀 확인)..." -ForegroundColor Yellow
$tn = "StockApp_OnResume"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$ProjectDir\run_resume_hidden.vbs`""
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger1 -Principal $principal -Settings $settings | Out-Null

# Power-Troubleshooter 이벤트 트리거 추가
$xml = Export-ScheduledTask -TaskName $tn
$nl = [Environment]::NewLine
$eventTriggerXml = '    <EventTrigger>' + $nl + '      <Enabled>true</Enabled>' + $nl + '      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name=''Microsoft-Windows-Power-Troubleshooter''] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>' + $nl + '    </EventTrigger>'
$xml = $xml -replace '</Triggers>', ($eventTriggerXml + $nl + '</Triggers>')
Register-ScheduledTask -TaskName $tn -Xml $xml -Force | Out-Null
Write-Host "  -> 완료 (로그온 + 절전 복귀 이벤트)" -ForegroundColor Green

# ==================== 결과 확인 ====================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  등록 결과 확인" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$tasks = @("StockPortfolioServer", "StockAutoGitHubUploader", "StockPortfolioHealthCheck", "StockPortfolioRestart", "StockApp_OnResume")
foreach ($t in $tasks) {
    $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $t -ErrorAction SilentlyContinue
        $exe = ($task.Actions | Select-Object -First 1).Execute
        Write-Host "  [OK] $t" -ForegroundColor Green -NoNewline
        Write-Host " (실행: $exe, 상태: $($task.State))"
    } else {
        Write-Host "  [FAIL] $t" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  모든 태스크가 wscript.exe로 등록되었습니다." -ForegroundColor Green
Write-Host "  더 이상 PowerShell/CMD 창이 뜨지 않습니다!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "엔터를 눌러 종료"
