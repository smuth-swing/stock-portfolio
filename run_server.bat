@echo off
pushd "%~dp0"
set PYTHON_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe
set SERVER_SCRIPT=server.py

:: Port check (simplified)
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 exit /b

:: Kill existing auto_github_uploader to avoid duplicates
powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'auto_github_uploader.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

:: Start auto_github_uploader in background
start /B "" "%PYTHON_EXE%" auto_github_uploader.py >> upload_log.txt 2>&1

:: Run server
"%PYTHON_EXE%" "%SERVER_SCRIPT%" >> server_log.txt 2>&1
popd
