Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
strStartup = WshShell.SpecialFolders("Startup")
Set oShellLink = WshShell.CreateShortcut(strStartup & "\StockPortfolioServer.lnk")
oShellLink.TargetPath = "wscript.exe"
oShellLink.Arguments = """" & strPath & "\run_server_hidden.vbs"""
oShellLink.WorkingDirectory = strPath
oShellLink.WindowStyle = 1
oShellLink.Description = "Start Stock Portfolio Server Hidden"
oShellLink.Save
