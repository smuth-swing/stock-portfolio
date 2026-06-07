import json
import subprocess

out = subprocess.check_output(['git', 'show', 'HEAD:StockPortfolioApp/public/data/investigation.json'])
old_data = json.loads(out.decode('utf-8'))
print(json.dumps(old_data['columns'], ensure_ascii=False))
