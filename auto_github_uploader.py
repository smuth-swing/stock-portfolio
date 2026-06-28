"""
auto_github_uploader.py -- 엑셀 파일 변경 감지 시 GitHub 자동 업로드

동작 방식:
1. OneDrive의 엑셀 파일을 10초마다 감시
2. 파일이 저장되면 5초 대기 후 자동 업로드 시작
3. 모든 동작을 upload_log.txt에 기록
"""

import os
import time
import subprocess
import logging
import logging.handlers
from datetime import datetime

# Windows 콘솔 창 팝업 방지 플래그
CREATE_NO_WINDOW = 0x08000000

# ==================== 설정 ====================
WATCH_FILE  = r"C:\Users\zerod\OneDrive\주식 체크 리스트_20220328.xlsx"
PROJECT_DIR = r"c:\Users\zerod\.antigravity\주식 포트폴리오 관리"
PYTHON_EXE  = r"C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
LOG_FILE    = os.path.join(PROJECT_DIR, "upload_log.txt")
EXPORT_SCRIPT = os.path.join(PROJECT_DIR, "export_to_json.py")

# ==================== 로그 설정 ====================
# RotatingFileHandler로 로그 파일 크기 제한 (500KB, 백업 2개)
log = logging.getLogger(__name__)
log.setLevel(logging.INFO)
_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, maxBytes=512000, backupCount=2, encoding="utf-8"
)
_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
log.addHandler(_handler)

last_mtime = 0
_is_uploading = False  # 동시 실행 방지 락


def run_no_window(cmd, **kwargs):
    """콘솔 창 없이 subprocess 실행 (Windows 전용)"""
    return subprocess.run(
        cmd,
        creationflags=CREATE_NO_WINDOW,
        capture_output=True,
        text=True,
        encoding="utf-8",
        **kwargs
    )


def run_git_upload():
    """JSON 변환 -> 모바일 파일 복사 -> GitHub push"""
    global _is_uploading
    if _is_uploading:
        log.info("이미 업로드 진행 중 — 건너뜀")
        return False

    lock_file = os.path.join(PROJECT_DIR, ".git_sync.lock")
    if os.path.exists(lock_file):
        log.info("로컬 서버가 현재 모바일 동기화를 진행 중입니다. 자동 업로드를 잠시 지연합니다.")
        return False

    _is_uploading = True
    
    try:
        with open(lock_file, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
    except Exception as e:
        log.error(f"락 파일 생성 실패: {e}")

    log.info("=== GitHub 자동 업로드 시작 ===")

    try:
        # 1단계: JSON 내보내기
        log.info("1. JSON 내보내기 중...")
        try:
            result = run_no_window(
                [PYTHON_EXE, EXPORT_SCRIPT],
                cwd=PROJECT_DIR,
                timeout=180,
            )
            if result.returncode != 0:
                log.error(f"   JSON 내보내기 실패: {result.stderr[:300]}")
                return False
            log.info("   JSON 내보내기 완료")
        except subprocess.TimeoutExpired:
            log.error("   JSON 내보내기 시간 초과 오류 (180초)")
            return False

        # 1-5단계: 신호 데이터 내보내기
        log.info("1-5. 신호 데이터(이평선/RSI) 내보내기 중...")
        try:
            result_sig = run_no_window(
                [PYTHON_EXE, os.path.join(PROJECT_DIR, "export_signals.py")],
                cwd=PROJECT_DIR,
                timeout=300,
            )
            if result_sig.returncode != 0:
                log.error(f"   신호 데이터 내보내기 실패: {result_sig.stderr[:300]}")
            else:
                log.info("   신호 데이터 내보내기 완료")
        except subprocess.TimeoutExpired:
            log.error("   신호 데이터 내보내기 시간 초과 오류 (300초), 하지만 업로드는 계속 진행합니다.")

        # 2단계: 모바일 데이터 복사
        log.info("2. 모바일 데이터 복사 중...")
        src = os.path.join(PROJECT_DIR, "StockPortfolioApp", "public", "data")
        dst = os.path.join(PROJECT_DIR, "mobile", "data")
        if os.path.exists(src):
            copy_result = subprocess.run(
                f'xcopy "{src}" "{dst}" /E /I /Y',
                shell=True,
                creationflags=CREATE_NO_WINDOW,
                capture_output=True,
            )
            if copy_result.returncode != 0:
                log.error(f"   모바일 데이터 복사 실패 (exit={copy_result.returncode})")
            else:
                log.info("   모바일 데이터 복사 완료")
        else:
            log.error(f"   소스 디렉토리 없음: {src}")

        # 3단계: git add
        log.info("3. Git 스테이징 중...")
        run_no_window(["git", "add", "."], cwd=PROJECT_DIR)

        # 4단계: git commit
        log.info("4. Git 커밋 중...")
        commit_msg = f"Auto update data {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        result = run_no_window(
            ["git", "commit", "-m", commit_msg],
            cwd=PROJECT_DIR,
        )
        if result.returncode != 0 and "nothing to commit" in result.stdout:
            log.info("   변경사항 없음, 커밋 건너뜀")
            return True

        # 5단계: git push
        log.info("5. GitHub push 중...")
        env = os.environ.copy()
        env["GCM_INTERACTIVE"] = "never"
        env["GIT_TERMINAL_PROMPT"] = "0"
        
        result = run_no_window(
            ["git", "push", "origin", "main"],
            cwd=PROJECT_DIR,
            timeout=120,
            env=env
        )
        if result.returncode == 0:
            log.info("=== GitHub 업로드 성공! ===")
            log.info("   주소: https://smuth-swing.github.io/stock-portfolio")
            return True
        else:
            log.error(f"   GitHub push 실패: {result.stderr[:300]}")
            return False

    except Exception as e:
        log.error(f"   예외 발생: {e}")
        return False
    finally:
        # 락 해제
        lock_file = os.path.join(PROJECT_DIR, ".git_sync.lock")
        if os.path.exists(lock_file):
            try:
                os.remove(lock_file)
            except:
                pass
        _is_uploading = False


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
            log.info("엑셀 파일 변경 감지! 5초 후 업로드 시작...")
            last_mtime = current_mtime
            time.sleep(5)
            run_git_upload()

    except Exception as e:
        log.error(f"파일 감시 오류: {e}")

last_scheduled_date = None

def check_schedule():
    """오후 9시 이후 스케줄 확인"""
    global last_scheduled_date
    now = datetime.now()
    
    # 20시 50분 이후이고, 오늘 아직 실행 안 했으면 실행
    # (21:10 restart_server.ps1 재시작과 충돌 방지를 위해 20:50에 실행)
    if now.hour >= 20 and (now.hour > 20 or now.minute >= 50):
        today_str = now.strftime('%Y-%m-%d')
        if last_scheduled_date != today_str:
            log.info("⏰ 오후 8시 50분 스케줄 자동 업데이트 시작...")
            last_scheduled_date = today_str
            run_git_upload()


if __name__ == "__main__":
    log.info("=" * 50)
    log.info("auto_github_uploader 시작됨")
    log.info(f"감시 파일: {WATCH_FILE}")
    log.info("=" * 50)

    while True:
        try:
            check_file()
            check_schedule()
        except Exception as e:
            log.error(f"메인 루프 예외 발생: {e}")
        time.sleep(10)
