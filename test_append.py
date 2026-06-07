import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
rt = CellRichText()
rt.append(TextBlock(InlineFont(rFont='맑은 고딕'), "test"))
