import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CWD = r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'
try:
    with open(CWD + '\\mobile\\data\\investigation.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Columns: {data.get('columns')}")
except Exception as e:
    print(e)
