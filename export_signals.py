import os
import json
import time
from pathlib import Path

# LS API
from ls_api import fetch_moving_averages, get_stock_codes_by_names, load_config, get_access_token

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'StockPortfolioApp' / 'public' / 'data'
OUT_FILE = DATA_DIR / 'moving_averages.json'

def get_stocks_from_json():
    stocks = set()
    
    # 1. 포트폴리오 맵에서 추출
    try:
        with open(DATA_DIR / 'portfolio_map.json', 'r', encoding='utf-8') as f:
            port_data = json.load(f)
            cols = port_data.get('columns', [])
            stockCol = '종목' if '종목' in cols else 'Unnamed: 3'
            
            if port_data.get('data') and len(port_data['data']) > 0:
                first_row = port_data['data'][0]
                amountKeys = []
                for k in first_row.keys():
                    if k.startswith('Unnamed: '):
                        try:
                            num = int(k.split(' ')[1])
                            if num >= 4:
                                amountKeys.append(k)
                        except (IndexError, ValueError):
                            pass
                
                for row in port_data['data']:
                    name = str(row.get(stockCol, '')).strip()
                    if name and name not in ['종목', 'stock']:
                        has_one = any(float(row.get(k, 0) or 0) == 1 for k in amountKeys)
                        if has_one:
                            stocks.add(name)
    except Exception as e:
        print(f"포트폴리오 파싱 오류: {e}")

    # 2. 탐구생활에서 추출
    try:
        with open(DATA_DIR / 'investigation.json', 'r', encoding='utf-8') as f:
            inv_data = json.load(f)
            cols = inv_data.get('columns', [])
            nameCol = '종목명' if '종목명' in cols else 'Unnamed: 1'
            momentumCol = '모멘텀' if '모멘텀' in cols else 'Unnamed: 2'
            strategyCol = '매매 전략' if '매매 전략' in cols else 'Unnamed: 6'
            
            for row in inv_data.get('data', []):
                name = str(row.get(nameCol, '')).strip()
                momentum = str(row.get(momentumCol, '')).strip()
                strategy = str(row.get(strategyCol, '')).strip()
                if name and name not in ['종목', 'stock'] and '~~' not in name:
                    if momentum or strategy:
                        stocks.add(name)
    except Exception as e:
        print(f"탐구생활 파싱 오류: {e}")
        
    return list(stocks)

MAX_RETRIES = 3  # 실패 시 최대 재시도 횟수

def main():
    print("="*60)
    print("  신호 포착 데이터(이평선/RSI) 자동 수집 시작")
    print("="*60)
    
    stocks = get_stocks_from_json()
    print(f"대상 종목 수: {len(stocks)}개")
    
    if not stocks:
        print("대상 종목이 없습니다.")
        return

    # 이전 성공 데이터 로드 (실패 시 fallback용)
    prev_results = {}
    if OUT_FILE.exists():
        try:
            with open(OUT_FILE, 'r', encoding='utf-8') as f:
                prev_results = json.load(f)
            print(f"이전 캐시 데이터 로드 완료 ({len(prev_results)}개 종목)")
        except Exception:
            pass

    cfg = load_config()
    token = get_access_token(cfg.get("app_key", ""), cfg.get("app_secret", ""))
    if not token:
        print("LS증권 API 토큰 발급 실패!")
        return
        
    name_to_code = get_stock_codes_by_names(token, stocks)
    
    results = {}
    failed_stocks = []  # 실패 종목 목록 (재시도 대상)
    
    for i, stock in enumerate(stocks):
        shcode = name_to_code.get(stock)
        print(f"[{i+1}/{len(stocks)}] {stock} ({shcode}) 조회 중...", end="", flush=True)
        if not shcode:
            print(" -> 코드 없음")
            results[stock] = {"error": "코드 없음"}
            continue
            
        try:
            data = fetch_moving_averages(shcode)
            results[stock] = data
            print(" -> 완료")
        except Exception as e:
            print(f" -> 실패 ({e})")
            failed_stocks.append((stock, shcode))
            
        # API 속도 제한 고려 (1초 대기)
        time.sleep(1)
    
    # 실패한 종목 재시도 (최대 MAX_RETRIES회)
    for retry in range(1, MAX_RETRIES + 1):
        if not failed_stocks:
            break
        print(f"\n--- 재시도 {retry}/{MAX_RETRIES} ({len(failed_stocks)}개 종목) ---")
        time.sleep(3)  # 재시도 전 대기
        
        still_failed = []
        for stock, shcode in failed_stocks:
            print(f"  재시도: {stock} ({shcode})...", end="", flush=True)
            try:
                data = fetch_moving_averages(shcode)
                results[stock] = data
                print(" -> 성공!")
            except Exception as e:
                print(f" -> 실패 ({e})")
                still_failed.append((stock, shcode))
            time.sleep(1)
        
        failed_stocks = still_failed

    # 재시도 후에도 실패한 종목은 이전 캐시 데이터로 대체
    for stock, shcode in failed_stocks:
        prev_data = prev_results.get(stock)
        if prev_data and prev_data.get('current'):
            results[stock] = prev_data
            print(f"  {stock}: 이전 캐시 데이터 사용 (current={prev_data['current']})")
        else:
            results[stock] = {"error": "조회 실패 (재시도 초과)"}
            print(f"  {stock}: 이전 캐시도 없음, 에러로 기록")
        
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 종목명 -> 코드 매핑 파일 저장
    CODES_FILE = DATA_DIR / 'stock_codes.json'
    try:
        existing_codes = {}
        if CODES_FILE.exists():
            with open(CODES_FILE, 'r', encoding='utf-8') as f:
                existing_codes = json.load(f)
        existing_codes.update(name_to_code)
        with open(CODES_FILE, 'w', encoding='utf-8') as f:
            json.dump(existing_codes, f, ensure_ascii=False, indent=2)
        print(f"종목 코드 매핑 저장 완료: {CODES_FILE}")
    except Exception as e:
        print(f"종목 코드 매핑 저장 실패: {e}")
    
    success_count = sum(1 for v in results.values() if v.get('current'))
    fail_count = sum(1 for v in results.values() if v.get('error'))
    print(f"\n데이터 저장 완료: {OUT_FILE}")
    print(f"  성공: {success_count}개 / 실패: {fail_count}개")

if __name__ == '__main__':
    main()
