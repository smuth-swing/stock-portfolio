' run_server_hidden.vbs ? 서버를 완전히 숨김 모드로 실행 (콘솔 창 없음)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' python.exe 사용 (콘솔 창 없이 숨김 모드 실행 + 로그 리다이렉트)
strPython = "C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
strServer = strPath & "\server.py"
strLogFile = strPath & "\server_log.txt"

' python.exe로 서버 실행 ? 출력을 로그로 리다이렉트
' cmd /c 로 실행 시 첫번째/마지막 따옴표 제거 방지를 위해 전체 명령줄을 따옴표로 감쌈
WshShell.CurrentDirectory = strPath
cmdLine = "cmd /c """"" & strPython & """ """ & strServer & """ >> """ & strLogFile & """ 2>&1"""
WshShell.Run cmdLine, 0, False

Set fso = Nothing
Set WshShell = Nothing