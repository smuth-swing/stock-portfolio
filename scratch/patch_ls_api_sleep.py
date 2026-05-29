import sys
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import requests\n        resp = requests.post(', 'import requests\n        import time\n        time.sleep(1)\n        resp = requests.post(')

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(content)