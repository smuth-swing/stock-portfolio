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


def fetch_trade_history(
    from_date: str,
    to_date: str,
    app_key: str = None,
    app_secret: str = None,
    account: str = None,
    account_pw: str = None,
    stock_code: str = ""
) -> list[dict]:
    """
    t0425 TR: 주식 주문/체결 내역 조회 (연속 조회로 전체 데이터 수집)
    - 1회 최대 100건 반환 → tr_cont='Y' 동안 cts_ordno 로 계속 요청
    Args:
        from_date : 조회 시작일 (YYYYMMDD)
        to_date   : 조회 종료일 (YYYYMMDD)
        stock_code: 종목코드 (공백=전종목)
    Returns:
        거래내역 리스트 [{ date, ticker, name, type, qty, price, amount, fee, ... }, ...]
    """
    # 설정 파일에서 기본값 로드
    cfg = load_config()
    app_key    = app_key    or cfg.get("app_key", "")
    app_secret = app_secret or cfg.get("app_secret", "")
    account    = account    or cfg.get("account", "")
    account_pw = account_pw or cfg.get("account_pw", "")

    if not all([app_key, app_secret, account, account_pw]):
        raise ValueError("API 설정이 불완전합니다. 앱키, 시크릿키, 계좌번호, 비밀번호를 모두 입력하세요.")

    token = get_access_token(app_key, app_secret)

    # ── 연속 조회 루프 ────────────────────────────────────────────
    all_raw   = []    # 전체 원시 데이터 누적
    cts_ordno = ""    # 연속 조회 키 (첫 번째는 공백)
    MAX_PAGES = 100   # 무한루프 방지 (100회×100건 = 최대 10,000건)

    for page in range(MAX_PAGES):
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "tr_cd": "t0425",
            "tr_cont": "Y" if cts_ordno else "N",  # 연속 조회 시 'Y'
            "tr_cont_key": cts_ordno,
            "mac_address": ""
        }

        body = {
            "t0425InBlock": {
                "accno":    account,
                "passwd":   account_pw,
                "expcode":  stock_code,   # 공백 = 전종목
                "chegb":    "0",          # 0=전체
                "medosu":   "0",          # 0=전체 (1=매도, 2=매수)
                "sortgb":   "1",          # 1=주문번호 오름차순
                "cts_ordno": cts_ordno,   # 연속 조회 키
                "fromdate": from_date,
                "todate":   to_date
            }
        }

        resp = requests.post(
            f"{LS_BASE_URL}/stock/accno",
            headers=headers,
            json=body,
            timeout=15
        )
        resp.raise_for_status()
        result = resp.json()

        # 에러 체크
        if "rsp_cd" in result and result["rsp_cd"] != "00000":
            raise RuntimeError(f"LS API 오류: [{result.get('rsp_cd')}] {result.get('rsp_msg', '알 수 없는 오류')}")

        raw_list = result.get("t0425OutBlock1", [])
        if raw_list:
            all_raw.extend(raw_list)

        # ── 다음 페이지 확인 ──────────────────────────────────────
        # 응답 헤더 tr_cont='Y' → 다음 페이지 있음
        resp_tr_cont = resp.headers.get("tr_cont", "").strip()
        out_block = result.get("t0425OutBlock", {})
        next_key = str(out_block.get("cts_ordno", "")).strip() if out_block else ""

        if resp_tr_cont == "Y" and next_key and next_key != "0000000000":
            cts_ordno = next_key   # 다음 페이지 키로 갱신
        else:
            break  # 마지막 페이지 → 루프 종료

    # ── 원시 데이터 → 정제된 거래 목록 변환 ─────────────────────
    if not all_raw:
        return []

    trades = []
    default_date = f"{from_date[:4]}-{from_date[4:6]}-{from_date[6:8]}"

    for item in all_raw:
        cheqty = int(item.get("cheqty", 0) or 0)
        if cheqty == 0:  # 미체결 건너뜀
            continue

        medosu_val = str(item.get("medosu", "")).strip()
        trade_type = "매도" if (medosu_val in ("1", "매도") or "도" in medosu_val) else "매수"

        raw_date = str(item.get("trddate", "")).strip() or str(item.get("orddt", "")).strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            # t0425는 기본적으로 당일 체결 내역만 반환하므로, 날짜가 없으면 오늘 날짜(또는 요청한 to_date)를 사용
            trade_date = f"{to_date[:4]}-{to_date[4:6]}-{to_date[6:8]}"

        price = int(item.get("cheprice", 0) or item.get("price", 0) or 0)
        amount = cheqty * price
        fee = int(item.get("fee", 0) or 0)
        investment = round(amount / 10000, 1)

        name = str(item.get("expname", "")).strip()
        ticker = str(item.get("expcode", "")).strip()
        if not name:
            name = get_stock_name(token, ticker)

        trades.append({
            "date": trade_date,
            "ticker": ticker,
            "name": name,
            "type": trade_type,
            "qty": cheqty,
            "price": price,
            "amount": amount,
            "investment": investment,
            "fee": fee,
            "ordno": str(item.get("ordno", "")).strip(),
            "_source": "ls_api"
        })

    return trades


def invalidate_token():
    """토큰 캐시 강제 초기화 (재로그인 필요 시)"""
    global _token_cache
    _token_cache["access_token"] = None
    _token_cache["expires_at"] = 0
