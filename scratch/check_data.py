"""현재 JSON 데이터와 엑셀 원본 비교 스크립트"""
import json
import sys
import io
import pandas as pd
sys.stdout.reconfigure(encoding='utf-8')

# 1. 현재 JSON 데이터 확인
print("=" * 60)
print("  현재 GitHub에 올라간 JSON 데이터 확인")
print("=" * 60)

# 매매일지
with open('StockPortfolioApp/public/data/trade_journal.json', encoding='utf-8') as f:
    tj = json.load(f)
print(f"\n[매매일지] 총 {tj['row_count']}행")
cols = tj['columns']
print(f"  컬럼: {cols[:6]}")
print("  마지막 5행:")
for row in tj['data'][-5:]:
    vals = [f"{cols[i]}={row.get(cols[i], '')}" for i in range(min(5, len(cols))) if row.get(cols[i], '')]
    print(f"    행{row.get('_realIndex', '?')}: {' | '.join(vals)}")

# 2. 엑셀 원본 데이터 확인
print("\n" + "=" * 60)
print("  엑셀 원본 데이터 확인 (OneDrive)")
print("=" * 60)

excel_path = r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx'
with open(excel_path, 'rb') as f:
    file_data = f.read()

xl = pd.ExcelFile(io.BytesIO(file_data), engine='openpyxl')
print(f"시트 목록: {xl.sheet_names}")

for sheet in ['매매일지', '포트폴리오 맵', '탐구생활', '실적']:
    if sheet in xl.sheet_names:
        df = pd.read_excel(io.BytesIO(file_data), sheet_name=sheet, engine='openpyxl')
        df = df.fillna('')
        print(f"\n[{sheet}] 엑셀 행수: {len(df)}")
        
        # JSON과 비교
        json_file = {
            '매매일지': 'trade_journal.json',
            '포트폴리오 맵': 'portfolio_map.json',
            '탐구생활': 'investigation.json',
            '실적': 'performance.json',
        }[sheet]
        with open(f'StockPortfolioApp/public/data/{json_file}', encoding='utf-8') as f:
            jd = json.load(f)
        print(f"  JSON 행수: {jd['row_count']}")
        
        if sheet == '매매일지':
            print("  엑셀 마지막 5행:")
            for i in range(max(0, len(df)-5), len(df)):
                row_vals = [f"{df.columns[j]}={df.iloc[i, j]}" for j in range(min(5, len(df.columns))) if str(df.iloc[i, j]).strip()]
                print(f"    행{i}: {' | '.join(row_vals)}")

print("\n" + "=" * 60)
print("  비교 완료")
print("=" * 60)
