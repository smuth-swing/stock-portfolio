@echo off
chcp 65001 >nul
echo ==========================================
echo        GitHub 클라우드 자동 업로드
echo ==========================================
echo.
echo 1. 엑셀 데이터를 JSON으로 변환합니다...
set PYTHON_EXE=C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe
"%PYTHON_EXE%" "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\export_to_json.py"
if %errorlevel% neq 0 (
    echo [오류] 데이터 변환 실패!
    pause
    exit /b
)

echo.
echo 2. 모바일 앱 파일을 준비합니다...
xcopy "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\StockPortfolioApp\dist" "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\mobile" /E /I /Y
xcopy "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\StockPortfolioApp\public\data" "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\mobile\data" /E /I /Y

echo.
echo 3. GitHub에 데이터를 업로드합니다...
pushd "c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
git add .
git commit -m "Auto update data %date% %time%"
git push origin main
popd

echo.
echo ==========================================
echo [완료] 성공적으로 클라우드에 업로드되었습니다!
echo 스마트폰에서 주식 앱을 새로고침해 보세요.
echo 주소: https://smuth-swing.github.io/stock-portfolio
echo ==========================================
pause
