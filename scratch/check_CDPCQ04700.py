import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
from datetime import datetime

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 'CDPCQ04700',
    'tr_cont': 'N',
    'mac_address': ''
}
body = {
    'CDPCQ04700InBlock1': {
        'QrySrtDt': '20260501',
        'QryEndDt': '20260529',
        'SellsBuyTpCode': '0',
        'AcntNo': '200294331201',
        'Pwd': cfg['account_pw'],
        'Pdno': '',
        'CtsOrdNo': ''
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
print(resp.status_code)
try:
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False)[:1000])
except:
    print(resp.text[:500])