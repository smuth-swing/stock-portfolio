import json
import requests
import time
from ls_api import get_access_token, load_config, LS_BASE_URL

def test_t8413():
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "tr_cd": "t8413",
        "tr_cont": "N",
        "mac_address": ""
    }
    
    for shcode in ["005930", "000660", "035420"]:
        body = {
            "t8413InBlock": {
                "shcode": shcode,
                "gubun": "2", 
                "qrycnt": 120, 
                "sdate": "",
                "edate": "99999999",
                "cts_date": "",
                "comp_yn": "N",
                "sujungsign": "1" 
            }
        }
        resp = requests.post(f"{LS_BASE_URL}/stock/chart", headers=headers, json=body)
        print(f"{shcode} daily: {resp.status_code}, data length: {len(resp.json().get('t8413OutBlock1', []))}")
        print(f"Message: {resp.json().get('rsp_msg')}")
        time.sleep(0.3)

if __name__ == "__main__":
    test_t8413()
