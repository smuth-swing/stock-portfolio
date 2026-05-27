import os
import time
import subprocess

WATCH_FILE = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
PROJECT_DIR = r"c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
PYTHON_EXE = r"C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
EXPORT_SCRIPT = os.path.join(PROJECT_DIR, "export_to_json.py")

last_mtime = 0

def upload_to_github():
    try:
        # 통합된 배치 스크립트 실행 (JSON 변환, 모바일 복사, GitHub 푸시 전체 수행)
        bat_file = os.path.join(PROJECT_DIR, "upload_to_cloud.bat")
        subprocess.run([bat_file], cwd=PROJECT_DIR, creationflags=subprocess.CREATE_NO_WINDOW)
    except Exception:
        pass

def check_file():
    global last_mtime
    try:
        if not os.path.exists(WATCH_FILE):
            return
            
        current_mtime = os.path.getmtime(WATCH_FILE)
        if last_mtime == 0:
            last_mtime = current_mtime
        elif current_mtime > last_mtime:
            # 엑셀 파일이 저장됨을 감지
            last_mtime = current_mtime
            
            # 엑셀이 완전히 저장될 때까지 5초 대기 (파일 잠금 충돌 방지)
            time.sleep(5) 
            upload_to_github()
            
    except Exception:
        pass

if __name__ == "__main__":
    while True:
        check_file()
        time.sleep(10) # 10초마다 파일 저장 여부 확인
