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
                "ExecYn": "0", # 0:전체
                "OrdDt": target_date,
                "SrtOrdNo2": 999999999, 
                "BkseqTpCode": "0", 
                "OrdPtnCode": "00",
                "AcntNo": account,
                "InptPwd": account_pw
            }
        }

        success = False
        for _ in range(3):
            time.sleep(1.0) # 1초 대기 (서버 과부하 방지)
            try:
                resp = requests.post(f"{LS_BASE_URL}/stock/accno", headers=headers, json=body, timeout=15)
                if resp.status_code == 200:
                    result = resp.json()
                    success = True
                    break
            except Exception:
                pass
        
        if not success:
            current_dt += timedelta(days=1)
            continue

        if "rsp_cd" in result and result["rsp_cd"] not in ("00000", "00136", "00133", "00200", "01001", "IGW00201"):
            pass
        
        raw_list = result.get("CSPAQ13700OutBlock3", [])
        if raw_list:
            all_raw.extend(raw_list)
            
        current_dt += timedelta(days=1)

    if not all_raw:
        return []

    trades = []
    for item in all_raw:
        trade_type_str = str(item.get("BnsTpNm", "")).strip() or str(item.get("BnsTpCode", ""))
        if "매도" in trade_type_str or trade_type_str == "1":
            trade_type = "매도"
        elif "매수" in trade_type_str or trade_type_str == "2":
            trade_type = "매수"
        else:
            continue

        qty = int(item.get("ExecQty", 0) or 0)
        if qty == 0:
            continue # 미체결은 제외 (주문 체결 내역이므로)

        raw_date = str(item.get("OrdDt", "")).strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            continue

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