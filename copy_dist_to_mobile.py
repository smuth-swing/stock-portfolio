import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'StockPortfolioApp', 'dist')
MOBILE_DIR = os.path.join(BASE_DIR, 'mobile')

def copy_build_to_mobile():
    if not os.path.exists(DIST_DIR):
        print(f"[ERROR] dist 폴더가 없습니다: {DIST_DIR}")
        return False

    print(f"[COPY] {DIST_DIR} -> {MOBILE_DIR} 복사 시작...")
    
    # 1) _expo 디렉토리 복사
    dist_expo = os.path.join(DIST_DIR, '_expo')
    mobile_expo = os.path.join(MOBILE_DIR, '_expo')
    if os.path.exists(dist_expo):
        if os.path.exists(mobile_expo):
            shutil.rmtree(mobile_expo)
        shutil.copytree(dist_expo, mobile_expo)
        print("  - _expo 복사 완료")

    # 2) 파일 단위 복사 (index.html, manifest.json 등)
    for fname in os.listdir(DIST_DIR):
        src_path = os.path.join(DIST_DIR, fname)
        if os.path.isfile(src_path):
            dst_path = os.path.join(MOBILE_DIR, fname)
            shutil.copy2(src_path, dst_path)
            print(f"  - {fname} 복사 완료")

    print("[SUCCESS] mobile 디렉터리로 최신 웹 빌드 반영 완료!")
    return True

if __name__ == '__main__':
    copy_build_to_mobile()
