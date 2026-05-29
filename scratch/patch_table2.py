import sys
import re
with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# search for "if (data.current_sheet === '매매일지') {" and then the next tablePanel
idx = content.find("if (data.current_sheet === '매매일지') {")
if idx != -1:
    end_idx = content.find("}", idx)
    chunk = content[idx:end_idx]
    
    # replace "tablePanel.classList.remove('hidden')" with "tablePanel.classList.add('hidden')"
    new_chunk = chunk.replace("tablePanel.classList.remove('hidden')", "tablePanel.classList.add('hidden')")
    content = content[:idx] + new_chunk + content[end_idx:]
    
    with open(r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully!")
else:
    print("Could not find 매매일지 block.")