# ===================================================
# 주식 포트폴리오 서버 (Graph API 버전) - 작업 스케줄러 등록
# 기존 server.py 작업을 삭제하고 server_graph.py로 교체
# ===================================================

# 관리자 권한 확인 및 자동 재실행
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "관리자 권한으로 재실행합니다..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$OldTaskName  = "StockPortfolioServer"
$NewTaskName  = "StockPortfolioServer_Graph"
$PythonExe    = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$ProjectDir   = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$ServerScript = Join-Path $ProjectDir "server_graph.py"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  주식 포트폴리오 서버 스케줄러 업데이트"       -ForegroundColor Cyan
Write-Host "  server.py -> server_graph.py"                  -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. 기존 구버전 작업 삭제 ──────────────────────────────
$old = Get-ScheduledTask -TaskName $OldTaskName -ErrorAction SilentlyContinue
if ($old) {
    Stop-ScheduledTask  -TaskName $OldTaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $OldTaskName -Confirm:$false
    Write-Host "[삭제] 기존 작업 삭제 완료: $OldTaskName" -ForegroundColor Yellow
} else {
    Write-Host "[정보] 기존 작업 없음 (이미 삭제됨)" -ForegroundColor Gray
}

# 기존에 등록된 신버전도 초기화
$existing = Get-ScheduledTask -TaskName $NewTaskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask  -TaskName $NewTaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $NewTaskName -Confirm:$false
    Write-Host "[초기화] 기존 신버전 작업 삭제: $NewTaskName" -ForegroundColor Yellow
}

# ── 2. 경로 확인 ──────────────────────────────────────────
if (-not (Test-Path $PythonExe)) {
    Write-Host "[오류] Python 없음: $PythonExe" -ForegroundColor Red
    Read-Host "엔터를 눌러 종료"; exit 1
}
if (-not (Test-Path $ServerScript)) {
    Write-Host "[오류] server_graph.py 없음: $ServerScript" -ForegroundColor Red
    Read-Host "엔터를 눌러 종료"; exit 1
}

# ── 3. 포트 5000 사용 중인 Python 프로세스 정리 ───────────
Write-Host "[정리] 포트 5000 사용 중인 Python 프로세스 종료..." -ForegroundColor Yellow
$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
foreach ($netLine in $netLines) {
    $procPid = ($netLine.ToString().Trim() -split "\s+")[-1]
    if ($procPid -match "^\d+$" -and $procPid -ne "0") {
        $proc = Get-Process -Id ([int]$procPid) -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -match "python") {
            Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue
            Write-Host "  -> PID $procPid ($($proc.Name)) 종료됨" -ForegroundColor Gray
        }
    }
}

# ── 4. 새 작업 등록 (server_graph.py) ─────────────────────
Write-Host ""
Write-Host "[등록] 새 작업 스케줄러 등록 중..." -ForegroundColor Cyan

$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ServerScript`"" `
    -WorkingDirectory $ProjectDir

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $NewTaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "주식 포트폴리오 관리 Flask 서버 Graph API 버전 (포트 5000)" `
    -Force | Out-Null

Write-Host "[완료] 새 작업 등록 성공!" -ForegroundColor Green
Write-Host "  작업명  : $NewTaskName"  -ForegroundColor White
Write-Host "  스크립트: $ServerScript" -ForegroundColor White
Write-Host "  실행조건: 로그인 시 자동 실행" -ForegroundColor White
Write-Host ""

# ── 5. 즉시 서버 시작 ─────────────────────────────────────
Write-Host "[시작] 서버를 즉시 실행합니다..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $NewTaskName
Start-Sleep -Seconds 5

$portCheck = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($portCheck) {
    Write-Host "[성공] 서버가 포트 5000에서 실행 중입니다!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  PC 브라우저 : http://localhost:5000"           -ForegroundColor White
    Write-Host "  아이폰 PWA  : run_pwa.ps1 실행 후 ngrok URL 사용" -ForegroundColor White
} else {
    Write-Host "[대기] 5초 더 기다리는 중..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $portCheck2 = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
    if ($portCheck2) {
        Write-Host "[성공] 서버 실행 중! -> http://localhost:5000" -ForegroundColor Green
    } else {
        Write-Host "[오류] 서버 시작 실패. 로그를 확인하세요:" -ForegroundColor Red
        Write-Host "  -> $(Join-Path $ProjectDir 'server_graph.log')" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  다음 PC 재시작부터 서버가 자동으로 실행됩니다." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "엔터를 눌러 종료"
