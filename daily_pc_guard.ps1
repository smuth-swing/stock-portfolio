[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
$ProjectDir = $PSScriptRoot
$OneDriveDir = Join-Path $env:USERPROFILE 'OneDrive'
$BackupRoot = 'F:\Windows11_Backup_2026-10-05'
$BackupDir = Join-Path $BackupRoot 'DailyMirror'
$LogDir = Join-Path $BackupRoot 'maintenance'
$LogFile = Join-Path $LogDir 'daily_pc_guard.log'
$ReportFile = Join-Path $ProjectDir 'daily_pc_guard_latest.json'

New-Item -ItemType Directory -Path $BackupDir,$LogDir -Force | Out-Null

function Write-GuardLog {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Test-LocalHttp {
    param([string]$Url)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $sw.Stop()
        return [ordered]@{ url=$Url; ok=$true; status=[int]$response.StatusCode; ms=[math]::Round($sw.Elapsed.TotalMilliseconds,1) }
    } catch {
        $sw.Stop()
        return [ordered]@{ url=$Url; ok=$false; status=$null; ms=[math]::Round($sw.Elapsed.TotalMilliseconds,1); error=$_.Exception.Message }
    }
}

Write-GuardLog '===== Daily PC guard start ====='
$result = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    computer = $env:COMPUTERNAME
    os = $null
    storage = @{}
    performance = @{}
    services = @()
    startup = @()
    logs = @()
    backup = @()
}

try {
    $osInfo = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $result.os = [ordered]@{
        product=$osInfo.ProductName
        displayVersion=$osInfo.DisplayVersion
        build=$osInfo.CurrentBuildNumber
        ubr=$osInfo.UBR
    }
} catch { Write-GuardLog "OS read failed: $($_.Exception.Message)" }

foreach ($drive in @('C','F')) {
    try {
        $volume = Get-Volume -DriveLetter $drive -ErrorAction Stop
        $freePct = if ($volume.Size) { [math]::Round(($volume.SizeRemaining / $volume.Size) * 100,1) } else { $null }
        $result.storage[$drive] = [ordered]@{
            health=$volume.HealthStatus.ToString()
            freeGB=[math]::Round($volume.SizeRemaining/1GB,1)
            totalGB=[math]::Round($volume.Size/1GB,1)
            freePercent=$freePct
        }
        if ($drive -eq 'C' -and $freePct -lt 15) { Write-GuardLog "WARN: C drive free space is $freePct%" }
        if ($drive -eq 'F' -and $freePct -lt 15) { Write-GuardLog "WARN: F backup drive free space is $freePct%" }
    } catch { Write-GuardLog "Drive $drive read failed: $($_.Exception.Message)" }
}

try {
    $samples = Get-Counter '\Processor(_Total)\% Processor Time','\Memory\Available MBytes' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop
    foreach ($sample in $samples.CounterSamples) {
        if ($sample.Path -match 'processor') { $result.performance.cpuPercent=[math]::Round($sample.CookedValue,1) }
        if ($sample.Path -match 'available mbytes') { $result.performance.availableMemoryMB=[math]::Round($sample.CookedValue,0) }
    }
} catch { Write-GuardLog "Performance counter read failed: $($_.Exception.Message)" }

$result.services += Test-LocalHttp 'http://127.0.0.1:5000/'
$result.services += Test-LocalHttp 'http://127.0.0.1:5000/api/onedrive-status'
$result.services += Test-LocalHttp 'http://127.0.0.1:8000/'
foreach ($service in $result.services) {
    if ($service.ok) { Write-GuardLog "OK: $($service.url) HTTP $($service.status) in $($service.ms)ms" }
    else { Write-GuardLog "WARN: $($service.url) failed" }
}

try {
    $startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    $shell = New-Object -ComObject WScript.Shell
    foreach ($shortcutFile in Get-ChildItem -LiteralPath $startupDir -Filter '*.lnk' -File -ErrorAction SilentlyContinue) {
        $shortcut = $shell.CreateShortcut($shortcutFile.FullName)
        $entry = [ordered]@{ name=$shortcutFile.Name; target=$shortcut.TargetPath; targetExists=(Test-Path -LiteralPath $shortcut.TargetPath) }
        $result.startup += $entry
        if (-not $entry.targetExists) { Write-GuardLog "WARN: broken startup link $($shortcutFile.Name)" }
    }
} catch { Write-GuardLog "Startup link check failed: $($_.Exception.Message)" }

foreach ($logName in @('server_health.log','resume_log.txt','upload_log.txt','restart_log.txt')) {
    $logPath = Join-Path $ProjectDir $logName
    if (Test-Path -LiteralPath $logPath) {
        $item = Get-Item -LiteralPath $logPath
        $result.logs += [ordered]@{ name=$logName; sizeMB=[math]::Round($item.Length/1MB,1); lastWrite=$item.LastWriteTime.ToString('o') }
        if ($item.Length -gt 20MB) { Write-GuardLog "WARN: log file is large: $logName" }
    }
}

if ((Test-Path -LiteralPath $OneDriveDir) -and (Test-Path -LiteralPath 'F:\')) {
    foreach ($pair in @(
        @{ Source=$OneDriveDir; Destination=(Join-Path $BackupDir 'OneDrive') },
        @{ Source=$ProjectDir; Destination=(Join-Path $BackupDir 'PortfolioProject') }
    )) {
        Write-GuardLog "Backup start: $($pair.Source)"
        & robocopy.exe $pair.Source $pair.Destination /E /XO /FFT /Z /R:2 /W:5 /COPY:DAT /DCOPY:DAT /XJ /NP /NFL /NDL /LOG+:$LogFile | Out-Null
        $code = $LASTEXITCODE
        $ok = $code -le 7
        $result.backup += [ordered]@{ source=$pair.Source; destination=$pair.Destination; robocopyCode=$code; ok=$ok }
        if ($ok) { Write-GuardLog "Backup done: code $code" } else { Write-GuardLog "ERROR: backup failed with code $code" }
    }
} else {
    Write-GuardLog 'WARN: OneDrive or F drive is unavailable; backup skipped.'
    $result.backup += [ordered]@{ ok=$false; error='OneDrive or F drive unavailable' }
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportFile -Encoding UTF8
Write-GuardLog "Report written: $ReportFile"
Write-GuardLog '===== Daily PC guard done ====='
