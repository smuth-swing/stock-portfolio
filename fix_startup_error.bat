@echo off
NET SESSION >nul 2>&1
if %errorLevel% == 0 (
    echo Administrative permissions confirmed.
) else (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Fixing scheduled tasks...
powershell -ExecutionPolicy Bypass -File "%~dp0fix_tasks_admin.ps1"
