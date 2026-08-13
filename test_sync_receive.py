# -*- coding: utf-8 -*-
import requests
import json
import sys

def test_sync_api():
    url = "http://127.0.0.1:5000/api/sync-receive"
    payload = [
        {
            "file": "주식 체크 리스트_20220328.xlsx",
            "sheet": "탐구생활",
            "rowIndex": 0,
            "stockName": "테스트종목",
            "values": ["1", "테스트종목", "테스트질문", "테스트모멘텀", "테스트이유", "테스트리스크", "테스트경영진", "테스트전략", "2026-12-31", "50000"],
            "timestamp": "2026-08-13T20:00:00.000Z"
        }
    ]

    print("[TEST 1] JSON POST 테스트 (모바일 AJAX fetch 요청 패턴)...")
    try:
        res = requests.post(url, json=payload, headers={"Accept": "application/json"}, timeout=60)
        print("  - HTTP Status:", res.status_code)
        print("  - Response:", res.text)
        if res.status_code == 200 and "success" in res.json():
            print("  - JSON POST 테스트 성공!")
        else:
            print("  - JSON POST 테스트 실패")
    except Exception as e:
        print("  - 예외 발생:", e)

    print("\n[TEST 2] Form Data POST 테스트 (기존 폼 제출 패턴)...")
    try:
        res = requests.post(url, data={"payload": json.dumps(payload)}, timeout=60)
        print("  - HTTP Status:", res.status_code)
        print("  - Response Content-Length:", len(res.text))
        if res.status_code == 200 and "PC" in res.text:
            print("  - Form Data POST 테스트 성공!")
        else:
            print("  - Form Data POST 테스트 실패")
    except Exception as e:
        print("  - 예외 발생:", e)

if __name__ == '__main__':
    test_sync_api()
