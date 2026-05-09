$WshShell = New-Object -comObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupFolder\StockPortfolioServer.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"C:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_server_hidden.vbs`""
$Shortcut.WorkingDirectory = "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
$Shortcut.WindowStyle = 1
$Shortcut.Description = "Start Stock Portfolio Server Hidden"
$Shortcut.Save()
Write-Host "Startup shortcut created successfully."
