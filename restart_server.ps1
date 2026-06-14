# restart_server.ps1 — 서버 + Uploader 재시작 스크립트
# 매일 21:10에 StockPortfolioRestart 태스크에 의해 실행됨
# 서버와 uploader를 모두 안전하게 재시작

$ProjectDir = $PSScriptRoot
$PythonExe  = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$LogFile    = Join-Path $ProjectDir "restart_log.txt"

# 로그 파일 크기 제한 (500KB 초과 시 초기화)
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 512000) {
    Set-Content -Path $LogFile -Value "" -Encoding UTF8
}

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Log "===== 정기 재시작 시작 ====="

# ==================== 1. 서버 재시작 ====================
Write-Log "1. 서버 프로세스 종료 중..."

# 포트 5000을 사용하는 프로세스 종료
$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
foreach ($netLine in $netLines) {
    $pid_ = ($netLine.ToString().Trim() -split "\s+")[-1]
    if ($pid_ -match "^\d+$" -and $pid_ -ne "0") {
        Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue
        Write-Log "   서버 PID $pid_ 종료"
    }
}

# server.py 또는 main.py를 실행 중인 python 프로세스 종료
Get-WmiObject Win32_Process | Where-Object {
    ($_.CommandLine -like "*server.py*" -or $_.CommandLine -like "*main.py*") -and $_.Name -like "*python*"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Log "   서버 프로세스 PID $($_.ProcessId) 종료 ($($_.CommandLine))"
}

Start-Sleep -Seconds 3

# 서버 시작
$ServerScript = Join-Path $ProjectDir "server.py"
Start-Process -FilePath $PythonExe -ArgumentList "`"$ServerScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
Write-Log "   서버 시작 완료"

Start-Sleep -Seconds 5

# 서버 상태 확인 (포트 + HTTP 응답)
$listening = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($listening) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Log "   서버 HTTP $($resp.StatusCode) 정상 확인"
    } catch {
        Write-Log "   [경고] 서버 포트 열림, HTTP 응답 없음"
    }
} else {
    Write-Log "   [경고] 서버 포트 5000 리스닝 안됨!"
}

# ==================== 2. Uploader 재시작 ====================
Write-Log "2. Uploader 프로세스 종료 중..."

# auto_github_uploader를 실행 중인 python 프로세스 종료
Get-WmiObject Win32_Process | Where-Object {
    $_.CommandLine -like "*auto_github_uploader*" -and $_.Name -like "*python*"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Log "   Uploader PID $($_.ProcessId) 종료"
}

Start-Sleep -Seconds 2

# Uploader 시작
$UploaderScript = Join-Path $ProjectDir "auto_github_uploader.py"
Start-Process -FilePath $PythonExe -ArgumentList "`"$UploaderScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
Write-Log "   Uploader 시작 완료"

Start-Sleep -Seconds 3

# Uploader 상태 확인
$uploaderProc = Get-WmiObject Win32_Process | Where-Object {
    $_.CommandLine -like "*auto_github_uploader*" -and $_.Name -like "*python*"
}
if ($uploaderProc) {
    Write-Log "   Uploader PID $($uploaderProc.ProcessId) 정상 실행 확인"
} else {
    Write-Log "   [경고] Uploader 프로세스가 실행되지 않음!"
}

Write-Log "===== 정기 재시작 완료 ====="
