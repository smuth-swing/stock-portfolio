import sys
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
import json

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
        'RecCnt': 1,
        'AcntNo': cfg['account'],
        'Pwd': cfg['account_pw'],
        'QrySrtDt': '20260101',
        'QryEndDt': '20260529',
        'SrtNo': 0, # 일련번호 숫자로
        'IsuNo': '',
        'BnsTpCode': '0',
        'CnsNmrvOdrStsCode': '0',
        'BlngSysTpCode': '0',
        'Pdptno': ''
    }
}

resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
print('HTTP:', resp.status_code)
try:
    print('JSON:', json.dumps(resp.json(), indent=2, ensure_ascii=False)[:1000])
except:
    print('RAW:', resp.text[:500])