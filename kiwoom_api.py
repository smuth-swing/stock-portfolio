# -*- coding: utf-8 -*-
"""
kiwoom_api.py — 키움증권 REST OpenAPI 클라이언트 (영웅문 계좌 거래내역 연동)
=============================================================================
키움증권 REST OpenAPI 포털: https://openapi.kiwoom.com
기본 도메인: https://api.kiwoom.com

주요 기능:
  - OAuth2 접근 토큰 발급 (/oauth2/token)
  - 계좌별 주문체결내역 상세 조회 (/api/dostk/acnt, TR: kt00007)
  - 4개 다중 계좌(11592223, 63523834, 61574663, 62651446) 설정 및 관리
  - LS증권(투혼) 거래내역 규격과 100% 호환되는 정규화된 거래내역 생성
"""

import os
import json
import time
import requests
from pathlib import Path
from datetime import datetime, timedelta

CONFIG_PATH = Path(__file__).parent / "kiwoom_api_config.json"
KIWOOM_BASE_URL = "https://api.kiwoom.com"

# 계좌별 토큰 캐시 { app_key: { "access_token": str, "expires_at": float } }
_token_cache = {}


def load_config() -> dict:
    """키움 API 설정 파일 로드"""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[KIWOOM] 설정 로드 오류: {e}")
    return {"accounts": {}, "default_account": ""}


def save_config(config: dict):
    """키움 API 설정 파일 저장"""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_account_config(account: str = None) -> dict:
    """특정 계좌 또는 기본 계좌의 설정(app_key, secret_key, account_pw 등) 반환"""
    cfg = load_config()
    accounts = cfg.get("accounts", {})
    if not accounts:
        raise ValueError("키움증권 설정 파일에 등록된 계좌가 없습니다.")

    target_acnt = account or cfg.get("default_account")
    if not target_acnt or target_acnt not in accounts:
        # 첫 번째 계좌 선택 fallback
        target_acnt = list(accounts.keys())[0]

    acnt_info = accounts[target_acnt]
    return {
        "account": target_acnt,
        "name": acnt_info.get("name", target_acnt),
        "app_key": acnt_info.get("app_key", "").strip(),
        "secret_key": acnt_info.get("secret_key", "").strip() or cfg.get("secret_key", "").strip(),
        "account_pw": acnt_info.get("account_pw", "").strip() or cfg.get("account_pw", "").strip(),
    }


def get_access_token(app_key: str, secret_key: str, force_refresh: bool = False) -> str:
    """
    키움 REST OpenAPI OAuth2 토큰 발급 (/oauth2/token)
    토큰 캐시 유효 시간: 만료 10분 전까지 재사용
    """
    now = time.time()
    cache = _token_cache.get(app_key)
    if not force_refresh and cache and cache.get("access_token") and cache.get("expires_at", 0) > now + 600:
        return cache["access_token"]

    if not app_key or not secret_key:
        raise ValueError("App Key 또는 Secret Key가 설정되지 않았습니다. 설정을 확인해 주세요.")

    url = f"{KIWOOM_BASE_URL}/oauth2/token"
    headers = {"Content-Type": "application/json;charset=UTF-8"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "secretkey": secret_key,
    }

    try:
        resp = requests.post(url, headers=headers, json=body, timeout=10)
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"키움 토큰 서버 연결 실패: {e}")

    # 응답 확인
    # 성공 시: { "token": "...", "token_type": "Bearer", "expires_dt": "..." } 또는 { "return_code": 0, "token": ... }
    token = data.get("token") or data.get("access_token")
    if not token:
        msg = data.get("return_msg") or data.get("message") or resp.text
        raise RuntimeError(f"키움 토큰 발급 실패: {msg}")

    # 만료 시간 파싱 (기본 24시간 또는 응답의 expires_in)
    expires_in = data.get("expires_in", 86400)
    _token_cache[app_key] = {
        "access_token": token,
        "expires_at": now + int(expires_in),
    }
    return token


def fetch_trade_history(from_date: str, to_date: str, account: str = None) -> list:
    """
    키움증권 계좌별 주문체결내역 상세(kt00007) 조회
    - from_date: 'YYYYMMDD'
    - to_date: 'YYYYMMDD'
    - account: 계좌번호 (미지정 시 기본 계좌)

    반환 형식:
      [
        {
          "date": "YYYY-MM-DD",
          "ticker": "005930",
          "name": "삼성전자",
          "type": "매수" | "매도",
          "qty": 10,
          "price": 70000,
          "amount": 700000,
          "investment": 70.0,
          "fee": 1050,
          "ordno": "12345",
          "_source": "kiwoom_api",
          "account": "11592223"
        },
        ...
      ]
    """
    acnt_info = get_account_config(account)
    target_acnt = acnt_info["account"]
    app_key = acnt_info["app_key"]
    secret_key = acnt_info["secret_key"]
    account_pw = acnt_info["account_pw"]

    if not secret_key:
        raise ValueError(
            f"계좌 [{target_acnt}]의 Secret Key가 설정되지 않았습니다.\n"
            "키움증권 OpenAPI 포털(openapi.kiwoom.com)에서 발급받은 Secret Key를 입력해 주세요."
        )

    token = get_access_token(app_key, secret_key)
    if not token:
        raise RuntimeError("키움 토큰 발급에 실패했습니다.")

    all_raw = []
    start_dt = datetime.strptime(from_date, "%Y%m%d")
    end_dt = datetime.strptime(to_date, "%Y%m%d")

    current_dt = start_dt
    endpoint_url = f"{KIWOOM_BASE_URL}/api/dostk/acnt"

    while current_dt <= end_dt:
        target_date = current_dt.strftime("%Y%m%d")
        cont_yn = "N"
        next_key = ""

        # 하루 치에 대해 연속조회 루프
        while True:
            headers = {
                "Content-Type": "application/json;charset=UTF-8",
                "authorization": f"Bearer {token}",
                "api-id": "kt00007",
                "cont-yn": cont_yn,
                "next-key": next_key,
            }

            body = {
                "ord_dt": target_date,
                "acnt_no": target_acnt,
                "stk_bond_tp": "0",  # 0: 전체, 1: 주식
                "mrkt_tp": "0",      # 0: 전체
                "sell_tp": "0",      # 0: 전체 (매도/매수)
                "qry_tp": "2",       # 2: 체결내역만 (0: 전체, 1: 미체결)
            }
            if account_pw:
                body["pwd"] = account_pw

            resp_data = None
            for attempt in range(3):
                if attempt > 0:
                    time.sleep(1.0)
                try:
                    resp = requests.post(endpoint_url, headers=headers, json=body, timeout=15)
                    if resp.status_code == 200:
                        resp_data = resp.json()
                        break
                except Exception:
                    pass

            if not resp_data:
                break

            # 응답 내역 추출 (리스트 키 확인: out, output, list, kt00007_out 등 호환 지원)
            raw_items = (
                resp_data.get("output")
                or resp_data.get("list")
                or resp_data.get("kt00007_out")
                or resp_data.get("data")
                or []
            )

            if isinstance(raw_items, list):
                all_raw.extend(raw_items)

            # 연속조회 여부 확인
            cont_header = resp.headers.get("cont-yn", "N")
            next_header = resp.headers.get("next-key", "")
            if cont_header == "Y" and next_header:
                cont_yn = "Y"
                next_key = next_header
                time.sleep(0.5)
            else:
                break

        current_dt += timedelta(days=1)
        time.sleep(0.2)  # 키움 초당 요청 제한(TPS) 방지

    if not all_raw:
        return []

    trades = []
    for item in all_raw:
        # 매매구분 판정 (sell_tp, bns_tp, bns_tp_nm 등)
        tp_str = str(item.get("sell_tp_nm") or item.get("bns_tp_nm") or item.get("sell_tp") or item.get("bns_tp") or "").strip()
        if "매도" in tp_str or tp_str == "1":
            trade_type = "매도"
        elif "매수" in tp_str or tp_str == "2":
            trade_type = "매수"
        else:
            continue

        # 체결 수량
        qty = int(float(item.get("cntr_qty") or item.get("exec_qty") or 0))
        if qty <= 0:
            continue

        # 주문 일자
        raw_date = str(item.get("ord_dt") or item.get("cntr_dt") or "").strip()
        if len(raw_date) == 8:
            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            trade_date = datetime.now().strftime("%Y-%m-%d")

        # 체결 가격 및 금액
        price = float(item.get("cntr_pric") or item.get("cntr_prc") or item.get("exec_prc") or 0)
        amount = int(float(item.get("cntr_amt") or item.get("exec_amt") or (qty * price)))
        if price == 0 and qty > 0 and amount > 0:
            price = round(amount / qty, 2)

        # 수수료/세금
        fee = int(float(item.get("cmsn") or item.get("fee") or 0)) + int(float(item.get("tax") or 0))
        investment = round(amount / 10000, 1)

        # 종목명 / 종목코드
        name = str(item.get("stk_nm") or item.get("item_name") or "").strip()
        ticker = str(item.get("stk_cd") or item.get("item_code") or "").strip()
        if ticker.startswith("A"):
            ticker = ticker[1:]

        ordno = str(item.get("ord_no") or item.get("odno") or "").strip()

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
            "ordno": ordno,
            "_source": "kiwoom_api",
            "account": target_acnt,
        })

    return trades
