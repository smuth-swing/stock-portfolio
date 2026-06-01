# 작업 스케줄러에 GitHub 자동 업로더 등록
# PC 로그온 시 auto_github_uploader.py 자동 시작

$taskName = "StockAutoGitHubUploader"
$description = "엑셀 파일 변경 감지 시 GitHub 자동 업로드 (로그온 시 자동 시작)"

# 기존 작업이 있으면 삭제
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[INFO] 기존 작업 '$taskName' 삭제 완료"
}

# 실행할 프로그램 설정 (VBS 래퍼를 통해 콘솔 창 숨김)
$vbsPath = "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_auto_uploader_hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""

# 트리거: 로그온 시 실행 (30초 딜레이)
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT30S"

# 설정: 무기한 실행, 배터리 무시
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# 등록
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $description `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host ""
Write-Host "========================================"
Write-Host "[완료] '$taskName' 작업 스케줄러 등록 성공!"
Write-Host "  - PC 로그온 시 30초 후 자동 시작"
Write-Host "  - 엑셀 저장 시 자동 GitHub push"
Write-Host "========================================"
