import json
with open('StockPortfolioApp/public/data/investigation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Row 0:", json.dumps(data['data'][0], ensure_ascii=False))
