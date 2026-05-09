import urllib.request
import json

data = {
    "file": "주식 체크 리스트_20220328.xlsx",
    "sheet": "매매일지",
    "row": ["2026-05-06", "두산에너빌리티", 15, 126800, "매수", 2200]
}
body = json.dumps(data, ensure_ascii=False).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5000/api/save-journal',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        print("[테스트 결과]", result)
except Exception as e:
    print("[오류]", e)
