# 서버 재시작 스크립트 (매일 21:10 자동 실행용)
# 포트 5000 Python 프로세스를 종료하고 스케줄러로 재시작

$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$TaskName   = "StockPortfolioServer"
$LogFile    = Join-Path $ProjectDir "restart_log.txt"

function Write-Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

Write-Log "===== 서버 자동 재시작 시작 ====="

# 1. 스케줄러로 실행 중인 태스크 강제 종료 (관리자 권한 프로세스 종료용)
schtasks /end /tn "StockPortfolioServer" *>&1 | Out-Null
Write-Log "작업 스케줄러 'StockPortfolioServer' 강제 종료 신호 전송 완료"
Start-Sleep -Seconds 2

# 2. 포트 5000 점유 Python 프로세스 확인 및 종료 (Fall-back)
$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($netLines) {
    foreach ($netLine in $netLines) {
        $procPid = ($netLine.ToString().Trim() -split "\s+")[-1]
        if ($procPid -match "^\d+$" -and $procPid -ne "0") {
            $proc = Get-Process -Id ([int]$procPid) -ErrorAction SilentlyContinue
            if ($proc) {
                Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue
                Write-Log "프로세스 종료: PID $procPid ($($proc.Name))"
            }
        }
    }
} else {
    Write-Log "실행 중인 서버 없음"
}

Start-Sleep -Seconds 3

# 2. 스케줄러로 서버 재시작
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Log "스케줄러 작업 시작: $TaskName"
} else {
    # 스케줄러 없으면 직접 실행
    $PythonExe = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
    $Script    = Join-Path $ProjectDir "server.py"
    Start-Process -FilePath $PythonExe -ArgumentList "`"$Script`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
    Write-Log "서버 직접 실행: $Script"
}

Start-Sleep -Seconds 6

# 3. 정상 실행 확인
$check = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($check) {
    Write-Log "서버 재시작 성공 - 포트 5000 정상 실행"
} else {
    Write-Log "[오류] 서버 재시작 실패 - 포트 5000 미실행"
}

Write-Log "===== 서버 자동 재시작 완료 ====="
