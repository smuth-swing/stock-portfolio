Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File """ & Chr(34) & "C:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1" & Chr(34) & """", 0, False
Set WshShell = Nothing
