@echo off
chcp 65001 >nul
setlocal

set TASK_NAME=StockPortfolioServer
set PYTHON_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe
set PROJECT_DIR=C:\Users\zerod\.antigravity\주식 포트폴리오 관리
set SERVER_PY=C:\Users\zerod\.antigravity\주식 포트폴리오 관리\server.py
set STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StockPortfolioServer.lnk

:: 기존 스케줄러 작업 삭제
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: 기존 스타트업 단축키 삭제 (충돌 방지)
if exist "%STARTUP_LNK%" (
    del /f "%STARTUP_LNK%"
    echo [OK] Old startup shortcut removed.
)

:: 작업 스케줄러 등록 (로그인 시 실행, 숨김 창)
schtasks /create /tn "%TASK_NAME%" ^
    /tr "\"%PYTHON_EXE%\" \"%SERVER_PY%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /f

if %errorlevel% equ 0 (
    echo [OK] Task scheduler registered successfully!
    echo.
    echo [INFO] Starting server now...
    schtasks /run /tn "%TASK_NAME%"
    echo [INFO] Server started. Waiting 4 seconds...
    timeout /t 4 /nobreak >nul
    netstat -ano | findstr :5000 | findstr LISTENING
    if %errorlevel% equ 0 (
        echo [SUCCESS] Server is running on port 5000!
        echo [INFO] Open browser: http://localhost:5000
    ) else (
        echo [WAIT] Server may still be starting up. Check http://localhost:5000 in a moment.
    )
) else (
    echo [ERROR] Failed to register task scheduler.
)

endlocal
pause
