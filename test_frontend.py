import json
import requests
import time
import urllib.parse

def test_fetch():
    stocks = ["삼성전자", "SK하이닉스", "카카오", "NAVER", "현대차", "기아", "LG화학", "셀트리온", "POSCO홀딩스", "KB금융"]
    
    for stock in stocks:
        url = f"http://127.0.0.1:5000/api/ls/moving-averages?name={urllib.parse.quote(stock)}"
        try:
            res = requests.get(url)
            data = res.json()
            if data.get('success') and data.get('data') and data['data'].get('current'):
                print(f"[OK] {stock}: {data['data']['current']}")
            else:
                print(f"[FAIL] {stock}: {data}")
        except Exception as e:
            print(f"[ERROR] {stock}: {e}")
        
if __name__ == "__main__":
    test_fetch()
