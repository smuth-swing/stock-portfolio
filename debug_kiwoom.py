# -*- coding: utf-8 -*-
"""키움 API - 거래가 있는 날짜 찾기"""
import json
import requests
from kiwoom_api import get_account_config, get_access_token

# 4개 계좌 모두 최근 날짜 테스트
accounts = ["11592223", "63523834", "61574663", "62651446"]

for acnt_no in accounts:
    acnt = get_account_config(acnt_no)
    token = get_access_token(acnt["app_key"], acnt["secret_key"])
    
    url = "https://api.kiwoom.com/api/dostk/acnt"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "authorization": f"Bearer {token}",
        "api-id": "kt00007",
        "cont-yn": "N",
        "next-key": "",
    }
    
    # 최근 거래일 (10/24 금요일, 10/27 월요일, 10/28 화요일)
    for dt in ["20261024", "20261027", "20261028"]:
        body = {
            "dmst_stex_tp": "%",
            "ord_dt": dt,
            "acnt_no": acnt_no,
            "stk_bond_tp": "0",
            "mrkt_tp": "0",
            "sell_tp": "0",
            "qry_tp": "0",  # 전체 (체결+미체결)
        }
        resp = requests.post(url, headers=headers, json=body, timeout=15)
        data = resp.json()
        items = data.get("acnt_ord_cntr_prps_dtl", [])
        if items:
            print(f"[{acnt_no}] {dt}: {len(items)}건 발견!")
            # 첫 번째 항목의 키 출력
            print(f"  Keys: {list(items[0].keys())}")
            print(f"  First item: {json.dumps(items[0], ensure_ascii=False)[:500]}")
        else:
            msg = data.get("return_msg", "")
            print(f"[{acnt_no}] {dt}: 0건 - {msg}")
    
    import time
    time.sleep(0.5)
