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

for tp in ['00']:
    body = {
        'CDPCQ04700InBlock1': {
            'QrySrtDt': '20260527',
            'QryEndDt': '20260529',
            'SellsBuyTpCode': tp,
            'AcntNo': cfg['account'],
            'Pwd': cfg['account_pw'],
            'Pdno': '',
            'IsinCode': '',
            'StckPrprCode': '',
            'CtsOrdNo': ''
        }
    }
    resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
    res = resp.json()
    print(f"tp={tp} -> {res.get('rsp_cd')} {res.get('rsp_msg')}")
    if res.get('rsp_cd') == '00000':
        print(json.dumps(res, indent=2, ensure_ascii=False)[:1000])
    time.sleep(1.5)