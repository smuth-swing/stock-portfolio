import urllib.request
import json

# 줄바꿈(\n) 포함 데이터로 update-row 테스트
data = {
    "file": "주식 체크 리스트_20220328.xlsx",
    "sheet": "탐구생활",
    "rowIndex": 0,
    "values": ["1", "테스트종목", "줄바꿈\n테스트\n내용입니다", "매수 이유 첫줄\n두번째 줄", "리스크", "대표", "전략변경"]
}
body = json.dumps(data, ensure_ascii=False).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5000/api/update-row',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        print("[줄바꿈 저장 테스트 결과]", result)
except Exception as e:
    print("[오류]", e)
