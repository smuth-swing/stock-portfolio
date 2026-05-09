$currentDir = $PSScriptRoot
if (-not $currentDir) { $currentDir = Get-Location }

$target = Join-Path $currentDir "run_server_hidden.vbs"
$shortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\StockPortfolioServer.lnk"

# 절대 경로 확보 (한글 경로 처리 강화)
$targetPath = [System.IO.Path]::GetFullPath($target)
$workDir = [System.IO.Path]::GetFullPath($currentDir)

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $workDir
$shortcut.Description = "Stock Portfolio Management Server"
$shortcut.Save()

Write-Host "Success: Startup shortcut created at $shortcutPath"
Write-Host "Target: $targetPath"
Write-Host "WorkDir: $workDir"
