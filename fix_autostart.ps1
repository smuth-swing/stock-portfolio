$TaskName = "StockPortfolioServer"
$PythonExe = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
$ProjectDir = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$ServerScript = Join-Path $ProjectDir "server.py"

# 기존 작업 삭제
Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

# 작업 액션 정의
$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ServerScript`"" `
    -WorkingDirectory $ProjectDir

# 트리거: 로그인 시
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# 설정: 시간 제한 없음, 배터리 상관 없이 시작
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries

# 실행 주체: 현재 사용자, 최고 권한
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
    -Force

# 기존 스타트업 단축키 삭제 (충돌 방지)
$oldShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StockPortfolioServer.lnk"
if (Test-Path $oldShortcut) {
    Remove-Item $oldShortcut -Force
}

Write-Host "Success: Task registered and shortcut removed."
