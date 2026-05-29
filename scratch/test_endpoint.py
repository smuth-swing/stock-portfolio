import requests
import json

url = 'http://127.0.0.1:5000/api/ls/fetch-trades'
payload = {
    'from_date': '20260522',
    'to_date': '20260529',
    'stock_code': ''
}
try:
    resp = requests.post(url, json=payload, timeout=10)
    print("Status:", resp.status_code)
    data = resp.json()
    if 'trades' in data:
        print("Trades count:", len(data['trades']))
        for t in data['trades'][:5]:
            print(t)
    else:
        print(data)
except Exception as e:
    print(e)