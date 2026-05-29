import sys
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if '매매' in line:
        print(f"Line {i+1}: {line.strip()}")