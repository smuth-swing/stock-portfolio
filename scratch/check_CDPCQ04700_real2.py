import sys, json, time
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests

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
        'QryTp': '0',
        'QrySrtDt': '20260527',
        'QryEndDt': '20260529',
        'AcntNo': cfg['account'],
        'Pwd': cfg['account_pw'],
        'PdptnCode': '01',
        'IsuLgclssCode': '01',
        'IsuNo': '',
        'SrtNo': 0
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
print(f"SrtNo=0 -> {res.get('rsp_cd')} {res.get('rsp_msg')}")
if res.get('rsp_cd') == '00000':
    print(json.dumps(res, indent=2, ensure_ascii=False)[:1000])

body['CDPCQ04700InBlock1']['PdptnCode'] = '00'
body['CDPCQ04700InBlock1']['IsuLgclssCode'] = '00'
time.sleep(1)
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
print(f"PdptnCode=00 -> {res.get('rsp_cd')} {res.get('rsp_msg')}")
if res.get('rsp_cd') == '00000':
    print(json.dumps(res, indent=2, ensure_ascii=False)[:1000])
