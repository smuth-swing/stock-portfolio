import json

with open('StockPortfolioApp/public/data/investigation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    old_row = data['data'][0]

with open('debug_current_row.txt', 'w', encoding='utf-8') as f:
    f.write(json.dumps(old_row, ensure_ascii=False))
