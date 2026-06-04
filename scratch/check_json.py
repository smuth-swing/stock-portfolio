"""investigation.json 데이터 구조 확인"""
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CWD = r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'
try:
    with open(CWD + '\\mobile\\data\\investigation.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Data type: {type(data)}")
    print(f"Keys: {data.keys() if isinstance(data, dict) else 'N/A'}")
    
    rows = data.get('data', [])
    print(f"Total rows: {len(rows)}")
    
    print("\nFirst 5 rows:")
    for i, row in enumerate(rows[:5]):
        print(f"[{i}] {row}")
        
except Exception as e:
    print(f"Error: {e}")
