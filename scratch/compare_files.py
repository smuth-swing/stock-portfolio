with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\scratch\check_CDPCQ04700_page.py', 'r', encoding='utf-8') as f1:
    c1 = f1.read()
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\scratch\check_CDPCQ04700_now6.py', 'r', encoding='utf-8') as f2:
    c2 = f2.read()
import difflib
print(''.join(difflib.unified_diff(c1.splitlines(keepends=True), c2.splitlines(keepends=True))))