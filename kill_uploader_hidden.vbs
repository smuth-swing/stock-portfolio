' kill_uploader_hidden.vbs — 기존 auto_github_uploader 프로세스를 숨김 모드로 종료
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -Command ""Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'auto_github_uploader.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True
Set WshShell = Nothing
