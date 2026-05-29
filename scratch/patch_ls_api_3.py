import sys, re
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('def fetch_trade_history(account, account_pw, from_date, to_date, stock_code=""):', 'def fetch_trade_history(from_date, to_date, stock_code=""):')
content = content.replace('cfg = load_config()', 'cfg = load_config()\n    account = cfg["account"]\n    account_pw = cfg["account_pw"]')

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(content)