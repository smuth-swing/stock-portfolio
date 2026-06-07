import openpyxl
wb2 = openpyxl.load_workbook('test_rich_text2.xlsx', rich_text=True)
cell = wb2.active['A1']
print("Type:", type(cell.value))
if isinstance(cell.value, openpyxl.cell.rich_text.CellRichText):
    for elem in cell.value:
        print("Text:", elem.text, "Strike:", getattr(elem.font, 'strike', False))
else:
    print("Value:", cell.value)
