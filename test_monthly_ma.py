import json
import requests
import pandas as pd
from ls_api import get_access_token, load_config, LS_BASE_URL

def test_t8413_monthly(shcode="005930"):
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "tr_cd": "t8413",
        "tr_cont": "N",
        "mac_address": ""
    }
    
    body = {
        "t8413InBlock": {
            "shcode": shcode,
            "gubun": "4", # 4: 월봉
            "qrycnt": 5, # 5개월치
            "sdate": "",
            "edate": "99999999",
            "cts_date": "",
            "comp_yn": "N",
            "sujungsign": "1" # 1: 수정주가 적용
        }
    }
    
    resp = requests.post(f"{LS_BASE_URL}/stock/chart", headers=headers, json=body, timeout=10)
    print("Monthly t8413 Status:", resp.status_code)
    try:
        data = resp.json()
        outblock = data.get("t8413OutBlock1", [])
        print("Data count:", len(outblock))
        
        if len(outblock) > 0:
            df = pd.DataFrame(outblock)
            df['close'] = pd.to_numeric(df['close'])
            
            ma5_month = df['close'].head(5).mean()
            
            print(f"Current: {df['close'].iloc[0]}")
            print(f"MA5 Month: {ma5_month}")
    except Exception as e:
        print("error:", e)

if __name__ == "__main__":
    test_t8413_monthly()
