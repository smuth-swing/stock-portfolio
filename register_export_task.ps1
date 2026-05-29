# register_export_task.ps1 — GitHub 자동 업로드 작업 스케줄러 등록
# 관리자 권한으로 실행 필요: 우클릭 → PowerShell로 실행

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$taskName = "Stock_Portfolio_JSON_Export"
$batFile  = "C:\Users\zerod\run_stock_export.bat"
$runAt    = "08:00"

Write-Host "=== GitHub 자동 업로드 작업 스케줄러 등록 ==="

# 기존 작업이 있으면 삭제
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[OK] 기존 작업 삭제됨"
}

# 작업 구성
$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$batFile`"" `
    -WorkingDirectory "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"

$trigger = New-ScheduledTaskTrigger -Daily -At $runAt

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName    $taskName `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -Principal   $principal `
    -Description "매일 오전 8시 주식 데이터 JSON 변환 후 GitHub 자동 업로드" `
    -Force | Out-Null

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "[완료] 작업 등록 성공!"
    Write-Host "  이름    : $($task.TaskName)"
    Write-Host "  실행 파일: $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
    Write-Host "  작업 폴더: $($task.Actions[0].WorkingDirectory)"
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "  다음 실행: $($info.NextRunTime)"
    Write-Host ""
    Write-Host "수동 실행: Start-ScheduledTask -TaskName '$taskName'"
} else {
    Write-Host "[오류] 작업 등록 실패 - 관리자 권한으로 실행했는지 확인하세요"
}
