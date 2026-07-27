@echo off
chcp 65001 >nul
setlocal

set TASK_NAME=StockPortfolioServer
set PROJECT_DIR=C:\Users\zerod\.antigravity\주식 포트폴리오 관리
set VBS_FILE=%PROJECT_DIR%\run_server_hidden.vbs
set STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StockPortfolioServer.lnk

:: 기존 스케줄러 작업 삭제
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: 기존 스타트업 단축키 삭제 (충돌 방지)
if exist "%STARTUP_LNK%" (
    del /f "%STARTUP_LNK%"
    echo [OK] 기존 스타트업 단축키 삭제됨
)

:: 작업 스케줄러 등록 (VBS 래퍼를 통해 숨김 실행)
schtasks /create /tn "%TASK_NAME%" ^
    /tr "wscript.exe \"%VBS_FILE%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /f

if %errorlevel% equ 0 (
    echo [OK] 작업 스케줄러 등록 성공! (콘솔 창 없이 실행)
    echo.
    echo [INFO] 서버를 시작합니다...
    schtasks /run /tn "%TASK_NAME%"
    echo [INFO] 서버 시작됨. 4초 대기중...
    timeout /t 4 /nobreak >nul
    netstat -ano | findstr :5000 | findstr LISTENING
    if %errorlevel% equ 0 (
        echo [SUCCESS] 서버가 포트 5000에서 실행 중!
        echo [INFO] 브라우저에서: http://localhost:5000
    ) else (
        echo [WAIT] 서버가 아직 시작 중입니다. 잠시 후 http://localhost:5000 확인.
    )
) else (
    echo [ERROR] 작업 스케줄러 등록 실패.
)

endlocal
pause
