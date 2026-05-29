import sys
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = "if (tablePanel) tablePanel.classList.remove('hidden'); // 테이블 표시 유지"
new_str = "if (tablePanel) tablePanel.classList.add('hidden'); // 테이블 표시 숨김 (사용자 요청)"

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully!")
else:
    print("Could not find the string to replace.")