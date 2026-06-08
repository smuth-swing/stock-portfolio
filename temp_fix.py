content = """# 서버 재시작 스크립트 (매일 21:10 자동 실행용)
$ProjectDir = "C:\\Users\\zerod\\.antigravity\\주식 포트폴리오 관리"
$TaskName   = "StockPortfolioServer"
$LogFile    = Join-Path $ProjectDir "restart_log.txt"

function Write-Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

Write-Log "===== 서버 자동 재시작 시작 ====="
schtasks /end /tn $TaskName *>&1 | Out-Null
Start-Sleep -Seconds 2

$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($netLines) {
    foreach ($netLine in $netLines) {
        $procPid = ($netLine.ToString().Trim() -split "\s+")[-1]
        if ($procPid -match "^\d+$" -and $procPid -ne "0") {
            Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 3

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Start-ScheduledTask -TaskName $TaskName
} else {
    $PythonExe = "C:\\Users\\zerod\\AppData\\Local\\Programs\\Python\\Python312\\python.exe"
    $Script    = Join-Path $ProjectDir "server.py"
    Start-Process -FilePath $PythonExe -ArgumentList "`"$Script`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
}
Write-Log "===== 서버 자동 재시작 완료 ====="
"""

with open('restart_server.ps1', 'w', encoding='utf-8-sig') as f:
    f.write(content)
