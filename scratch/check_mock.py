import json
try:
    with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\ls_api_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)
        acc = cfg.get('account', '')
        print(f"계좌번호 앞 3자리: {acc[:3]}")
except Exception as e:
    print(e)