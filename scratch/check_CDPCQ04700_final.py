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
        'QryTp': '0', # 0: 전체, 1: 매도, 2: 매수
        'QrySrtDt': '20260527',
        'QryEndDt': '20260529',
        'AcntNo': cfg['account'],
        'Pwd': cfg['account_pw'],
        'PdptnCode': '00', # 00: 전체, 01: 주식?
        'IsuLgclssCode': '00',
        'IsuNo': '',
        'SrtNo': 0
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
res = resp.json()
print("RSP_CD:", res.get("rsp_cd"))
out2 = res.get('CDPCQ04700OutBlock2', [])
print("Count:", len(out2))
if len(out2) > 0:
    for r in out2:
        print(f"Date: {r.get('ExecDt')} | Stock: {r.get('IsuNm')}({r.get('IsuNo')}) | Type: {r.get('BnsTpNm')} | Qty: {r.get('ExecQty')} | Price: {r.get('ExecPrc')}")