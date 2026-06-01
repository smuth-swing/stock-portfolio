import pandas as pd
import requests
import time
from ls_api import get_access_token, load_config, LS_BASE_URL

def calculate_rsi(closes, period=14):
    if len(closes) < period + 1:
        return 50.0
    
    diffs = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in diffs]
    losses = [abs(d) if d < 0 else 0 for d in diffs]
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return round(rsi, 2)

def test_rsi():
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "tr_cd": "t8413",
        "tr_cont": "N",
        "mac_address": ""
    }
    
    for shcode in ["005930"]:
        for gubun in ["2", "3", "4"]:
            body = {
                "t8413InBlock": {
                    "shcode": shcode,
                    "gubun": gubun, 
                    "qrycnt": 60, # enough for 14-period RSI
                    "sdate": "",
                    "edate": "99999999",
                    "cts_date": "",
                    "comp_yn": "N",
                    "sujungsign": "1" 
                }
            }
            resp = requests.post(f"{LS_BASE_URL}/stock/chart", headers=headers, json=body)
            outblock = resp.json().get("t8413OutBlock1", [])
            closes = [float(item.get("close", 0)) for item in outblock]
            
            # t8413 is oldest to newest, which is perfect for RSI
            rsi = calculate_rsi(closes)
            print(f"Gubun {gubun} RSI: {rsi}")
            time.sleep(1.1)

if __name__ == "__main__":
    test_rsi()
