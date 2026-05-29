import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
from datetime import datetime

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])
today = datetime.now().strftime('%Y%m%d')

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 'CDPCQ04700',
    'tr_cont': 'N',
    'mac_address': ''
}

body = {
    'CDPCQ04700InBlock1': {
        'QryTp': '0',
        'QrySrtDt': today,
        'QryEndDt': today,
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
print("RSP:", res.get("rsp_cd"))
out2 = res.get('CDPCQ04700OutBlock3', [])
print("Count:", len(out2))