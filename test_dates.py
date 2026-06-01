import json
import requests
import pandas as pd
from ls_api import get_access_token, load_config, LS_BASE_URL

def test_t8413_dates():
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
            "shcode": "005930",
            "gubun": "2", 
            "qrycnt": 5, 
            "sdate": "",
            "edate": "99999999",
            "cts_date": "",
            "comp_yn": "N",
            "sujungsign": "1" 
        }
    }
    
    resp = requests.post(f"{LS_BASE_URL}/stock/chart", headers=headers, json=body, timeout=10)
    print("Daily t8413:")
    outblock = resp.json().get("t8413OutBlock1", [])
    for item in outblock:
        print(f"Date: {item.get('date')}, Close: {item.get('close')}")

if __name__ == "__main__":
    test_t8413_dates()
