import openpyxl
wb = openpyxl.load_workbook('test_integration.xlsx', rich_text=True)
ws = wb["탐구생활"]
cell = ws['A1']
for part in cell.value:
    print("Text:", part.text, "Strike:", part.font.strike, type(part.font.strike))
