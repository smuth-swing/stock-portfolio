import os

filepath = r"c:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("".join(lines[534:667]))
