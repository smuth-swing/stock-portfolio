import os, sys
try:
    import win32com.client
    shell = win32com.client.Dispatch('WScript.Shell')
    startup = shell.SpecialFolders('Startup')
    shortcut = shell.CreateShortCut(os.path.join(startup, 'StockPortfolioServer.lnk'))
    shortcut.Targetpath = 'wscript.exe'
    shortcut.Arguments = '"C:\\Users\\zerod\\.antigravity\\주식 포트폴리오 관리\\run_server_hidden.vbs"'
    shortcut.WorkingDirectory = 'C:\\Users\\zerod\\.antigravity\\주식 포트폴리오 관리'
    shortcut.WindowStyle = 1
    shortcut.save()
    print('Shortcut created successfully.')
except Exception as e:
    print(f"Error: {e}")
