# 절전 복귀 시 자동 실행: Flask 서버 및 ngrok 상태 확인 및 복구
param()
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $ScriptDir "resume_log.txt"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param($msg)
    $line = "[$ts] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Write-Log "=== 절전 복귀 감지 ==="

# 네트워크 초기화 대기
Start-Sleep -Seconds 5

# Flask 서버 상태 확인
$portCheck = netstat -ano 2>$null | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if (-not $portCheck) {
    Write-Log "[복구] Flask 서버 다운 감지 -> 재시작 중"
    $vbsPath = Join-Path $ScriptDir "run_server_hidden.vbs"
    if (Test-Path $vbsPath) {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WorkingDirectory $ScriptDir
        Start-Sleep -Seconds 8
        Write-Log "[복구] Flask 재시작 요청 완료"
    } else {
        Write-Log "[경고] run_server_hidden.vbs 파일을 찾을 수 없음"
    }
} else {
    Write-Log "[정상] Flask 서버 실행 중"
}

# ngrok 터널 상태 확인
try {
    $null = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
    Write-Log "[정상] ngrok 터널 활성"
} catch {
    Write-Log "[복구] ngrok 터널 다운 감지 -> 재시작 중"
    Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    $ngrokPath = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
    if ($ngrokPath) {
        Start-Process -FilePath $ngrokPath -ArgumentList "http 5000" -WindowStyle Hidden
        Write-Log "[복구] ngrok 재시작 완료"
    } else {
        Write-Log "[경고] ngrok 명령어를 찾을 수 없음 (PATH 확인 필요)"
    }
}

# GitHub 자동 업로더 상태 확인
$uploaderRunning = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "auto_github_uploader\.py"
}
if (-not $uploaderRunning) {
    Write-Log "[복구] GitHub 자동 업로더 다운 감지 -> 재시작 중"
    $uploaderVbs = Join-Path $ScriptDir "run_auto_uploader_hidden.vbs"
    if (Test-Path $uploaderVbs) {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$uploaderVbs`"" -WorkingDirectory $ScriptDir
        Start-Sleep -Seconds 5
        # 재시작 확인
        $uploaderCheck = Get-CimInstance Win32_Process | Where-Object {
            $_.CommandLine -match "auto_github_uploader\.py"
        }
        if ($uploaderCheck) {
            Write-Log "[복구] GitHub 자동 업로더 재시작 성공 (PID: $($uploaderCheck.ProcessId))"
        } else {
            Write-Log "[경고] GitHub 자동 업로더 재시작 실패 - 수동 확인 필요"
        }
    } else {
        Write-Log "[경고] run_auto_uploader_hidden.vbs 파일을 찾을 수 없음"
    }
} else {
    Write-Log "[정상] GitHub 자동 업로더 실행 중 (PID: $($uploaderRunning.ProcessId))"
}

Write-Log "=== 복구 점검 완료 ==="
