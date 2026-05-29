import urllib.request, json
# I will use a simple script to test CSPAQ13700 fields.
# Maybe 'OrdDt1' is wrong? Let's just use the minimum required fields.
import sys
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])

headers = {
    'content-type': 'application/json; charset=utf-8',
    'authorization': f'Bearer {token}',
    'tr_cd': 'CSPAQ13700',
    'tr_cont': 'N',
    'mac_address': ''
}

body = {
    'CSPAQ13700InBlock1': {
        'OrdMktCode': '00', 
        'BnsTpCode': '0', 
        'IsuNo': '',
        'ExecYn': '0', 
        'OrdDt': '20260527',
        'SrtOrdNo2': 999999999, 
        'BkseqTpCode': '1', 
        'OrdPtnCode': '00'
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
print("No AcntNo/Pwd:", resp.json())