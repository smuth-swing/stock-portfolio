import os
import glob

# 대상 폴더
MOBILE_DIR = os.path.join(os.path.dirname(__file__), "mobile")

def replace_in_file(filepath, old_str, new_str):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content.replace(old_str, new_str)
    if content != new_content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated paths in: {os.path.basename(filepath)}")

if __name__ == "__main__":
    if not os.path.exists(MOBILE_DIR):
        print("mobile folder not found!")
        exit(1)
        
    # index.html, sw.js, manifest.json 경로 수정
    for ext in ["*.html", "*.js", "*.json"]:
        for file in glob.glob(os.path.join(MOBILE_DIR, ext)):
            replace_in_file(file, '"/mobile/', '"/stock-portfolio/mobile/')
            replace_in_file(file, "'/mobile/", "'/stock-portfolio/mobile/")
    
    # 캐시용 해시 파일들도 처리 (필요한 경우)
    js_files = glob.glob(os.path.join(MOBILE_DIR, "_expo", "static", "js", "web", "*.js"))
    for file in js_files:
        replace_in_file(file, '"/mobile/', '"/stock-portfolio/mobile/')
        replace_in_file(file, "'/mobile/", "'/stock-portfolio/mobile/")
