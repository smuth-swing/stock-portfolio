import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, fetch_trade_history

cfg = load_config()

trades = fetch_trade_history(cfg['account'], cfg['account_pw'], '20260527', '20260527')
print("Fetched:", len(trades))
for t in trades[:5]:
    print(t)