import sys
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find("if (data.current_sheet === '매매일지') {")
print(content[idx:idx+300])