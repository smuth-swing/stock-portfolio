import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL, get_stock_name
import requests

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 't0424',
    'tr_cont': 'N',
    'tr_cont_key': '',
    'mac_address': ''
}
body = {
    't0424InBlock': {
        'prcgb': '1',
        'chegb': '2',
        'dangb': '0',
        'charge': '1',
        'cts_expcode': '',
        'accno': '200294331201',
        'passwd': cfg['account_pw']
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
raw = res.get('t0424OutBlock1', [])
print("보유 종목 잔고:")
for r in raw:
    code = r.get('expcode', '')
    name = get_stock_name(token, code)
    print(f"{name}({code}) | 잔고수량:{r.get('janqty')} | 매수단가:{r.get('pamt')} | 평가손익:{r.get('dtsunik')}")