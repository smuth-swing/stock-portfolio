# on_resume_check.ps1 — 절전/최대절전 복귀 시 서버 + Uploader 확인 및 재시작
# StockApp_OnResume 태스크에 의해 실행됨

$ProjectDir = $PSScriptRoot
$PythonExe  = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$LogFile    = Join-Path $ProjectDir "resume_log.txt"

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

Write-Log "===== 절전 복귀 확인 시작 ====="

# 복귀 직후 네트워크 안정화 대기
Start-Sleep -Seconds 5

# ==================== 1. 서버 확인 ====================
$listening = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }

if ($listening) {
    # HTTP 응답 확인
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Log "서버 정상 (HTTP $($resp.StatusCode))"
    } catch {
        Write-Log "[경고] 서버 포트 열림, HTTP 응답 없음. 재시작 중..."
        # 좀비 프로세스 정리 (포트 기반)
        $netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
        foreach ($netLine in $netLines) {
            $pid_ = ($netLine.ToString().Trim() -split "\s+")[-1]
            if ($pid_ -match "^\d+$" -and $pid_ -ne "0") {
                Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue
                Write-Log "   좀비 PID $pid_ 종료"
            }
        }
        # 좀비 프로세스 정리 (프로세스명 기반 — main.py 포함)
        Get-WmiObject Win32_Process | Where-Object {
            ($_.CommandLine -like "*server.py*" -or $_.CommandLine -like "*main.py*") -and $_.Name -like "*python*"
        } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Log "   좀비 프로세스 PID $($_.ProcessId) 종료"
        }
        Start-Sleep -Seconds 2
        $ServerScript = Join-Path $ProjectDir "server.py"
        Start-Process -FilePath $PythonExe -ArgumentList "`"$ServerScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
        Write-Log "   서버 재시작 완료"
    }
} else {
    Write-Log "[경고] 서버 다운. 시작 중..."
    $ServerScript = Join-Path $ProjectDir "server.py"
    Start-Process -FilePath $PythonExe -ArgumentList "`"$ServerScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
    Start-Sleep -Seconds 5
    $recheck = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
    if ($recheck) { Write-Log "   서버 시작 성공 (포트 5000)" }
    else { Write-Log "   [오류] 서버 시작 실패" }
}

# ==================== 2. Uploader 확인 ====================
$uploaderProc = Get-WmiObject Win32_Process | Where-Object {
    $_.CommandLine -like "*auto_github_uploader*" -and $_.Name -like "*python*"
}

if ($uploaderProc) {
    Write-Log "Uploader 정상 실행 중 (PID $($uploaderProc.ProcessId))"
} else {
    Write-Log "[경고] Uploader 미실행. 시작 중..."
    $UploaderScript = Join-Path $ProjectDir "auto_github_uploader.py"
    Start-Process -FilePath $PythonExe -ArgumentList "`"$UploaderScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
    $recheck = Get-WmiObject Win32_Process | Where-Object {
        $_.CommandLine -like "*auto_github_uploader*" -and $_.Name -like "*python*"
    }
    if ($recheck) { Write-Log "   Uploader 시작 성공 (PID $($recheck.ProcessId))" }
    else { Write-Log "   [오류] Uploader 시작 실패" }
}

Write-Log "===== 절전 복귀 확인 완료 ====="
