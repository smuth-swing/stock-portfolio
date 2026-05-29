import sys, re
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = '''def fetch_trade_history(from_date, to_date, stock_code=""):
    """
    LS증권 주문체결내역(CSPAQ13700) API 호출 및 정제.
    CSPAQ13700은 단일 일자 조회만 지원하므로, 날짜별로 반복 조회합니다.
    """
    cfg = load_config()
    account = cfg["account"]
    account_pw = cfg["account_pw"]
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    if not token:
        raise RuntimeError("LS API 토큰 발급 실패 (설정을 확인하세요).")

    import requests
    import time
    from datetime import datetime, timedelta

    all_raw = []
    
    start_dt = datetime.strptime(from_date, "%Y%m%d")
    end_dt = datetime.strptime(to_date, "%Y%m%d")
    
    current_dt = start_dt
    while current_dt <= end_dt:
        target_date = current_dt.strftime("%Y%m%d")
        
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "tr_cd": "CSPAQ13700",
            "tr_cont": "N",
            "mac_address": ""
        }

        body = {
            "CSPAQ13700InBlock1": {
                "OrdMktCode": "00", 
                "BnsTpCode": "0", 
                "IsuNo": "",
                "ExecYn": "1", # 1:체결
                "OrdDt": target_date,
                "SrtOrdNo2": 999999999, 
                "BkseqTpCode": "0", 
                "OrdPtnCode": "00",
                "AcntNo": account,
                "InptPwd": account_pw
            }
        }

        time.sleep(0.3)
        resp = requests.post(f"{LS_BASE_URL}/stock/accno", headers=headers, json=body, timeout=15)
        resp.raise_for_status()
        result = resp.json()

        if "rsp_cd" in result and result["rsp_cd"] not in ("00000", "00136", "00133", "00200", "01001", "IGW00201"):
            # 00200 or IGW00201 usually means no data for that day
            pass
        
        raw_list = result.get("CSPAQ13700OutBlock3", [])
        if raw_list:
            all_raw.extend(raw_list)
            
        current_dt += timedelta(days=1)

    if not all_raw:
        return []

    trades = []
    for item in all_raw:
        # CSPAQ13700 fields
        # 'BnsTpNm' or 'BnsTpCode' for Buy/Sell
        trade_type_str = str(item.get("BnsTpNm", "")).strip() or str(item.get("BnsTpCode", ""))
        if "매도" in trade_type_str or trade_type_str == "1":
            trade_type = "매도"
        elif "매수" in trade_type_str or trade_type_str == "2":
            trade_type = "매수"
        else:
            continue

        raw_date = str(item.get("OrdDt", "")).strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            trade_date = f"{to_date[:4]}-{to_date[4:6]}-{to_date[6:8]}"

        qty = int(item.get("ExecQty", 0) or 0)
        price = float(item.get("ExecPrc", 0) or 0)
        amount = int(qty * price)
        fee = int(item.get("CmsnAmt", 0) or 0) + int(item.get("Secutrxtax", 0) or 0)
        investment = round(amount / 10000, 1)

        name = str(item.get("IsuNm", "")).strip()
        ticker = str(item.get("IsuNo", "")).strip()
        if ticker.startswith("A"):
            ticker = ticker[1:]
        if not name:
            name = get_stock_name(token, ticker)

        trades.append({
            "date": trade_date,
            "ticker": ticker,
            "name": name,
            "type": trade_type,
            "qty": qty,
            "price": price,
            "amount": amount,
            "investment": investment,
            "fee": fee,
            "ordno": str(item.get("OrdNo", "")).strip(),
            "_source": "ls_api"
        })

    return trades'''

pattern = re.compile(r'def fetch_trade_history\(.*?\):.*?return trades', re.DOTALL)
new_content = pattern.sub(new_func, content)
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(new_content)