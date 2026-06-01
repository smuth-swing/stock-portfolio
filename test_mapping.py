import json
import pandas as pd
import requests
import io
import os
from ls_api import get_access_token, load_config, LS_BASE_URL, get_stock_codes_by_names, _stock_name_cache

def test_missing_stocks():
    # 1. Read portfolio names from Excel
    excel_path = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
    if not os.path.exists(excel_path):
        print("Excel not found")
        return
        
    df = pd.read_excel(excel_path, sheet_name="포트폴리오 맵", engine='openpyxl')
    
    # Portfolio stock names are in column D (index 3)
    stock_names = []
    for val in df.iloc[:, 3].dropna().unique():
        v = str(val).strip()
        if v and v != "종목" and v != "stock":
            stock_names.append(v)
            
    print(f"Total distinct portfolio stocks: {len(stock_names)}")
    
    # 2. Get API token and stock codes
    cfg = load_config()
    token = get_access_token(cfg["app_key"], cfg["app_secret"])
    
    # Pre-warm cache
    get_stock_codes_by_names(token, ["삼성전자"])
    
    print(f"Total items in LS stock cache: {len(_stock_name_cache)}")
    
    name_to_code = {v: k for k, v in _stock_name_cache.items()}
    name_to_code_clean = {v.replace(" ", "").lower(): k for k, v in _stock_name_cache.items()}
    
    missing = []
    found = []
    for name in stock_names:
        if name in name_to_code:
            found.append(name)
        else:
            # try fuzzy matching (remove spaces)
            clean_name = name.replace(" ", "").lower()
            if clean_name in name_to_code_clean:
                found.append(f"{name} (matched as {clean_name})")
            else:
                missing.append(name)
                
    print(f"\nFound: {len(found)}")
    print(f"Missing: {len(missing)}")
    print("\nMissing Stocks:")
    for m in missing:
        print(f" - {m}")

if __name__ == "__main__":
    test_missing_stocks()
