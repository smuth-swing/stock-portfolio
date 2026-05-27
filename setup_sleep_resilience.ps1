# ============================================================
# 절전 모드 탄력성 설정 스크립트
# - PC 절전은 허용하되, 앱 접근성을 유지/복구하기 위한 설정
# - 관리자 권한으로 실행 필요
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  절전 모드 탄력성 설정" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. 관리자 권한 확인 ──────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[오류] 관리자 권한이 필요합니다." -ForegroundColor Red
    Write-Host "  이 스크립트를 우클릭 → '관리자 권한으로 실행' 해주세요." -ForegroundColor Yellow
    Read-Host "엔터를 눌러 종료"
    exit 1
}

# ── 2. 네트워크 어댑터 절전 방지 설정 ───────────────────────
Write-Host "[1/3] 네트워크 어댑터 절전 방지 설정 중..." -ForegroundColor Yellow

# 모든 물리적 네트워크 어댑터 찾기
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -or $_.Status -eq "Disconnected" }

foreach ($adapter in $adapters) {
    $adapterName = $adapter.Name
    
    # '전원 관리 탭'에서 "전원을 절약하기 위해 이 장치 끄기 허용" 비활성화
    # 레지스트리 경로를 통해 설정
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4D36E972-E325-11CE-BFC1-08002bE10318}"
    $subkeys = Get-ChildItem -Path $regPath -ErrorAction SilentlyContinue
    
    foreach ($key in $subkeys) {
        $driverDesc = (Get-ItemProperty -Path $key.PSPath -Name "DriverDesc" -ErrorAction SilentlyContinue).DriverDesc
        if ($driverDesc -and $driverDesc -like "*$($adapter.InterfaceDescription.Split(' ')[0])*") {
            # PnPCapabilities 값 설정 (0x18 = 24 → "절전 시 끄기" 및 "Wake on magic packet" 비활성화 방지)
            # 0x00 = 기본값, 0x10 = "절전 복귀 허용 안함", 0x18 = 절전 시 끄기 방지
            Set-ItemProperty -Path $key.PSPath -Name "PnPCapabilities" -Value 24 -Type DWord -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "  ✅ $adapterName 절전 방지 설정 완료" -ForegroundColor Green
}

# ── 3. 절전 복귀 후 네트워크 빠른 초기화 설정 ───────────────
Write-Host ""
Write-Host "[2/3] 절전 복귀 후 네트워크 빠른 초기화 설정..." -ForegroundColor Yellow

# TCP/IP 재연결 타임아웃 최적화
$tcpPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters"
Set-ItemProperty -Path $tcpPath -Name "TcpTimedWaitDelay" -Value 30 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path $tcpPath -Name "MaxUserPort" -Value 65534 -Type DWord -ErrorAction SilentlyContinue

Write-Host "  ✅ TCP 재연결 타임아웃 최적화 완료" -ForegroundColor Green

# ── 4. 절전 복귀 후 서버 자동 복구 작업 등록 ────────────────
Write-Host ""
Write-Host "[3/3] 절전 복귀 후 서버 자동 복구 작업 등록..." -ForegroundColor Yellow

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$resumeScript = Join-Path $ScriptDir "on_resume_check.ps1"

# 복구 스크립트 생성
$resumeScriptContent = @'
# 절전 복귀 시 자동 실행: 서버 및 ngrok 상태 확인 및 복구
$ScriptDir = "SCRIPT_DIR_PLACEHOLDER"
$logFile = Join-Path $ScriptDir "resume_log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param($msg)
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Write-Log "=== 절전 복귀 감지 ==="

# 네트워크 연결 복구 대기 (NIC 재초기화 시간)
Start-Sleep -Seconds 5

# Flask 서버 상태 확인
$portCheck = netstat -ano 2>$null | Select-String ":5000 " | Where-Object { $_ -match "LISTENING" }
if (-not $portCheck) {
    Write-Log "[복구] Flask 서버 다운 감지 → 재시작 중..."
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$ScriptDir\run_server_hidden.vbs`"" -WorkingDirectory $ScriptDir
    Start-Sleep -Seconds 8
    Write-Log "[복구] Flask 서버 재시작 명령 전송 완료"
} else {
    Write-Log "[정상] Flask 서버 실행 중"
}

# ngrok 상태 확인 (ngrok API 포트 4040)
try {
    $ngrokCheck = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
    Write-Log "[정상] ngrok 터널 활성"
} catch {
    Write-Log "[복구] ngrok 터널 다운 감지 → 재시작 중..."
    # 기존 ngrok 프로세스 종료
    Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    # ngrok 재시작 (백그라운드)
    $ngrokPath = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
    if ($ngrokPath) {
        Start-Process -FilePath $ngrokPath -ArgumentList "http 5000" -WindowStyle Hidden
        Write-Log "[복구] ngrok 재시작 명령 전송 완료"
    } else {
        Write-Log "[경고] ngrok을 찾을 수 없습니다"
    }
}

Write-Log "=== 복구 점검 완료 ==="
'@

$resumeScriptContent = $resumeScriptContent -replace "SCRIPT_DIR_PLACEHOLDER", $ScriptDir
$resumeScriptContent | Out-File -FilePath $resumeScript -Encoding UTF8

# 작업 스케줄러: 절전 복귀 이벤트에 반응하는 트리거 등록
$taskName = "StockApp_OnResume"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Windows 이벤트 ID 107 = 절전 복귀 (System Resume from Sleep)
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$resumeScript`""

# 절전 복귀 이벤트 트리거 (이벤트 ID 107: System resumed from sleep)
$trigger = New-ScheduledTaskTrigger -AtLogOn  # 임시 트리거, 아래서 XML로 교체

# 작업 등록
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings | Out-Null

# 이벤트 기반 트리거로 수정 (절전 복귀: Log=System, Source=Microsoft-Windows-Power-Troubleshooter, EventID=1)
$task = Get-ScheduledTask -TaskName $taskName
$xmlTrigger = @"
<EventTrigger>
  <Enabled>true</Enabled>
  <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
  <Delay>PT5S</Delay>
</EventTrigger>
"@

$taskXml = [xml]($task | Export-ScheduledTask)
$ns = "http://schemas.microsoft.com/windows/2004/02/mit/task"
$triggersNode = $taskXml.Task.Triggers
$triggersNode.RemoveAll()
$importedNode = $taskXml.ImportNode(([xml]$xmlTrigger).DocumentElement, $true)
$triggersNode.AppendChild($importedNode) | Out-Null

$taskXml.Save("$env:TEMP\resume_task.xml")
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Xml (Get-Content "$env:TEMP\resume_task.xml" -Raw) | Out-Null

Write-Host "  ✅ 절전 복귀 자동 복구 작업 등록 완료 (작업 이름: $taskName)" -ForegroundColor Green

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  ✅ 설정 완료!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  적용된 설정:" -ForegroundColor White
Write-Host "  1. 네트워크 어댑터 절전 방지" -ForegroundColor Gray
Write-Host "  2. TCP 재연결 최적화" -ForegroundColor Gray
Write-Host "  3. 절전 복귀 시 서버/ngrok 자동 복구 (작업 스케줄러)" -ForegroundColor Gray
Write-Host ""
Write-Host "  ⚠️  NIC 설정 반영을 위해 재부팅을 권장합니다." -ForegroundColor Yellow
Write-Host ""

Read-Host "엔터를 눌러 종료"
