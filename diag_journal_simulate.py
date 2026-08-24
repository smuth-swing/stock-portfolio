# -*- coding: utf-8 -*-
"""현재 server.py의 read_excel 로직(헤더 승격 부분)을 시뮬레이션"""
import io, sys
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
FULL = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
with open(FULL, 'rb') as f:
    file_data = f.read()

target_sheet = '매매일지'
xl = pd.ExcelFile(io.BytesIO(file_data), engine='openpyxl')
df = pd.read_excel(xl, sheet_name=target_sheet)
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

print("header_row_idx =", header_row_idx)
print("columns =", [str(c) for c in df.columns.tolist()])
print("\nhead(3):")
print(df.head(3).to_string())
print("\nrow_count =", len(df))
