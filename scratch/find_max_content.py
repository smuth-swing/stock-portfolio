"""한세실업, AJ네트웍스 - 내용이 가장 많았던 시점 찾기"""
import subprocess
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CWD = r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'

result = subprocess.run(
    ['git', 'log', '--oneline', '--', 'StockPortfolioApp/public/data/investigation.json'],
    capture_output=True, text=True, encoding='utf-8', cwd=CWD
)
all_commits = []
for line in result.stdout.strip().split('\n'):
    if line.strip():
        parts = line.strip().split(' ', 1)
        all_commits.append((parts[0], parts[1] if len(parts) > 1 else ''))

TARGET_NAMES = ['한세실업', 'AJ네트웍스']

print("=== 각 커밋에서 한세실업/AJ네트웍스 내용 길이 추적 ===\n")

max_hanse = {'commit': '', 'msg': '', 'length': 0, 'content': {}}
max_aj = {'commit': '', 'msg': '', 'length': 0, 'content': {}}

for commit, msg in all_commits:
    try:
        r = subprocess.run(
            ['git', 'show', f'{commit}:StockPortfolioApp/public/data/investigation.json'],
            capture_output=True, text=True, encoding='utf-8', cwd=CWD
        )
        if r.returncode != 0:
            continue
        data = json.loads(r.stdout)
        cols = data['columns']
        
        for row in data['data']:
            name_val = ''
            for col in cols:
                val = str(row.get(col, '')).strip()
                if '한세실업' in val:
                    name_val = '한세실업'
                    break
                if 'AJ네트웍스' in val:
                    name_val = 'AJ네트웍스'
                    break
            
            if not name_val:
                continue
            
            # 전체 내용 길이 계산
            total_len = sum(len(str(row.get(col, ''))) for col in cols)
            content = {col: str(row.get(col, '')) for col in cols if str(row.get(col, '')).strip()}
            
            if name_val == '한세실업' and total_len > max_hanse['length']:
                max_hanse = {'commit': commit, 'msg': msg, 'length': total_len, 'content': content}
            if name_val == 'AJ네트웍스' and total_len > max_aj['length']:
                max_aj = {'commit': commit, 'msg': msg, 'length': total_len, 'content': content}
                
    except Exception:
        pass

print("=" * 80)
print("📌 한세실업 — 가장 내용이 많았던 버전")
print(f"   커밋: {max_hanse['commit']} | {max_hanse['msg']}")
print(f"   총 길이: {max_hanse['length']}자")
for col, val in max_hanse['content'].items():
    print(f"   {col}: {val}")

print()
print("=" * 80)
print("📌 AJ네트웍스 — 가장 내용이 많았던 버전")
print(f"   커밋: {max_aj['commit']} | {max_aj['msg']}")
print(f"   총 길이: {max_aj['length']}자")
for col, val in max_aj['content'].items():
    print(f"   {col}: {val}")

# 현재 버전과 비교
print()
print("=" * 80)
print("📌 현재 버전 (엑셀 원본)")
print("=" * 80)

import io, openpyxl
with open(r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx', 'rb') as f:
    wb = openpyxl.load_workbook(io.BytesIO(f.read()), data_only=True)
ws = wb['탐구생활']
headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]

for r in range(2, ws.max_row + 1):
    for c in range(1, ws.max_column + 1):
        val = str(ws.cell(r, c).value or '')
        if '한세실업' in val or 'AJ네트웍스' in val:
            print(f"\n{val}:")
            total = 0
            for c2 in range(1, ws.max_column + 1):
                v = ws.cell(r, c2).value
                if v is not None:
                    total += len(str(v))
                    print(f"  {headers[c2-1]}: {v}")
            print(f"  (총 {total}자)")
            break
wb.close()
