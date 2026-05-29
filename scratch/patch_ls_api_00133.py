import sys
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('if "rsp_cd" in result and result["rsp_cd"] not in ("00000", "00136"):', 'if "rsp_cd" in result and result["rsp_cd"] not in ("00000", "00136", "00133", "00200"):')

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(content)