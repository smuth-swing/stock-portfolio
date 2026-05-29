import sys, re
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('token = get_access_token(CONFIG["app_key"], CONFIG["app_secret"])', 'cfg = load_config()\n    token = get_access_token(cfg["app_key"], cfg["app_secret"])')

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(content)