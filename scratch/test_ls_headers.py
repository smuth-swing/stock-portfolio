import sys
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
from datetime import datetime, timedelta

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])
to_date = datetime.now().strftime('%Y%m%d')
from_date = (datetime.now() - timedelta(days=365)).strftime('%Y%m%d') # 1년 조회

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 't0425',
    'tr_cont': 'N',
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
        'fromdate': from_date,
        'todate': to_date
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
print('HEADERS:')
for k, v in resp.headers.items():
    print(f'{k}: {v}')
    
result = resp.json()
print(f'RSP_CD: {result.get("rsp_cd")}')
print(f't0425OutBlock: {result.get("t0425OutBlock")}')
print(f'데이터 개수: {len(result.get("t0425OutBlock1", []))}')