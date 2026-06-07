import urllib.request
import urllib.parse
import json

data = {
    "file": "C:\\Users\\zerod\\OneDrive\\주식 체크 리스트_20220328.xlsx",
    "sheet": "탐구생활",
    "rowIndex": 0,
    "values": ["2026-06-07", "Test Stock", "~~Strikethrough Test~~", "Test", "Test", "Test", "Test"]
}

req = urllib.request.Request(
    "http://127.0.0.1:5000/api/update-row",
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
