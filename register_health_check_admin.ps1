# register_health_check_admin.ps1
# 헬스체크 스케줄러 등록 — VBS 래퍼로 완전 숨김 실행
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$taskName = "StockPortfolioHealthCheck"
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$vbsFile = Join-Path $ProjectDir "run_health_check_hidden.vbs"

Write-Host "=== 서버 헬스체크 스케줄러 등록 (숨김 실행) ===" -ForegroundColor Cyan
Write-Host "  1시간마다 Flask 서버 상태 확인 후 다운 시 재시작"
Write-Host "  (PowerShell/CMD 창이 뜨지 않습니다)"
Write-Host ""

# 기존 작업 삭제
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Write-Host "[1] 기존 작업 초기화"

# VBS 래퍼를 통해 숨김 실행 (wscript.exe 사용)
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$vbsFile`"" `
    -WorkingDirectory $ProjectDir

# 트리거: 1시간마다 반복 실행
$trigger = New-ScheduledTaskTrigger -Once `
    -At (Get-Date).AddSeconds(10) `
    -RepetitionInterval  (New-TimeSpan -Hours 1) `
    -RepetitionDuration  (New-TimeSpan -Days 3650)

# 설정 (배터리 제한 해제)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit  (New-TimeSpan -Minutes 5) `
    -RestartCount        2 `
    -RestartInterval     (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances   IgnoreNew `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries

# 실행 계정
$principal = New-ScheduledTaskPrincipal `
    -UserId    $env:USERNAME `
    -LogonType Interactive `
    -RunLevel  Highest

# 작업 등록
Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -Principal  $principal `
    -Description "Flask 서버 헬스체크 (1시간 반복, 숨김 실행)" `
    -Force | Out-Null

Write-Host "[2] 작업 등록 완료"
Write-Host ""

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "=== 성공 ===" -ForegroundColor Green
    Write-Host "  작업명  : $($task.TaskName)"
    Write-Host "  상태    : $($task.State)"
    Write-Host "  다음실행: $($info.NextRunTime)"
    Write-Host "  반복간격: 1시간"
    Write-Host "  실행방식: wscript.exe -> VBS (창 없음)"
    Write-Host ""
} else {
    Write-Host "=== 실패 ===" -ForegroundColor Red
}
Start-Sleep -Seconds 3
