# Re-register local OneDrive server task (Azure removed)
# Auto-elevate to Administrator
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
Write-Host "  Server Scheduler Setup (Local OneDrive)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Clean up existing tasks
foreach ($t in @("StockPortfolioServer", "StockPortfolioServer_Graph")) {
    $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask  -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
        Write-Host "[DELETE] $t" -ForegroundColor Yellow
    }
}

# Clean up port 5000 Python process
Write-Host "[CLEANUP] Stopping port 5000 process..." -ForegroundColor Yellow
$netLines = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
foreach ($netLine in $netLines) {
    $procPid = ($netLine.ToString().Trim() -split "\s+")[-1]
    if ($procPid -match "^\d+$" -and $procPid -ne "0") {
        $proc = Get-Process -Id ([int]$procPid) -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Killed PID $procPid ($($proc.Name))" -ForegroundColor Gray
        }
    }
}

Start-Sleep -Seconds 2

# Register new scheduler (server.py - Local OneDrive)
Write-Host ""
Write-Host "[REGISTER] Registering server.py scheduler..." -ForegroundColor Cyan

$Action    = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$Script`"" -WorkingDirectory $ProjectDir
$Trigger   = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopOnIdleEnd -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Stock Portfolio Local OneDrive Server (Port 5000)" -Force | Out-Null

Write-Host "[SUCCESS] Registration completed: $TaskName" -ForegroundColor Green
Write-Host "  Script: $Script" -ForegroundColor White
Write-Host ""

# Start task immediately
Write-Host "[START] Running server task immediately..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 6

$check = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($check) {
    Write-Host ""
    Write-Host "[SUCCESS] Server is running!" -ForegroundColor Green
    Write-Host "  PC Dashboard : http://localhost:5000"       -ForegroundColor White
    Write-Host "  Mobile PWA   : http://localhost:5000/mobile/" -ForegroundColor White
} else {
    Write-Host "[ERROR] Server failed to start. Check log:" -ForegroundColor Red
    Write-Host "  -> $(Join-Path $ProjectDir 'server_log.txt')" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Will automatically run on PC startup."      -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Start-Sleep -Seconds 3
