import sys
import pandas as pd
sys.path.insert(0, '.')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests

cfg = load_config()
token = get_access_token(cfg['app_key'], cfg['app_secret'])

body = {
    't8413InBlock': {
        'shcode': '328130',
        'gubun': '2',
        'qrycnt': 500,
        'sdate': '',
        'edate': '99999999',
        'cts_date': '',
        'comp_yn': 'N',
        'sujungsign': '0'
    }
}
resp = requests.post(f'{LS_BASE_URL}/stock/chart', headers={'content-type': 'application/json; charset=utf-8', 'authorization': f'Bearer {token}', 'tr_cd': 't8413', 'tr_cont': 'N', 'mac_address': ''}, json=body)
outblock = resp.json().get('t8413OutBlock1', [])
for i in range(len(outblock)-1):
    c1 = float(outblock[i]['close'])
    c2 = float(outblock[i+1]['close'])
    r = outblock[i+1].get('rate')
    if r:
        try:
            rate_val = float(r)
            if rate_val < -20: # 20% 이상 하락하는 권리락
                ratio = 1 + (rate_val / 100)
                # 이전 모든 주가에 ratio 곱하기
                for j in range(i+1):
                    outblock[j]['close'] = float(outblock[j]['close']) * ratio
        except:
            pass

import pandas as pd
from ta.momentum import RSIIndicator
closes = [float(item['close']) for item in outblock]
df = pd.DataFrame(closes, columns=['close'])
rsi = RSIIndicator(close=df['close'], window=14).rsi()
print('Properly Adjusted Wilder RSI (500 days):', rsi.iloc[-1])
