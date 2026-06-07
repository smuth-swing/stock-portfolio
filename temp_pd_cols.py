import pandas as pd
import io
import openpyxl

with open("C:\\Users\\zerod\\OneDrive\\주식 체크 리스트_20220328.xlsx", "rb") as f:
    df = pd.read_excel(io.BytesIO(f.read()), sheet_name="탐구생활", engine='openpyxl')
print(df.columns.tolist())
