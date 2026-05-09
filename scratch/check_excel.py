import pandas as pd
import os

file_path = r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx'
sheet_name = '포트폴리오 맵'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

try:
    xl = pd.ExcelFile(file_path, engine='openpyxl')
    df = pd.read_excel(xl, sheet_name=sheet_name)
    
    # Unnamed: 3 is the stock name column
    # Unnamed: 4 is the first amount column
    
    target_stock = '리가켐'
    start_col_idx = 4 # Unnamed: 4
    
    found = False
    for idx, row in df.iterrows():
        stock_name = str(row.iloc[3]) if len(row) > 3 else ""
        if target_stock in stock_name:
            found = True
            # Count 1s in columns from index 4 onwards
            amount_cells = row.iloc[start_col_idx:]
            count_ones = sum(1 for v in amount_cells if str(v) == '1.0' or str(v) == '1')
            print(f"Stock: {stock_name}")
            print(f"Row Index: {idx}")
            print(f"Count of 1s: {count_ones}")
            print(f"Calculated Amount: {count_ones * 100}")
            
    if not found:
        print(f"Stock '{target_stock}' not found in sheet '{sheet_name}'")

except Exception as e:
    print(f"Error: {e}")
