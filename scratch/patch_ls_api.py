import sys, re
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = '''def fetch_trade_history(account, account_pw, from_date, to_date, stock_code=""):
    """
    LS증권 기간별 체결내역(CDPCQ04700) API 호출 및 정제 (페이징 포함)
    """
    token = get_access_token(CONFIG["app_key"], CONFIG["app_secret"])
    if not token:
        raise RuntimeError("LS API 토큰 발급 실패 (설정을 확인하세요).")

    all_raw = []
    cts_key = ""
    
    # 최대 20페이지까지만 조회하여 무한 루프 방지
    for page in range(20):
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "tr_cd": "CDPCQ04700",
            "tr_cont": "Y" if cts_key else "N",
            "tr_cont_key": cts_key,
            "mac_address": ""
        }

        body = {
            "CDPCQ04700InBlock1": {
                "QryTp": "0",            # 0:전체 1:매도 2:매수
                "QrySrtDt": from_date,
                "QryEndDt": to_date,
                "AcntNo": account,
                "Pwd": account_pw,
                "PdptnCode": "00",       # 00:전체
                "IsuLgclssCode": "00",   # 00:전체
                "IsuNo": "",
                "SrtNo": 0
            }
        }

        import requests
        resp = requests.post(
            f"{LS_BASE_URL}/stock/accno",
            headers=headers,
            json=body,
            timeout=15
        )
        resp.raise_for_status()
        result = resp.json()

        # 에러 체크 (00000: 정상, 00136: 정상 및 연속데이터 있음)
        if "rsp_cd" in result and result["rsp_cd"] not in ("00000", "00136"):
            raise RuntimeError(f"LS API 오류: [{result.get('rsp_cd')}] {result.get('rsp_msg', '알 수 없는 오류')}")

        raw_list = result.get("CDPCQ04700OutBlock3", [])
        if raw_list:
            all_raw.extend(raw_list)

        # ── 다음 페이지 확인 ──────────────────────────────────────
        resp_tr_cont = resp.headers.get("tr_cont", "").strip()
        resp_tr_cont_key = resp.headers.get("tr_cont_key", "").strip()

        if resp_tr_cont == "Y" and resp_tr_cont_key:
            cts_key = resp_tr_cont_key
        else:
            break

    # ── 원시 데이터 → 정제된 거래 목록 변환 ─────────────────────
    if not all_raw:
        return []

    trades = []
    for item in all_raw:
        trade_type_str = str(item.get("TpCodeNm", "")).strip()
        if "매도" in trade_type_str or trade_type_str == "2":
            trade_type = "매도"
        elif "매수" in trade_type_str or trade_type_str == "1":
            trade_type = "매수"
        else:
            continue

        raw_date = str(item.get("TrdDt", "")).strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            trade_date = f"{to_date[:4]}-{to_date[4:6]}-{to_date[6:8]}"

        qty = int(item.get("TrdQty", 0) or 0)
        price = float(item.get("TrdUprc", 0) or 0)
        amount = int(qty * price)
        fee = int(item.get("CmsnAmt", 0) or 0) + int(item.get("Trtax", 0) or 0)
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
            "ordno": str(item.get("TrdNo", "")).strip(),
            "_source": "ls_api"
        })

    return trades'''

# Regex to find fetch_trade_history and replace until invalidate_token
pattern = re.compile(r'def fetch_trade_history\(.*?\):.*?return trades', re.DOTALL)
new_content = pattern.sub(new_func, content)
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api.py', 'w', encoding='utf-8') as f:
    f.write(new_content)