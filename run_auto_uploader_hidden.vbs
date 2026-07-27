' run_auto_uploader_hidden.vbs — GitHub 자동 업로더를 완전히 숨김 모드로 실행 (콘솔 창 없음)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' pythonw.exe 사용 (콘솔 창을 열지 않는 Python 실행 파일)
strPythonW = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\pythonw.exe"
strUploader = strPath & "\auto_github_uploader.py"

WshShell.CurrentDirectory = strPath
WshShell.Run """" & strPythonW & """ """ & strUploader & """", 0, False

Set fso = Nothing
Set WshShell = Nothing
