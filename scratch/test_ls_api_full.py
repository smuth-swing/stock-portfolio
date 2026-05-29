import os, sys, json
sys.path.append(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리')
from ls_api import load_config, get_access_token, LS_BASE_URL
import requests
from datetime import datetime, timedelta

def test_fetch():
    cfg = load_config()
    app_key = cfg.get('app_key')
    app_secret = cfg.get('app_secret')
    account = cfg.get('account')
    account_pw = cfg.get('account_pw')
    
    if not all([app_key, app_secret, account, account_pw]):
        print('설정 누락')
        return
        
    token = get_access_token(app_key, app_secret)
    
    # 3달 전부터 오늘까지로 길게 조회해봄
    to_date = datetime.now().strftime('%Y%m%d')
    from_date = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
    
    print(f'조회 기간: {from_date} ~ {to_date}')
    
    all_raw = []
    cts_ordno = ""
    for page in range(5): # 최대 5페이지만 테스트
        print(f'--- 페이지 {page+1} ---')
        headers = {
            'content-type': 'application/json; charset=utf-8',
            'authorization': f'Bearer {token}',
            'tr_cd': 't0425',
            'tr_cont': 'Y' if cts_ordno else 'N',
            'tr_cont_key': cts_ordno,
            'mac_address': ''
        }
        body = {
            't0425InBlock': {
                'accno': account,
                'passwd': account_pw,
                'expcode': '',
                'chegb': '0',
                'medosu': '0',
                'sortgb': '1',
                'cts_ordno': cts_ordno,
                'fromdate': from_date,
                'todate': to_date
            }
        }
        
        resp = requests.post(
            f'{LS_BASE_URL}/stock/accno',
            headers=headers,
            json=body,
            timeout=15
        )
        result = resp.json()
        print(f'HTTP: {resp.status_code}')
        print(f'RSP_CD: {result.get("rsp_cd")}, MSG: {result.get("rsp_msg")}')
        
        # 헤더의 tr_cont 확인
        resp_tr_cont = resp.headers.get('tr_cont', '').strip()
        print(f'tr_cont (헤더): {resp_tr_cont}')
        
        raw_list = result.get('t0425OutBlock1', [])
        print(f'가져온 건수: {len(raw_list)}')
        all_raw.extend(raw_list)
        
        out_block = result.get('t0425OutBlock', {})
        next_key = str(out_block.get('cts_ordno', '')).strip() if out_block else ''
        print(f'응답받은 next_key (cts_ordno): {next_key}')
        
        if resp_tr_cont == 'Y' and next_key and next_key != '0000000000':
            cts_ordno = next_key
        else:
            print('다음 페이지 없음. 종료.')
            break
            
    print(f'전체 수집 원시 데이터 수: {len(all_raw)}')
    
    # 정제
    valid_count = 0
    for item in all_raw:
        cheqty = int(item.get('cheqty', 0) or 0)
        if cheqty > 0:
            valid_count += 1
            
    print(f'체결 수량 > 0 인 유효 건수: {valid_count}')

if __name__ == '__main__':
    test_fetch()