import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL, get_stock_name
import requests
from datetime import datetime

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])
today = datetime.now().strftime('%Y%m%d')

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 't0425',
    'tr_cont': 'N',
    'tr_cont_key': '',
    'mac_address': ''
}
body = {
    't0425InBlock': {
        'accno': cfg['account'],
        'passwd': cfg['account_pw'],
        'expcode': '',
        'chegb': '0',
        'medosu': '0',
        'sortgb': '1',
        'cts_ordno': '',
        'fromdate': today,
        'todate': today
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
raw = res.get('t0425OutBlock1', [])

print("조회된 주문 내역:")
for r in raw:
    code = r.get('expcode', '')
    name = get_stock_name(token, code)
    print(f"주문번호:{r.get('ordno')} | 종목:{name}({code}) | {r.get('medosu')} | 주문수량:{r.get('ordqty')} | 총체결수량:{r.get('cheqty')} | 단가:{r.get('price')} | 체결가:{r.get('cheprice')}")