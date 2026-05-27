Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.ExpandEnvironmentStrings("%USERPROFILE%\Desktop\클라우드 데이터 올리기.lnk")
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "c:\Users\zerod\.antigravity\주식 포트폴리오 관리\upload_to_cloud.bat"
oLink.IconLocation = "shell32.dll, 272"
oLink.Save
