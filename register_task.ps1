# ===================================================
# 주식 포트폴리오 서버 - 작업 스케줄러 등록 스크립트
# 기존 스타트업 단축키(한글 경로 오류) 대신
# Windows 작업 스케줄러를 사용하여 확실하게 자동 실행
# ===================================================

$TaskName = "StockPortfolioServer"
$PythonExe = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$ServerScript = Join-Path $ProjectDir "server.py"
$LogFile = Join-Path $ProjectDir "server_log.txt"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  주식 포트폴리오 서버 - 작업 스케줄러 등록" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Python 존재 확인
if (-not (Test-Path $PythonExe)) {
    Write-Host "[오류] Python을 찾을 수 없습니다: $PythonExe" -ForegroundColor Red
    exit 1
}

# server.py 존재 확인
if (-not (Test-Path $ServerScript)) {
    Write-Host "[오류] server.py를 찾을 수 없습니다: $ServerScript" -ForegroundColor Red
    exit 1
}

# 기존 작업 삭제 (있을 경우)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[정보] 기존 작업 삭제됨: $TaskName" -ForegroundColor Yellow
}

# 기존 스타트업 단축키도 삭제 (충돌 방지)
$oldShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StockPortfolioServer.lnk"
if (Test-Path $oldShortcut) {
    Remove-Item $oldShortcut -Force
    Write-Host "[정보] 기존 스타트업 단축키 삭제됨" -ForegroundColor Yellow
}

# 작업 액션 정의: python.exe server.py 직접 실행
$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ServerScript`"" `
    -WorkingDirectory $ProjectDir

# 트리거: 로그인 시 실행 (현재 사용자)
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# 실행 조건: 숨김 창으로 실행
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

# 주체: 현재 사용자, 최고 권한으로 실행
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# 작업 등록
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "주식 포트폴리오 관리 Flask 서버 (포트 5000)" `
    -Force | Out-Null

Write-Host "[완료] 작업 스케줄러 등록 성공!" -ForegroundColor Green
Write-Host ""
Write-Host "  작업명  : $TaskName" -ForegroundColor White
Write-Host "  실행파일: $PythonExe" -ForegroundColor White
Write-Host "  스크립트: $ServerScript" -ForegroundColor White
Write-Host "  실행조건: 로그인 시 자동 실행" -ForegroundColor White
Write-Host ""

# 즉시 서버 시작 여부 확인
$startNow = Read-Host "지금 바로 서버를 시작하시겠습니까? (y/n)"
if ($startNow -eq 'y' -or $startNow -eq 'Y') {
    Write-Host "[시작] 서버를 실행합니다..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 3
    
    # 포트 확인
    $portCheck = netstat -ano | findstr ":5000" | findstr "LISTENING"
    if ($portCheck) {
        Write-Host "[성공] 서버가 포트 5000에서 실행 중입니다!" -ForegroundColor Green
        Write-Host "  브라우저에서 http://localhost:5000 으로 접속하세요." -ForegroundColor White
    } else {
        Write-Host "[대기] 서버 시작 중... 5초 후 재확인합니다." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        $portCheck2 = netstat -ano | findstr ":5000" | findstr "LISTENING"
        if ($portCheck2) {
            Write-Host "[성공] 서버가 실행 중입니다! http://localhost:5000" -ForegroundColor Green
        } else {
            Write-Host "[오류] 서버 시작에 실패했습니다. 로그를 확인하세요: $LogFile" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  다음 PC 재시작부터 서버가 자동으로 실행됩니다." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
