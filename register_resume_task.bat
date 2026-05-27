@echo off
:: 절전 복귀 자동 복구 작업 스케줄러 등록 (관리자 권한 자동 요청)
:: 이 파일을 더블클릭하면 UAC 창이 뜨고, 허용하면 자동 등록됩니다.

:: 관리자 권한 자동 요청
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 관리자 권한으로 재실행 중...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 관리자 권한으로 PowerShell 스크립트 실행
powershell.exe -ExecutionPolicy Bypass -NonInteractive -File "%~dp0register_resume_task.ps1"

pause
