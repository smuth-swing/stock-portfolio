' run_resume_hidden.vbs — 절전 복귀 확인 스크립트를 완전히 숨김 모드로 실행 (PowerShell 창 없음)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

strPS1 = strPath & "\on_resume_check.ps1"

' PowerShell을 완전 숨김으로 실행
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File """ & strPS1 & """", 0, False

Set fso = Nothing
Set WshShell = Nothing
