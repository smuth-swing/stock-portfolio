# 서버 자동 재시작 스케줄러 등록 (매일 21:10)
# VBS 래퍼로 완전 숨김 실행
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$TaskName   = "StockPortfolioRestart"
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$VbsFile    = Join-Path $ProjectDir "run_restart_hidden.vbs"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  서버 자동 재시작 스케줄러 등록"         -ForegroundColor Cyan
Write-Host "  매일 오후 09:10 실행 (숨김 모드)"       -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 기존 작업 삭제
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[삭제] 기존 작업 초기화" -ForegroundColor Yellow
}

# VBS 래퍼를 통해 숨김 실행 (wscript.exe 사용)
$Action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$VbsFile`"" `
    -WorkingDirectory $ProjectDir

# 매일 21:10 트리거
$Trigger = New-ScheduledTaskTrigger -Daily -At "21:10"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "주식 포트폴리오 서버 매일 21:10 자동 재시작 (숨김 실행)" `
    -Force | Out-Null

Write-Host "[완료] 스케줄러 등록 성공!" -ForegroundColor Green
Write-Host ""
Write-Host "  작업명  : $TaskName"       -ForegroundColor White
Write-Host "  실행시각: 매일 오후 21:10" -ForegroundColor White
Write-Host "  실행방식: wscript.exe -> VBS (창 없음)" -ForegroundColor White
Write-Host "  로그파일: $(Join-Path $ProjectDir 'restart_log.txt')" -ForegroundColor White
Write-Host ""

# 등록 확인
$check = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($check) {
    $nextRun = ($check | Get-ScheduledTaskInfo).NextRunTime
    Write-Host "  다음 실행: $nextRun" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  등록 완료! (창이 뜨지 않습니다)"        -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "엔터를 눌러 종료"
