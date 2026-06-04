"""URL 길이 테스트 스크립트"""
import urllib.parse
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

sample_item = {
    "file": "investigation.xlsx",
    "sheet": "탐구생활",
    "rowIndex": 2,
    "values": ["1", "한세실업", "모멘텀 엄청 길게 씀..." * 10, "매수이유 엄청 길게 씀..." * 10, "리스크 엄청 길게 씀..." * 10, "대표 엄청 길게 씀..." * 10, "전략 엄청 길게 씀..." * 10],
    "timestamp": "2026-06-04T12:00:00.000Z"
}

payload = [sample_item] * 11
payload_str = json.dumps(payload)
encoded = urllib.parse.quote(payload_str)
print(f"11 items payload length: {len(payload_str)} characters")
print(f"Encoded URL payload length: {len(encoded)} characters")
