@echo off
echo ===================================
echo   서버 중지 스크립트 (테스트용)
echo ===================================
echo.
echo 현재 실행 중인 Python 서버 프로세스를 종료합니다...
taskkill /F /IM python.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    echo [성공] 서버가 중지되었습니다.
    echo 이제 대시보드에서 '저장' 버튼을 눌러 오류 팝업이 뜨는지 테스트해보세요!
) else (
    echo [알림] 실행 중인 Python 서버를 찾을 수 없습니다.
)
echo.
pause
