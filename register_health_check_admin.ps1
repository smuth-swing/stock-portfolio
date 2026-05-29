# register_health_check_admin.ps1
# 이 파일을 우클릭 → "PowerShell로 실행" 하거나
# 관리자 PowerShell에서: .\register_health_check_admin.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$taskName = "StockPortfolioHealthCheck"
$ps1File  = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1"

Write-Host "=== 서버 헬스체크 스케줄러 등록 ===" -ForegroundColor Cyan
Write-Host "  70분마다 Flask 서버 상태 확인 및 자동 재시작"
Write-Host ""

# 기존 작업 삭제
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "[1] 기존 작업 정리 완료"

# 액션 정의
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File `"$ps1File`"" `
    -WorkingDirectory "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"

# 트리거: 지금 즉시 시작, 이후 70분마다 무기한 반복
$trigger = New-ScheduledTaskTrigger -Once `
    -At (Get-Date).AddSeconds(10) `
    -RepetitionInterval  (New-TimeSpan -Minutes 70) `
    -RepetitionDuration  ([TimeSpan]::MaxValue)

# 설정
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit  (New-TimeSpan -Minutes 5) `
    -RestartCount        2 `
    -RestartInterval     (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances   IgnoreNew

# 실행 계정
$principal = New-ScheduledTaskPrincipal `
    -UserId    $env:USERNAME `
    -LogonType Interactive `
    -RunLevel  Highest

# 등록
Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -Principal  $principal `
    -Description "70분마다 Flask 서버(포트 5000) 상태 확인 및 자동 재시작" `
    -Force | Out-Null

Write-Host "[2] 스케줄러 등록 시도 완료"
Write-Host ""

# 결과 확인
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "=== 등록 성공! ===" -ForegroundColor Green
    Write-Host "  작업명   : $($task.TaskName)"
    Write-Host "  상태     : $($task.State)"
    Write-Host "  다음실행 : $($info.NextRunTime)"
    Write-Host "  반복주기 : 70분"
    Write-Host ""
    Write-Host "수동 실행: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
} else {
    Write-Host "=== 등록 실패 ===" -ForegroundColor Red
    Write-Host "관리자 권한으로 실행했는지 확인하세요."
}

Write-Host ""
Read-Host "엔터를 눌러 닫기"
