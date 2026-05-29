import subprocess, os

content = r"""
$ProjectDir   = $PSScriptRoot
$PythonExe    = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$ServerScript = Join-Path $ProjectDir "server.py"
$LogFile      = Join-Path $ProjectDir "server_health.log"

if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 512000) {
    Set-Content -Path $LogFile -Value "" -Encoding UTF8
}

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

Write-Log "===== Health check start ====="

$listening = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }

if ($listening) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Log ("OK - Server running HTTP " + $resp.StatusCode)
    } catch {
        Write-Log "WARN - Port open but no HTTP. Restarting..."
        $netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
        foreach ($netLine in $netLines) {
            $pid_ = ($netLine.ToString().Trim() -split "\s+")[-1]
            if ($pid_ -match "^\d+$" -and $pid_ -ne "0") {
                Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue
                Write-Log ("Killed PID " + $pid_)
            }
        }
        Start-Sleep -Seconds 2
        Start-Process -FilePath $PythonExe -ArgumentList ("`"" + $ServerScript + "`"") -WorkingDirectory $ProjectDir -WindowStyle Hidden
        Write-Log "Restarted"
    }
} else {
    Write-Log "ALERT - Server down. Starting..."
    Start-Process -FilePath $PythonExe -ArgumentList ("`"" + $ServerScript + "`"") -WorkingDirectory $ProjectDir -WindowStyle Hidden
    Start-Sleep -Seconds 6
    $recheck = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
    if ($recheck) { Write-Log "SUCCESS - Restarted on port 5000" }
    else { Write-Log "ERROR - Restart failed" }
}

Write-Log "===== Health check done ====="
""".strip()

out_path = r"C:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"Saved: {out_path}")
print(f"Size: {os.path.getsize(out_path)} bytes")
