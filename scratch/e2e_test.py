import json, openpyxl

with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\StockPortfolioApp\public\data\investigation.json', encoding='utf-8') as f:
    data = json.load(f)

wb = openpyxl.load_workbook(r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx')
ws = wb['탐구생활']

# 종목명(Unnamed:1)으로 매핑 검증 (타입 무관)
allItems = data['data'][2:]
print('=== 종목명 기준 매핑 검증 (offset=+2) ===')
all_match = True
for i, item in enumerate(allItems[:15]):
    realIndex = i + 2
    target_row = realIndex + 2  # offset +2
    json_name = str(item.get('Unnamed: 1', ''))
    excel_name = str(ws.cell(row=target_row, column=2).value or '')
    match = json_name == excel_name
    if not match:
        all_match = False
    mark = "OK" if match else "MISMATCH!"
    print(f'  realIndex={realIndex} -> row={target_row}: JSON=[{json_name[:20]}] EXCEL=[{excel_name[:20]}] {mark}')

print()
if all_match:
    print('전체 매칭 결과: 모두 일치!')
else:
    print('전체 매칭 결과: 불일치 발견!')

# E2E 테스트: 실제 서버로 전송 후 엑셀 저장 확인
print()
print('=== E2E 테스트: 덕산네오룩스(realIndex=2)에 테스트 데이터 전송 ===')

import urllib.request, urllib.parse

columns = data.get('columns', [])
row = data['data'][2]  # 덕산네오룩스

# 수정할 내용
newRowData = dict(row)
newRowData['Unnamed: 3'] = 'E2E_TEST_매수이유'
newRowData['Unnamed: 4'] = 'E2E_TEST_리스크'

values = [newRowData.get(col, '') if newRowData.get(col) is not None else '' for col in columns]

payload = [{
    'file': data.get('file_name', ''),
    'sheet': data.get('current_sheet', ''),
    'rowIndex': 2,
    'values': values,
}]

print(f'file: {payload[0]["file"]}')
print(f'sheet: {payload[0]["sheet"]}')
print(f'rowIndex: {payload[0]["rowIndex"]}')
print(f'values: {values}')
print(f'예상 target_row: {2 + 2} = 4')

payload_str = urllib.parse.quote(json.dumps(payload))
url = f'http://127.0.0.1:5000/api/sync-receive?payload={payload_str}'

try:
    response = urllib.request.urlopen(url, timeout=15)
    print(f'서버 응답: {response.status}')
except Exception as e:
    print(f'서버 에러: {e}')

# 저장 결과 확인
wb2 = openpyxl.load_workbook(r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx')
ws2 = wb2['탐구생활']
print()
print('=== 저장 결과 확인 (row=4, 덕산네오룩스) ===')
for c in range(1, 8):
    val = ws2.cell(row=4, column=c).value
    print(f'  col{c}: {repr(val)}')

# 매수이유가 col4에 들어갔는지 확인
col4_val = ws2.cell(row=4, column=4).value
col5_val = ws2.cell(row=4, column=5).value
print()
if col4_val == 'E2E_TEST_매수이유' and col5_val == 'E2E_TEST_리스크':
    print('>>> E2E 테스트 성공! 매수이유와 리스크가 정확한 열에 저장됨')
else:
    print(f'>>> E2E 테스트 실패! col4={repr(col4_val)}, col5={repr(col5_val)}')

# 테스트 데이터 정리 (원복)
ws2.cell(row=4, column=4).value = None
ws2.cell(row=4, column=5).value = None
wb2.save(r'C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx')
print('테스트 데이터 원복 완료')
wb2.close()
