from openpyxl.cell.text import InlineFont
f = InlineFont(strike=True)
print(dir(f))
print("strike:", getattr(f, 'strike', None))
