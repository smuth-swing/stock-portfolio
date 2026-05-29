@echo off
chcp 65001 >nul
setlocal

set TASK_NAME=StockPortfolioHealthCheck
set PS1_FILE=C:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1
set TR_CMD=powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File "%PS1_FILE%"

echo =============================================
echo   서버 헬스체크 스케줄러 등록 (70분 반복)
echo =============================================
echo.

:: 기존 작업 삭제
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: 70분마다 반복 등록
schtasks /create /tn "%TASK_NAME%" ^
    /tr "%TR_CMD%" ^
    /sc MINUTE /mo 70 ^
    /rl HIGHEST ^
    /f

if %errorlevel% equ 0 (
    echo.
    echo [성공] 스케줄러 등록 완료!
    echo.
    schtasks /query /tn "%TASK_NAME%" /fo LIST
    echo.
    echo 지금 바로 실행 테스트:
    schtasks /run /tn "%TASK_NAME%"
    echo [실행됨] 5초 후 server_health.log 확인하세요.
) else (
    echo.
    echo [오류] 등록 실패 - 관리자 권한으로 실행해주세요.
    echo 이 파일을 우클릭 후 "관리자 권한으로 실행" 선택
)

endlocal
pause
