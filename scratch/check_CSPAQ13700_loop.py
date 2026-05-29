import sys, json, time
from datetime import datetime, timedelta
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL, get_stock_name
import requests

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])

def fetch_cspaq13700(target_date):
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
            'OrdDt': target_date,
            'SrtOrdNo2': 999999999, 
            'BkseqTpCode': '0', 
            'OrdPtnCode': '00',
            'AcntNo': cfg['account'],
            'InptPwd': cfg['account_pw']
        }
    }
    resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
    return resp.json()

dt = datetime.strptime('20260527', '%Y%m%d')
res = fetch_cspaq13700(dt.strftime('%Y%m%d'))
print("rsp_cd:", res.get("rsp_cd"))
out3 = res.get('CSPAQ13700OutBlock3', [])
print("Length:", len(out3))
if len(out3) > 0:
    for item in out3[:3]:
        print(f"OrdDt: {item.get('OrdDt')} / OrdNo: {item.get('OrdNo')} / IsuNm: {item.get('IsuNm')} / ExecQty: {item.get('ExecQty')} / ExecPrc: {item.get('ExecPrc')} / UnexecQty: {item.get('UnexecQty')}")