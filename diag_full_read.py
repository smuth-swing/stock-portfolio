# -*- coding: utf-8 -*-
"""read_excel 전체 경로 시뮬레이션 (현재 파일 상태 기준)"""
import io, sys
import pandas as pd
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
FULL = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
with open(FULL, 'rb') as f:
    file_data = f.read()

target_sheet = '매매일지'
xl = pd.ExcelFile(io.BytesIO(file_data), engine='openpyxl')
df = pd.read_excel(xl, sheet_name=target_sheet)
print("초기 columns:", [str(c) for c in df.columns.tolist()][:8])
print("초기 row0:", [repr(x)[:25] for x in df.iloc[0].values[:8]])
print("초기 row1:", [repr(x)[:25] for x in df.iloc[1].values[:8]])

df = df.fillna('')

header_row_idx = 0
is_unnamed_header = any(str(c).startswith('Unnamed:') for c in df.columns)
if not df.empty and (is_unnamed_header or "실적" in target_sheet or "매매" in target_sheet):
    keywords = ["Date", "종목", "날짜", "수량", "가격", "매매유형", "연도", "수익율", "종목명"]
    for i in range(min(10, len(df))):
        row_vals = [str(x).strip() for x in df.iloc[i].values]
        if any(k in row_vals for k in keywords):
            header_row_idx = i
            new_cols = []
            for j, val in enumerate(row_vals):
                if val and val != 'nan':
                    new_cols.append(val)
                else:
                    new_cols.append(f"Unnamed: {j}")
            df.columns = new_cols
            df = df.iloc[i+1:].reset_index(drop=True)
            break

print("\n승격 후 header_row_idx =", header_row_idx)
print("승격 후 columns:", [str(c) for c in df.columns.tolist()][:8])
print("승격 후 row0:", [repr(x)[:25] for x in df.iloc[0].values[:8]])

# 숫자 변환 (서버 코드 그대로)
for col in df.columns:
    if '연도' in str(col): continue
    try:
        temp_numeric = pd.to_numeric(df[col].replace('', pd.NA), errors='coerce')
        if temp_numeric.notna().any():
            if temp_numeric.notna().sum() / len(df) > 0.2:
                df[col] = temp_numeric.fillna(0)
                print(f"  [변환됨] {col!r} (ratio={temp_numeric.notna().sum()/len(df):.3f})")
    except Exception as e:
        print(f"  [오류] {col!r}: {e}")

print("\n변환 후 row0:", [repr(x)[:25] for x in df.iloc[0].values[:8]])
print("변환 후 row1:", [repr(x)[:25] for x in df.iloc[1].values[:8]])
print("변환 후 마지막행:", [repr(x)[:25] for x in df.iloc[-1].values[:8]])
print("\ndtypes:", df.dtypes.head(6).to_dict())
