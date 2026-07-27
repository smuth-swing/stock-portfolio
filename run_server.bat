@echo off
pushd "%~dp0"
set PYTHON_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe
set PYTHONW_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\pythonw.exe
set SERVER_SCRIPT=server.py

:: Port check (simplified)
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 exit /b

:: Kill existing auto_github_uploader to avoid duplicates (숨김 실행)
wscript //nologo "%~dp0kill_uploader_hidden.vbs" >nul 2>&1

:: Start auto_github_uploader in background (pythonw로 숨김 실행)
start /B "" "%PYTHONW_EXE%" auto_github_uploader.py

:: Run server
"%PYTHON_EXE%" "%SERVER_SCRIPT%" >> server_log.txt 2>&1
popd
