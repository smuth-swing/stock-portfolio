' run_server_hidden.vbs — 서버를 완전히 숨김 모드로 실행 (콘솔 창 없음)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' pythonw.exe 사용 (콘솔 창을 열지 않는 Python 실행 파일)
strPythonW = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\pythonw.exe"
strServer = strPath & "\server.py"
strLogFile = strPath & "\server_log.txt"

' pythonw.exe로 서버 실행 — 출력을 로그로 리다이렉트
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c """ & strPythonW & """ """ & strServer & """ >> """ & strLogFile & """ 2>&1", 0, False

Set fso = Nothing
Set WshShell = Nothing
