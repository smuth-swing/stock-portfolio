import sys, json
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
        'OrdMktCode': '00',     # 00: 전체
        'BnsTpCode': '0',       # 0: 전체
        'IsuNo': '',
        'ExecYn': '1',          # 0:전체 1:체결 2:미체결
        'OrdDt': '',
        'SrtMacNo': '',
        'BkseqNo': '',
        'OrdPttrnCode': '00',
        'AcntNo': cfg['account'],
        'Pwd': cfg['account_pw']
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
print(resp.status_code)
try:
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False)[:1000])
except:
    print(resp.text[:500])