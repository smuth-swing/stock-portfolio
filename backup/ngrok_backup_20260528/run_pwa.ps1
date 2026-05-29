# PWA 빌드 & 서빙 실행 스크립트 (더블클릭으로 실행)
# ========================================================
# 1. Expo 웹 빌드 (dist/ 폴더 생성)
# 2. JSON 데이터 복사
# 3. Flask 서버 + ngrok 터널 자동 시작

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  주식 포트폴리오 PWA 앱 실행기" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 최초 1회: Expo 빌드 여부 확인
$distExists = Test-Path "StockPortfolioApp\dist\index.html"

if (-not $distExists) {
    Write-Host "[1/3] Expo 웹 빌드 시작..." -ForegroundColor Yellow
    Write-Host "  (처음 실행 시 수 분이 걸릴 수 있습니다)" -ForegroundColor Gray
    Set-Location "StockPortfolioApp"
    npx expo export --platform web
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[오류] 빌드 실패!" -ForegroundColor Red
        Read-Host "엔터를 눌러 종료"
        exit 1
    }
    Set-Location $ScriptDir
    Write-Host "[OK] 빌드 완료" -ForegroundColor Green
} else {
    Write-Host "[1/3] 기존 빌드 사용 (dist/ 폴더 존재)" -ForegroundColor Gray
    Write-Host "  새로 빌드하려면 StockPortfolioApp\dist 폴더를 삭제하세요" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2/3] 데이터 JSON 복사 중..." -ForegroundColor Yellow

# JSON 데이터 파일 복사 (public/data → dist/data)
$srcData = "StockPortfolioApp\public\data"
$dstData = "StockPortfolioApp\dist\data"
if (-not (Test-Path $dstData)) { New-Item -ItemType Directory -Path $dstData | Out-Null }
if (Test-Path $srcData) {
    Copy-Item "$srcData\*.json" $dstData -Force -ErrorAction SilentlyContinue
    Write-Host "  JSON 데이터 복사 완료" -ForegroundColor Green
}

# sw.js, manifest.json 복사 (public → dist)
foreach ($f in @("sw.js", "manifest.json")) {
    $src = "StockPortfolioApp\public\$f"
    $dst = "StockPortfolioApp\dist\$f"
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  $f 복사 완료" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[3/3] ngrok 터널 시작..." -ForegroundColor Yellow
Write-Host "  (URL이 출력되면 아이폰 Safari에서 접속하세요)" -ForegroundColor Gray

# 서버 정상 실행 여부 확인
$portCheck = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($portCheck) {
    Write-Host "  [OK] 서버 포트 5000 안정 실행 중 (스케줄러 관리)" -ForegroundColor Green
} else {
    Write-Host "  [주의] 서버가 실행중이지 않으면 자동으로 시작합니다." -ForegroundColor Yellow
}
Write-Host ""

# 서버가 이미 실행 중이면 --skip-server 사용 (포트 충돌 방지)
if ($portCheck) {
    python build_and_serve_pwa.py --skip-build --skip-server
} else {
    python build_and_serve_pwa.py --skip-build
}

Read-Host "엔터를 눌러 종료"
