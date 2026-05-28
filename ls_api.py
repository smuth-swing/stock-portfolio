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
    t0425 TR: 주식 주문/체결 내역 조회
    Args:
        from_date: 조회 시작일 (YYYYMMDD)
        to_date  : 조회 종료일 (YYYYMMDD)
        stock_code: 종목코드 (공백=전종목)
    Returns:
        거래내역 리스트 [{ date, ticker, name, type, qty, price, amount, fee, ... }, ...]
    """
    # 설정 파일에서 기본값 로드
    cfg = load_config()
    app_key = app_key or cfg.get("app_key", "")
    app_secret = app_secret or cfg.get("app_secret", "")
    account = account or cfg.get("account", "")
    account_pw = account_pw or cfg.get("account_pw", "")

    if not all([app_key, app_secret, account, account_pw]):
        raise ValueError("API 설정이 불완전합니다. 앱키, 시크릿키, 계좌번호, 비밀번호를 모두 입력하세요.")

    token = get_access_token(app_key, app_secret)

    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "tr_cd": "t0425",
        "tr_cont": "N",
        "tr_cont_key": "",
        "mac_address": ""
    }

    body = {
        "t0425InBlock": {
            "accno": account,
            "passwd": account_pw,
            "expcode": stock_code,     # 공백 = 전종목
            "chegb": "2",              # 2=체결만 (0=전체, 1=미체결)
            "medosu": "0",             # 0=전체 (1=매도, 2=매수)
            "sortgb": "1",             # 1=체결일시 오름차순
            "cts_ordno": "",           # 연속 조회 키 (첫 조회는 공백)
            "fromdate": from_date,
            "todate": to_date
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
    if not raw_list:
        return []

    trades = []
    for item in raw_list:
        # 매도/매수 구분
        medosu_code = str(item.get("medosu", "")).strip()
        trade_type = "매도" if medosu_code in ("1", "매도") else "매수"

        # 날짜 포맷 변환: YYYYMMDD → YYYY-MM-DD
        raw_date = str(item.get("trddate", "")).strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            trade_date = raw_date

        # 수량, 단가, 체결금액
        qty = int(item.get("qty", 0) or 0)
        price = int(item.get("price", 0) or 0)
        amount = int(item.get("amount", 0) or 0)
        fee = int(item.get("fee", 0) or 0)

        # 투자금 = 체결금액 기준 (만원 단위로 변환)
        investment = round(amount / 10000, 1)

        trades.append({
            "date": trade_date,
            "ticker": str(item.get("expcode", "")).strip(),
            "name": str(item.get("expname", "")).strip(),
            "type": trade_type,
            "qty": qty,
            "price": price,
            "amount": amount,       # 원 단위
            "investment": investment,  # 만원 단위 (기존 Excel DB 형식)
            "fee": fee,
            "ordno": str(item.get("ordno", "")).strip(),
            "_source": "ls_api"     # 가져온 출처 표시
        })

    return trades


def invalidate_token():
    """토큰 캐시 강제 초기화 (재로그인 필요 시)"""
    global _token_cache
    _token_cache["access_token"] = None
    _token_cache["expires_at"] = 0
