$tasks = @(
    @{ Name="StockAutoGitHubUploader"; Exe="wscript.exe"; Args="`"c:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_auto_uploader_hidden.vbs`"" },
    @{ Name="StockPortfolioHealthCheck"; Exe="powershell.exe"; Args="-ExecutionPolicy Bypass -WindowStyle Hidden -File `"c:\Users\zerod\.antigravity\주식 포트폴리오 관리\check_and_restart_server.ps1`"" },
    @{ Name="StockPortfolioRestart"; Exe="powershell.exe"; Args="-ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File `"C:\Users\zerod\.antigravity\주식 포트폴리오 관리\restart_server.ps1`"" },
    @{ Name="StockApp_OnResume"; Exe="powershell.exe"; Args="-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"c:\Users\zerod\.antigravity\주식 포트폴리오 관리\on_resume_check.ps1`"" },
    @{ Name="StockPortfolioServer"; Exe="C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"; Args="`"C:\Users\zerod\.antigravity\주식 포트폴리오 관리\server.py`"" }
)

foreach ($t in $tasks) {
    $existing = Get-ScheduledTask -TaskName $t.Name -ErrorAction SilentlyContinue
    if ($existing) {
        $action = New-ScheduledTaskAction -Execute $t.Exe -Argument $t.Args
        Set-ScheduledTask -TaskName $t.Name -Action $action -ErrorAction Stop
        Write-Host "Fixed task: $($t.Name)" -ForegroundColor Green
    }
}

Write-Host "완료되었습니다. 아무 키나 누르시면 종료됩니다."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
