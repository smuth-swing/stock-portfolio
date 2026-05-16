# register_export_task.ps1 — JSON 내보내기 작업 스케줄러 등록

# UTF-8 출력 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$taskName   = "Stock_Portfolio_JSON_Export"
$batFile    = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_export.bat"
$runAt      = "08:00"

Write-Host "=== JSON 내보내기 작업 스케줄러 등록 ==="

# 기존 작업이 있으면 삭제
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[OK] 기존 작업 삭제됨"
}

# 작업 구성
$action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`""
$trigger   = New-ScheduledTaskTrigger -Daily -At $runAt
$settings  = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable    # PC가 꺼져 있다가 켜지면 바로 실행
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# 등록
Register-ScheduledTask `
    -TaskName    $taskName `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -Principal   $principal `
    -Description "매일 오전 8시 주식 포트폴리오 데이터를 JSON으로 OneDrive에 내보내기" `
    -Force | Out-Null

# 결과 확인
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "[완료] 작업 등록 성공!"
    Write-Host "  이름  : $($task.TaskName)"
    Write-Host "  상태  : $($task.State)"
    Write-Host "  실행  : 매일 오전 $runAt"
    Write-Host ""
    Write-Host "수동으로 바로 실행하려면:"
    Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
} else {
    Write-Host "[오류] 작업 등록 실패"
}
