import pandas as pd
import sys

def check_names():
    excel_path = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
    df = pd.read_excel(excel_path, sheet_name="포트폴리오 맵", engine='openpyxl')
    
    # Portfolio stock names are in column D (index 3)
    stock_names = []
    for val in df.iloc[:, 3].dropna().unique():
        v = str(val).strip()
        if v and v != "종목" and v != "stock":
            stock_names.append(v)
            
    # print names cleanly
    for s in stock_names:
        print(s.encode('utf-8').decode('utf-8'))

if __name__ == "__main__":
    check_names()
