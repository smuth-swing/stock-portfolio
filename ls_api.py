"""
ls_api.py — LS증권 OpenAPI REST 클라이언트
============================================================
LS증권 OpenAPI 문서: https://openapi.ls-sec.co.kr
주요 TR 코드:
  t0425 : 주식 주문/체결 내역 조회 (날짜 + 계좌 기준)
  t0424 : 계좌 잔고 조회
"""

import os
import json
import time
import requests
from pathlib import Path
from datetime import datetime, timedelta

# ── 설정 파일 경로 ─────────────────────────────────────────
CONFIG_PATH = Path(__file__).parent / "ls_api_config.json"
LS_BASE_URL = "https://openapi.ls-sec.co.kr:8080"

# ── 토큰 캐시 (메모리) ────────────────────────────────────
_token_cache = {
    "access_token": None,
    "expires_at": 0  # Unix timestamp
}


def load_config() -> dict:
    """저장된 API 설정 로드 (앱키, 계좌번호 등)"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_config(config: dict):
    """API 설정 저장"""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_access_token(app_key: str, app_secret: str) -> str:
    """OAuth 2.0 액세스 토큰 발급 (캐시 활용)"""
    global _token_cache

    # 캐시가 유효한 경우 재사용 (만료 60초 전에 갱신)
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    url = f"{LS_BASE_URL}/oauth2/token"
    data = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecretkey": app_secret,
        "scope": "oob"
    }

    resp = requests.post(url, data=data, timeout=10)
    resp.raise_for_status()
    result = resp.json()

    token = result.get("access_token")
    expires_in = int(result.get("expires_in", 86400))  # 기본 24시간

    # 캐시 저장
    _token_cache["access_token"] = token
    _token_cache["expires_at"] = time.time() + expires_in

    return token
_stock_name_cache = {}

def get_stock_name(token: str, shcode: str) -> str:
    global _stock_name_cache
    if not _stock_name_cache:
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "tr_cd": "t8436",
            "tr_cont": "N",
            "tr_cont_key": "",
            "mac_address": ""
        }
        body = {
            "t8436InBlock": {
                "gubun": "0"
            }
        }
        try:
            resp = requests.post(f"{LS_BASE_URL}/stock/etc", headers=headers, json=body, timeout=15)
            if resp.status_code == 200:
                out = resp.json().get("t8436OutBlock", [])
                for item in out:
                    _stock_name_cache[item.get("shcode", "")] = item.get("hname", "")
        except Exception:
            pass
            
    return _stock_name_cache.get(shcode, shcode)

def get_stock_codes_by_names(token: str, names: list) -> dict:
    """주식 이름 리스트를 받아 종목 코드 딕셔너리로 반환 { "삼성전자": "005930" }"""
    global _stock_name_cache
    if not _stock_name_cache:
        # 캐시가 없으면 get_stock_name 호출하여 초기화 유도
        get_stock_name(token, "005930")
        
    # 이름 -> 코드 맵 생성
    name_to_code = {v: k for k, v in _stock_name_cache.items()}
    # 띄어쓰기/대소문자 무시 맵
    clean_to_code = {str(v).replace(" ", "").upper(): k for k, v in _stock_name_cache.items()}
    
    result = {}
    for name in names:
        if not name: continue
        name_str = str(name).strip()
        
        # 1. 완벽 일치
        if name_str in name_to_code:
            result[name_str] = name_to_code[name_str]
        else:
            # 2. 공백 제거 및 대문자 변환 후 비교
            clean_name = name_str.replace(" ", "").upper()
            if clean_name in clean_to_code:
                result[name_str] = clean_to_code[clean_name]
                
    return result


def fetch_trade_history(from_date, to_date, stock_code=""):
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

    return trades


def invalidate_token():
    """토큰 캐시 강제 초기화 (재로그인 필요 시)"""
    global _token_cache
    _token_cache["access_token"] = None
    _token_cache["expires_at"] = 0

def fetch_current_prices(stock_codes):
    """
    LS증권 주식다종목현재가(t8407) API 호출.
    stock_codes: 종목코드 리스트 (예: ["005930", "000660"])
    반환값: { "005930": 80000, "000660": 120000, ... } 형태의 딕셔너리
    """
    if not stock_codes:
        return {}
        
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    if not token:
        raise RuntimeError("LS API 토큰 발급 실패 (설정을 확인하세요).")
        
    # t8407은 종목코드를 연속된 문자열로 받음 (최대 50종목)
    # 50개씩 끊어서 요청
    result_prices = {}
    chunk_size = 50
    
    for i in range(0, len(stock_codes), chunk_size):
        chunk = stock_codes[i:i+chunk_size]
        # 종목코드 6자리 패딩 (혹시 A가 붙어있으면 제거)
        clean_chunk = []
        for code in chunk:
            c = str(code).strip()
            if c.startswith("A"):
                c = c[1:]
            clean_chunk.append(c.zfill(6))
            
        shcode_str = "".join(clean_chunk)
        
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "tr_cd": "t8407",
            "tr_cont": "N",
            "mac_address": ""
        }
        
        body = {
            "t8407InBlock": {
                "nrec": len(clean_chunk),
                "shcode": shcode_str
            }
        }
        
        try:
            resp = requests.post(f"{LS_BASE_URL}/stock/market-data", headers=headers, json=body, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                out_block = data.get("t8407OutBlock1", [])
                for item in out_block:
                    code = item.get("shcode", "")
                    price = float(item.get("price", 0))
                    if code:
                        result_prices[code] = price
            time.sleep(0.5) # API 호출 제한 방지
        except Exception as e:
            print(f"t8407 API 호출 중 오류 발생: {e}")
            
    return result_prices

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

def fetch_moving_averages(stock_code):
    """
    주식차트 t8413을 조회하여 현재가, 5개월 이동평균선, 일/주/월봉 RSI 계산.
    stock_code: 단일 종목 코드
    반환값: { "ma5_month": ..., "current": ..., "rsi_day": ..., "rsi_week": ..., "rsi_month": ... }
    """
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    if not token:
        raise RuntimeError("LS API 토큰 발급 실패 (설정을 확인하세요).")
        
    code = str(stock_code).strip()
    if code.startswith("A"):
        code = code[1:]
    code = code.zfill(6)
        
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "tr_cd": "t8413",
        "tr_cont": "N",
        "mac_address": ""
    }
    
    result = {}
    
    gubun_map = {
        "2": "rsi_day",
        "3": "rsi_week",
        "4": "rsi_month"
    }
    
    for gubun, rsi_key in gubun_map.items():
        body = {
            "t8413InBlock": {
                "shcode": code,
                "gubun": gubun,
                "qrycnt": 200,  # 넉넉한 데이터로 RSI 정확도 향상 (기존 60 -> 200)
                "sdate": "",
                "edate": "99999999",
                "cts_date": "",
                "comp_yn": "N",
                "sujungsign": "1" 
            }
        }
        
        try:
            resp = requests.post(f"{LS_BASE_URL}/stock/chart", headers=headers, json=body, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                outblock = data.get("t8413OutBlock1", [])
                if outblock:
                    # 권리락/액면분할에 대한 수정주가가 미적용된 오류 자동 보정
                    for i in range(len(outblock) - 1):
                        try:
                            rate_val = float(outblock[i+1].get("rate", 0) or 0)
                            if rate_val <= -20.0:  # 20% 이상 하락하는 권리락/액면분할
                                ratio = 1 + (rate_val / 100.0)
                                for j in range(i + 1):
                                    outblock[j]["close"] = float(outblock[j]["close"]) * ratio
                        except:
                            pass
                            
                    closes = [float(item.get("close", 0)) for item in outblock]
                    result[rsi_key] = calculate_rsi(closes)
                    
                    if gubun == "2":
                        recent_days = outblock[-5:] if len(outblock) >= 5 else outblock
                        highs = [float(item.get("high", item.get("close", 0))) for item in recent_days]
                        lows = [float(item.get("low", item.get("close", 0))) for item in recent_days]
                        result["high_1w"] = max(highs) if highs else 0
                        result["low_1w"] = min(lows) if lows else 0
                    
                    if gubun == "3":
                        if len(closes) >= 120:
                            result["ma120_week"] = sum(closes[-120:]) / 120
                            
                    if gubun == "4":
                        result["current"] = closes[-1]
                        
                        if len(closes) >= 5:
                            recent5 = closes[-5:]
                            result["ma5_month"] = sum(recent5) / 5
                            # 다음 달 5월봉 예측 (현재가 유지 가정)
                            next_recent5 = recent5[1:] + [recent5[-1]]
                            result["ma5_month_next"] = sum(next_recent5) / 5
                        else:
                            result["ma5_month"] = sum(closes) / len(closes) if closes else 0
                            result["ma5_month_next"] = result["ma5_month"]
            
            # LS OpenAPI 초당 1건 제한(TR) 우회
            time.sleep(1.05)
        except Exception as e:
            print(f"t8413 (gubun {gubun}) API 호출 중 오류 발생: {e}")
            
    return result
