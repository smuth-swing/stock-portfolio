"""90행 버전(핸드폰 수정본)과 현재 66행 버전 비교"""
import subprocess
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CWD = r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'

# 90행 버전 (3fb2e3e - 06-02 21:37)
r = subprocess.run(
    ['git', 'show', '3fb2e3e:StockPortfolioApp/public/data/investigation.json'],
    capture_output=True, text=True, encoding='utf-8', cwd=CWD
)
old_data = json.loads(r.stdout)

# 현재 66행 버전
with open(CWD + r'\StockPortfolioApp\public\data\investigation.json', encoding='utf-8') as f:
    new_data = json.load(f)

print("=== 90행 버전 (3fb2e3e - 06/02 21:37) ===")
print(f"행수: {old_data['row_count']}")
print(f"컬럼: {old_data['columns']}")
print()

# 90행 버전에만 있고 현재에 없는 데이터 찾기
old_names = set()
new_names = set()
for row in old_data['data']:
    name = row.get('종목명', '') or row.get(old_data['columns'][1] if len(old_data['columns']) > 1 else '', '')
    if name:
        old_names.add(name)

for row in new_data['data']:
    name = row.get('종목명', '')
    if name:
        new_names.add(name)

missing = old_names - new_names
added = new_names - old_names

print(f"90행 버전의 종목 수: {len(old_names)}")
print(f"현재 66행 버전의 종목 수: {len(new_names)}")
print(f"\n=== 90행에 있었지만 현재 없는 종목 ({len(missing)}개) ===")
for name in sorted(missing):
    print(f"  - {name}")

print(f"\n=== 현재에 추가된 종목 ({len(added)}개) ===")
for name in sorted(added):
    print(f"  + {name}")

# 90행 버전의 전체 종목 목록 출력
print("\n=== 90행 버전 전체 데이터 ===")
for row in old_data['data']:
    cols = old_data['columns']
    num = row.get(cols[0], '') if cols else ''
    name = row.get(cols[1], '') if len(cols) > 1 else ''
    momentum = str(row.get(cols[2], ''))[:30] if len(cols) > 2 else ''
    print(f"  {str(num):>4s} | {name:12s} | {momentum}")
