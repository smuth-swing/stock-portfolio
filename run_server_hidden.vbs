Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & strPath & "\run_server.bat" & chr(34) & " nopause", 0
Set WshShell = Nothing
Set fso = Nothing
