import json
with open('StockPortfolioApp/public/data/investigation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    for i, row in enumerate(data['data']):
        for k, v in row.items():
            if '덕산네오룩스' in str(v):
                print(f"Found in row {i} (realIndex {row.get('_realIndex')}): {v}")
