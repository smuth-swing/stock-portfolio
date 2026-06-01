# -*- coding: utf-8 -*-
import requests
import json

payload = [
    {
        "file": "주식 체크 리스트_20220328.xlsx",
        "sheet": "탐구생활",
        "rowIndex": 0,
        "values": ["Test0", "Test1", "Test2", "Test3", "Test4", "Test5", "Test6"]
    }
]

print("Sending POST request...")
try:
    r = requests.post("http://127.0.0.1:5000/api/sync-receive", data={"payload": json.dumps(payload)}, timeout=10)
    print("Status:", r.status_code)
    print("Response Length:", len(r.text))
    print(r.text)
except Exception as e:
    print("Error:", e)
