import pandas as pd
import os

onedrive_path = r"C:\Users\zerod\OneDrive"
file_name = "주식 체크 리스트_20220328.xlsx"
full_path = os.path.join(onedrive_path, file_name)

if os.path.exists(full_path):
    print(f"Reading {full_path}...")
    # Read first 20 rows of '실적' sheet without header
    df = pd.read_excel(full_path, sheet_name='실적', header=None, engine='openpyxl')
    print(df.head(20).to_string())
else:
    print(f"File not found: {full_path}")
