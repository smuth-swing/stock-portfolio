@echo off
pushd "%~dp0"
set PYTHON_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe
set SERVER_SCRIPT=server.py

:: Port check (simplified)
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 exit /b

:: Run server
"%PYTHON_EXE%" "%SERVER_SCRIPT%" >> server_log.txt 2>&1
popd
