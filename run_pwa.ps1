# 로컬 PC 주식 포트폴리오 웹 대시보드 및 서버 실행 스크립트
# ========================================================
# - 로컬 PC용 뷰어(index.html) 및 API(server.py) 실행
# - 모바일 접속은 GitHub Pages를 사용하므로 로컬에선 서버만 띄웁니다.

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  주식 체크 리스트 로컬 서버 실행" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 포트 중복 검사
$portCheck = netstat -ano | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if ($portCheck) {
    Write-Host "  [경고] 5000번 포트가 이미 사용 중입니다!" -ForegroundColor Yellow
    Write-Host "  기존에 실행된 서버가 있다면 먼저 종료해주세요." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[시작] 로컬 API 서버(server.py)를 구동합니다..." -ForegroundColor Green
Write-Host "종료하려면 이 창을 닫거나 Ctrl+C를 누르세요." -ForegroundColor Gray
Write-Host ""

# Flask 서버 직접 실행
python server.py

Read-Host "종료하려면 엔터를 누르세요..."
