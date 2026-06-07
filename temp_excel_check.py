import openpyxl
wb = openpyxl.load_workbook("C:\\Users\\zerod\\OneDrive\\주식 체크 리스트_20220328.xlsx", data_only=True)
ws = wb["탐구생활"]
for i in range(1, 3):
    print(f"Row {i}:", [cell.value for cell in ws[i]])
