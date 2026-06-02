import json

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\mobile\data\investigation.json', encoding='utf-8') as f:
    data = json.load(f)

print("file_name:", data.get('file_name'))
print("_filePath:", data.get('_filePath'))
print("current_sheet:", data.get('current_sheet'))
print("columns:", data.get('columns'))
print()
print("row[0]:", data['data'][0])
print("row[1]:", data['data'][1])
print("row[2]:", data['data'][2])
print("row[3]:", data['data'][3])
print("row[4]:", data['data'][4])
