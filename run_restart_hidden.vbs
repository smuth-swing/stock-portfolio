' run_restart_hidden.vbs — 서버 재시작 스크립트를 완전히 숨김 모드로 실행 (PowerShell 창 없음)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

strPS1 = strPath & "\restart_server.ps1"

' PowerShell을 완전 숨김으로 실행
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File """ & strPS1 & """", 0, False

Set fso = Nothing
Set WshShell = Nothing
