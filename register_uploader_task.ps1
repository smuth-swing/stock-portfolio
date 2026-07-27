# register_uploader_task.ps1
# GitHub 자동 업로더 스케줄러 등록 — VBS 래퍼로 숨김 실행
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$taskName = "StockAutoGitHubUploader"
$description = "엑셀 변경 감지 및 GitHub 자동 업로드 (숨김 실행)"
$ProjectDir = $PSScriptRoot
$VbsFile = Join-Path $ProjectDir "run_auto_uploader_hidden.vbs"

# 기존 작업 삭제
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[정보] 기존 작업 삭제됨: '$taskName'"
}

# VBS 래퍼를 통해 숨김 실행 (wscript.exe 사용)
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$VbsFile`"" -WorkingDirectory $ProjectDir

# 트리거: 로그온 30초 후 실행
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLogon.Delay = "PT30S"

# 설정: 무제한 실행, 배터리 무시, 자동 재시작
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# 등록
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $description `
    -Action $action `
    -Trigger $triggerLogon `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host ""
Write-Host "=========================================="
Write-Host "[완료] '$taskName' 등록 성공!" -ForegroundColor Green
Write-Host "  - 로그온 30초 후 자동 시작"
Write-Host "  - 실패 시 5회 자동 재시작 (1분 간격)"
Write-Host "  - 실행방식: wscript.exe -> VBS (창 없음)"
Write-Host "=========================================="

# 확인
$check = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "  상태: $($check.State)"
}

Write-Host ""
Read-Host "엔터를 눌러 종료"
