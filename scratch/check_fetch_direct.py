import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import fetch_trade_history

try:
    trades = fetch_trade_history('20260522', '20260529')
    print("Fetched:", len(trades))
except Exception as e:
    print(e)