import openpyxl
wb = openpyxl.load_workbook("C:\\Users\\zerod\\OneDrive\\주식 체크 리스트_20220328.xlsx", data_only=True)
ws = wb["탐구생활"]
headers = [cell.value for cell in ws[1]]
print("Excel Headers:", headers)
