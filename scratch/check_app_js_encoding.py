import sys
try:
    with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'r', encoding='utf-8') as f:
        content = f.read()
    if '날짜' in content or '계좌' in content:
        print("Korean is intact!")
    else:
        print("Korean characters are missing or corrupted.")
        # print some surrounding text to see what happened
        idx = content.find('setLsDateRange(0)')
        print(content[idx-50:idx+50])
except Exception as e:
    print(e)