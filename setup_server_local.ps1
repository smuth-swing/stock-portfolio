# 로컬 OneDrive 서버 스케줄러 재등록 (Azure 제거)
# 관리자 권한 자동 획득
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$PythonExe  = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$Script     = Join-Path $ProjectDir "server.py"
$TaskName   = "StockPortfolioServer"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  서버 스케줄러 재설정 (로컬 OneDrive)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 기존 작업 모두 삭제
foreach ($t in @("StockPortfolioServer", "StockPortfolioServer_Graph")) {
    $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask  -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
        Write-Host "[삭제] $t" -ForegroundColor Yellow
    }
}

# 포트 5000 Python 프로세스 종료
Write-Host "[정리] 포트 5000 프로세스 종료 중..." -ForegroundColor Yellow
$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
foreach ($netLine in $netLines) {
    $procPid = ($netLine.ToString().Trim() -split "\s+")[-1]
    if ($procPid -match "^\d+$" -and $procPid -ne "0") {
        $proc = Get-Process -Id ([int]$procPid) -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue
            Write-Host "  -> PID $procPid ($($proc.Name)) 종료" -ForegroundColor Gray
        }
    }
}

Start-Sleep -Seconds 2

# 새 스케줄러 등록 (server.py - 로컬 OneDrive)
Write-Host ""
Write-Host "[등록] server.py 스케줄러 등록 중..." -ForegroundColor Cyan

$Action    = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$Script`"" -WorkingDirectory $ProjectDir
$Trigger   = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopOnIdleEnd
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "주식 포트폴리오 로컬 OneDrive 서버 (포트 5000)" -Force | Out-Null

Write-Host "[완료] 등록 완료: $TaskName" -ForegroundColor Green
Write-Host "  스크립트: $Script" -ForegroundColor White
Write-Host ""

# 즉시 시작
Write-Host "[시작] 서버 즉시 실행..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 6

$check = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($check) {
    Write-Host ""
    Write-Host "[성공] 서버 실행 중!" -ForegroundColor Green
    Write-Host "  PC 대시보드 : http://localhost:5000"       -ForegroundColor White
    Write-Host "  아이폰 PWA  : http://localhost:5000/mobile/" -ForegroundColor White
} else {
    Write-Host "[오류] 서버 시작 실패. 로그 확인:" -ForegroundColor Red
    Write-Host "  -> $(Join-Path $ProjectDir 'server_log.txt')" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  PC 재시작 후에도 자동 실행됩니다."      -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "엔터를 눌러 종료"
