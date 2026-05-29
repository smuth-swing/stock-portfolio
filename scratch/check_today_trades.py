import sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
from datetime import datetime

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])
today = datetime.now().strftime('%Y%m%d')

all_raw = []
cts_ordno = ""
for page in range(5):
    headers = {
        'content-type': 'application/json; charset=utf-8',
        'authorization': f'Bearer {token}',
        'tr_cd': 't0425',
        'tr_cont': 'Y' if cts_ordno else 'N',
        'tr_cont_key': cts_ordno,
        'mac_address': ''
    }
    body = {
        't0425InBlock': {
            'accno': cfg['account'],
            'passwd': cfg['account_pw'],
            'expcode': '',
            'chegb': '0',
            'medosu': '0',
            'sortgb': '1',
            'cts_ordno': cts_ordno,
            'fromdate': today,
            'todate': today
        }
    }
    resp = requests.post(f'{LS_BASE_URL}/stock/accno', headers=headers, json=body)
    res = resp.json()
    
    raw = res.get('t0425OutBlock1', [])
    all_raw.extend(raw)
    
    out_block = res.get('t0425OutBlock', {})
    print(f'Page {page+1}: fetched {len(raw)}, tr_cont header: {resp.headers.get("tr_cont")}, cts_ordno: {out_block.get("cts_ordno")}')
    
    cts_ordno = out_block.get('cts_ordno', '').strip()
    if not cts_ordno or cts_ordno == '0000000000' or len(raw) == 0:
        break

print(f'Total fetched: {len(all_raw)}')
for r in all_raw:
    print(f"[{r.get('ordno')}] {r.get('expname')} - {r.get('medosu')} 수량:{r.get('ordqty')} 체결:{r.get('cheqty')} 미체결:{r.get('ordrem')}")