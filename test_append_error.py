import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
rt = CellRichText()
try:
    rt.append(TextBlock(InlineFont(rFont='맑은 고딕'), "test"))
except Exception as e:
    import traceback
    traceback.print_exc()
