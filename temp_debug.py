import json
import subprocess

out = subprocess.check_output(['git', 'show', 'HEAD:StockPortfolioApp/public/data/investigation.json'])
old_data = json.loads(out.decode('utf-8'))
old_row = old_data['data'][0]

with open('debug_row.txt', 'w', encoding='utf-8') as f:
    f.write(json.dumps(old_row, ensure_ascii=False))
