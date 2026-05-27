@echo off
:: WOL(Wake-on-LAN) Windows 설정 자동 활성화
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 관리자 권한으로 재실행 중...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo WOL 관련 네트워크 어댑터 설정을 활성화합니다...
powershell -Command "Enable-NetAdapterPowerManagement -Name '*' -WakeOnMagicPacket Enabled -ErrorAction SilentlyContinue"
echo 설정이 완료되었습니다. (오류가 없다면 정상 적용된 것입니다.)
pause
