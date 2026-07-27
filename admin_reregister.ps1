# admin_reregister.ps1
# 관리자 권한으로 모든 작업 스케줄러 태스크를 wscript.exe + VBS 래퍼로 재등록

$ProjectDir = $PSScriptRoot
$LogFile = Join-Path $ProjectDir "admin_reregister_log.txt"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log($msg) {
    $line = "[$ts] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

Log "===== 전체 태스크 재등록 시작 ====="

# ==================== 1. StockPortfolioServer ====================
$tn = "StockPortfolioServer"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$vbs = Join-Path $ProjectDir "run_server_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Flask server (hidden via VBS)" -Force | Out-Null
Log "[1/5] $tn -> wscript.exe"

# ==================== 2. StockAutoGitHubUploader ====================
$tn = "StockAutoGitHubUploader"
Stop-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$vbs = Join-Path $ProjectDir "run_auto_uploader_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $ProjectDir
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLogon.Delay = "PT30S"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Days 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $triggerLogon -Settings $settings -Principal $principal -Description "GitHub uploader (hidden via VBS)" -Force | Out-Null
Log "[2/5] $tn -> wscript.exe"

# ==================== 3. StockPortfolioHealthCheck ====================
$tn = "StockPortfolioHealthCheck"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$vbs = Join-Path $ProjectDir "run_health_check_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Health check (hidden via VBS)" -Force | Out-Null
Log "[3/5] $tn -> wscript.exe"

# ==================== 4. StockPortfolioRestart ====================
$tn = "StockPortfolioRestart"
Stop-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$vbs = Join-Path $ProjectDir "run_restart_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Daily -At "21:10"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily restart (hidden via VBS)" -Force | Out-Null
Log "[4/5] $tn -> wscript.exe"

# ==================== 5. StockApp_OnResume ====================
$tn = "StockApp_OnResume"
Unregister-ScheduledTask -TaskName $tn -Confirm:$false -ErrorAction SilentlyContinue
$vbs = Join-Path $ProjectDir "run_resume_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"')
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
Log "[5/5] $tn -> wscript.exe (Logon + Resume Event)"

# ==================== 결과 확인 ====================
Log ""
Log "===== 등록 결과 ====="
$taskNames = @("StockPortfolioServer", "StockAutoGitHubUploader", "StockPortfolioHealthCheck", "StockPortfolioRestart", "StockApp_OnResume")
foreach ($t in $taskNames) {
    $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    if ($task) {
        $exe = ($task.Actions | Select-Object -First 1).Execute
        Log "[OK] $t -> $exe"
    } else {
        Log "[FAIL] $t"
    }
}
Log "===== 완료 ====="
Start-Sleep 3
