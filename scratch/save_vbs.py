path = r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_health_check_hidden.vbs'
content = '''Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File """ & Chr(34) & "C:\\Users\\zerod\\.antigravity\\주식 포트폴리오 관리\\check_and_restart_server.ps1" & Chr(34) & """", 0, False
Set WshShell = Nothing
'''
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('VBS saved:', path)