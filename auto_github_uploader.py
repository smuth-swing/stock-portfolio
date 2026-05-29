"""
auto_github_uploader.py — 엑셀 파일 변경 감지 시 GitHub 자동 업로드

동작 방식:
1. OneDrive의 엑셀 파일을 10초마다 감시
2. 파일이 저장되면 5초 대기 후 자동 업로드 시작
3. 모든 동작을 upload_log.txt에 기록
"""

import os
import time
import subprocess
import logging
from datetime import datetime

# ==================== 설정 ====================
WATCH_FILE = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
PROJECT_DIR = r"c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
PYTHON_EXE = r"C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
LOG_FILE = os.path.join(PROJECT_DIR, "upload_log.txt")
EXPORT_SCRIPT = os.path.join(PROJECT_DIR, "export_to_json.py")

# ==================== 로그 설정 ====================
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    encoding="utf-8",
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger().addHandler(console)

log = logging.getLogger(__name__)

last_mtime = 0


def run_git_upload():
    """JSON 변환 → 모바일 파일 복사 → GitHub push"""
    log.info("=== GitHub 자동 업로드 시작 ===")

    try:
        # 1단계: JSON 내보내기
        log.info("1. JSON 내보내기 중...")
        result = subprocess.run(
            [PYTHON_EXE, EXPORT_SCRIPT],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,
        )
        if result.returncode != 0:
            log.error(f"   JSON 내보내기 실패: {result.stderr[:300]}")
            return False
        log.info("   JSON 내보내기 완료")

        # 2단계: 모바일 데이터 복사
        log.info("2. 모바일 데이터 복사 중...")
        mobile_data_src = os.path.join(PROJECT_DIR, "StockPortfolioApp", "public", "data")
        mobile_data_dst = os.path.join(PROJECT_DIR, "mobile", "data")
        if os.path.exists(mobile_data_src):
            subprocess.run(
                ["xcopy", mobile_data_src, mobile_data_dst, "/E", "/I", "/Y"],
                cwd=PROJECT_DIR,
                capture_output=True,
                shell=True,
            )
        log.info("   모바일 데이터 복사 완료")

        # 3단계: git add
        log.info("3. Git 스테이징 중...")
        subprocess.run(["git", "add", "."], cwd=PROJECT_DIR, capture_output=True)

        # 4단계: git commit (변경사항이 없으면 건너뜀)
        log.info("4. Git 커밋 중...")
        commit_msg = f"Auto update data {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        result = subprocess.run(
            ["git", "commit", "-m", commit_msg],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode != 0 and "nothing to commit" in result.stdout:
            log.info("   변경사항 없음, 커밋 건너뜀")
            return True

        # 5단계: git push
        log.info("5. GitHub push 중...")
        result = subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=60,
        )
        if result.returncode == 0:
            log.info("=== GitHub 업로드 성공! ===")
            log.info(f"   주소: https://smuth-swing.github.io/stock-portfolio")
            return True
        else:
            log.error(f"   GitHub push 실패: {result.stderr[:300]}")
            return False

    except subprocess.TimeoutExpired:
        log.error("   시간 초과 오류 (120초 내 완료 안됨)")
        return False
    except Exception as e:
        log.error(f"   예외 발생: {e}")
        return False


def check_file():
    """엑셀 파일 변경 감지"""
    global last_mtime
    try:
        if not os.path.exists(WATCH_FILE):
            return

        current_mtime = os.path.getmtime(WATCH_FILE)
        if last_mtime == 0:
            last_mtime = current_mtime
            log.info(f"파일 감시 시작: {WATCH_FILE}")
        elif current_mtime > last_mtime:
            log.info(f"엑셀 파일 변경 감지! 5초 후 업로드 시작...")
            last_mtime = current_mtime
            time.sleep(5)  # 엑셀이 완전히 저장될 때까지 대기
            run_git_upload()

    except Exception as e:
        log.error(f"파일 감시 오류: {e}")


if __name__ == "__main__":
    log.info("=" * 50)
    log.info("auto_github_uploader 시작됨")
    log.info(f"감시 파일: {WATCH_FILE}")
    log.info("=" * 50)

    while True:
        check_file()
        time.sleep(10)  # 10초마다 확인
