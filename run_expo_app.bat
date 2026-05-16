@echo off
chcp 65001 > nul
echo ========================================================
echo        아이폰 주식 앱(Expo) 서버를 켭니다.
echo ========================================================
echo.
cd /d "%~dp0StockPortfolioApp"
npx expo start --lan
pause
