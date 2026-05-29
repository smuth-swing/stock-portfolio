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
    'tr_cont': 'Y',
    'tr_cont_key': 'AAAwvLAEgAABX28AAG',
    'mac_address': ''
}

body = {
    'CDPCQ04700InBlock1': {
        'QryTp': '0',
        'QrySrtDt': '20250529',
        'QryEndDt': '20260529',
        'AcntNo': cfg['account'],
        'Pwd': cfg['account_pw'],
        'PdptnCode': '00',
        'IsuLgclssCode': '00',
        'IsuNo': '',
        'SrtNo': 0
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
print("tr_cont:", resp.headers.get('tr_cont'))
out3 = res.get('CDPCQ04700OutBlock3', [])
print("Out3 count:", len(out3))
if len(out3) > 0:
    print(out3[0].get('TrdDt'))