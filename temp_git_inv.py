import json
import subprocess

out = subprocess.check_output(['git', 'show', 'HEAD:StockPortfolioApp/public/data/investigation.json'])
data = json.loads(out.decode('utf-8'))
print(json.dumps(data['data'][0], ensure_ascii=False))
