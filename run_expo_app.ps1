[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       아이폰 주식 앱(Expo) 테스트 서버를 시작합니다." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/2] 내부 데이터 서버 시작 중 (PC 내부에서 데이터 연동)..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m", "http.server", "8080", "-d", "C:\Users\zerod\OneDrive\주식앱데이터"

Write-Host ""
Write-Host "[2/2] 앱 빌드 서버 준비 완료!" -ForegroundColor Green
Write-Host " 1. 아이폰 App Store에서 'Expo Go' 앱을 미리 설치해주세요."
Write-Host " 2. PC와 아이폰이 같은 와이파이(공유기)에 연결되어야 합니다."
Write-Host " 3. 잠시 후 화면에 나타나는 QR 코드를 아이폰 카메라로 스캔하세요."
Write-Host ""
Write-Host " ※ 종료하시려면 터미널 창을 닫거나 Ctrl+C를 누르시면 됩니다."
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path "$PSScriptRoot\StockPortfolioApp"
npx expo start --lan
