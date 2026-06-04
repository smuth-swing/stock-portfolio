"""엑셀 파일의 내부 수정 시각 확인 및 핸드폰 수정 내용 검증"""
import json
import sys
import io
import os
import pandas as pd
import openpyxl
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

excel_path = r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx'

# 1. 파일 시스템 수정 시각
mtime = os.path.getmtime(excel_path)
print(f"파일 시스템 수정 시각: {datetime.fromtimestamp(mtime)}")

# 2. 엑셀 내부 메타데이터 확인
wb = openpyxl.load_workbook(excel_path, data_only=True)
props = wb.properties
print(f"엑셀 내부 수정자: {props.lastModifiedBy}")
print(f"엑셀 내부 수정 시각: {props.modified}")
print(f"엑셀 내부 생성 시각: {props.created}")
print(f"엑셀 내부 생성자: {props.creator}")

# 3. 각 시트의 데이터 확인
print("\n" + "=" * 60)
print("  시트별 데이터 요약")
print("=" * 60)

with open(excel_path, 'rb') as f:
    file_data = f.read()

for sheet in wb.sheetnames:
    df = pd.read_excel(io.BytesIO(file_data), sheet_name=sheet, engine='openpyxl')
    df = df.fillna('')
    print(f"\n[{sheet}] {len(df)}행")
    
    # 날짜 관련 컬럼이 있으면 최근 날짜 확인
    for col in df.columns:
        try:
            dates = pd.to_datetime(df[col], errors='coerce')
            valid_dates = dates.dropna()
            if len(valid_dates) > 5:
                max_date = valid_dates.max()
                print(f"  최신 날짜({col}): {max_date.strftime('%Y-%m-%d')}")
                break
        except:
            pass

wb.close()
