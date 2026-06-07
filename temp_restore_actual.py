import json
import urllib.request
import urllib.parse
import subprocess

# 1. Get previous JSON
out = subprocess.check_output(['git', 'show', 'HEAD:StockPortfolioApp/public/data/investigation.json'])
old_data = json.loads(out.decode('utf-8'))
old_row = old_data['data'][0]

# Extract values in correct order based on columns
columns = old_data['columns']
values = [old_row.get(col, '') for col in columns]

print("Restoring values:", values)

# 2. Update via API
data = {
    "file": "C:\\Users\\zerod\\OneDrive\\주식 체크 리스트_20220328.xlsx",
    "sheet": "탐구생활",
    "rowIndex": 0,
    "values": values
}

req = urllib.request.Request(
    "http://127.0.0.1:5000/api/update-row",
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print("Restore Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
