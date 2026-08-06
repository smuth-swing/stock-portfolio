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
import shutil
import glob
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

# Expo 웹 빌드 관련 경로
APP_DIR = os.path.join(PROJECT_DIR, "StockPortfolioApp")
SRC_DIR = os.path.join(APP_DIR, "src")
MOBILE_DIR = os.path.join(PROJECT_DIR, "mobile")
MOBILE_JS_DIR = os.path.join(MOBILE_DIR, "_expo", "static", "js", "web")
DIST_DIR = os.path.join(APP_DIR, "dist")

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
last_src_mtime = 0  # 소스 코드 최종 변경 시각 추적
_is_uploading = False  # 동시 실행 방지 락


def get_latest_src_mtime():
    """StockPortfolioApp/src/ 내 모든 소스 파일의 최신 수정 시각 반환"""
    latest = 0
    if not os.path.exists(SRC_DIR):
        return 0
    for root, dirs, files in os.walk(SRC_DIR):
        for f in files:
            if f.endswith(('.tsx', '.ts', '.js', '.jsx', '.css')):
                try:
                    mtime = os.path.getmtime(os.path.join(root, f))
                    if mtime > latest:
                        latest = mtime
                except Exception:
                    pass
    return latest


def get_latest_build_mtime():
    """mobile/_expo/static/js/web/ 내 빌드된 JS 파일의 최신 수정 시각 반환"""
    latest = 0
    if not os.path.exists(MOBILE_JS_DIR):
        return 0
    for f in os.listdir(MOBILE_JS_DIR):
        if f.startswith('index-') and f.endswith('.js'):
            try:
                mtime = os.path.getmtime(os.path.join(MOBILE_JS_DIR, f))
                if mtime > latest:
                    latest = mtime
            except Exception:
                pass
    return latest


def needs_mobile_rebuild():
    """소스 파일이 빌드 결과보다 최신이면 재빌드 필요"""
    src_mtime = get_latest_src_mtime()
    build_mtime = get_latest_build_mtime()
    if src_mtime == 0:
        return False
    if build_mtime == 0:
        return True
    return src_mtime > build_mtime


def build_expo_web():
    """Expo 웹 export 실행 후 결과를 mobile/ 디렉터리로 복사"""
    log.info("   📦 Expo 웹 빌드(npx expo export --platform web) 시작...")
    try:
        result = subprocess.run(
            ['npx', 'expo', 'export', '--platform', 'web'],
            cwd=APP_DIR,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=300,
            creationflags=CREATE_NO_WINDOW,
        )
        if result.returncode != 0:
            log.error(f"   Expo 웹 빌드 실패 (exit={result.returncode}): {result.stderr[:500]}")
            return False
    except subprocess.TimeoutExpired:
        log.error("   Expo 웹 빌드 시간 초과 (300초)")
        return False
    except Exception as e:
        log.error(f"   Expo 웹 빌드 예외: {e}")
        return False

    log.info("   ✅ Expo 웹 빌드 완료")

    # dist/ → mobile/ 복사
    if not os.path.exists(DIST_DIR):
        log.error(f"   dist 디렉터리 없음: {DIST_DIR}")
        return False

    try:
        # 1) 기존 _expo 디렉터리 삭제 후 새로 복사
        mobile_expo = os.path.join(MOBILE_DIR, '_expo')
        if os.path.exists(mobile_expo):
            shutil.rmtree(mobile_expo)
            log.info("   기존 mobile/_expo 삭제 완료")

        dist_expo = os.path.join(DIST_DIR, '_expo')
        if os.path.exists(dist_expo):
            shutil.copytree(dist_expo, mobile_expo)
            log.info("   dist/_expo → mobile/_expo 복사 완료")
        else:
            log.warning("   dist/_expo 없음 — 빌드 결과 확인 필요")

        # 2) index.html 복사
        dist_index = os.path.join(DIST_DIR, 'index.html')
        if os.path.exists(dist_index):
            shutil.copy2(dist_index, os.path.join(MOBILE_DIR, 'index.html'))
            log.info("   dist/index.html → mobile/index.html 복사 완료")

        # 3) public/assets → mobile/assets (있다면)
        public_dir = os.path.join(APP_DIR, 'public')
        for fname in ['manifest.json', 'sw.js', 'favicon.ico']:
            src_file = os.path.join(public_dir, fname)
            dst_file = os.path.join(MOBILE_DIR, fname)
            if os.path.exists(src_file):
                shutil.copy2(src_file, dst_file)

        log.info("   ✅ Expo 웹 빌드 결과 → mobile/ 복사 완료")
        return True
    except Exception as e:
        log.error(f"   dist → mobile 복사 중 예외: {e}")
        return False


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
        try:
            mtime = os.path.getmtime(lock_file)
            if time.time() - mtime > 300:  # 5분 초과
                log.warning("오래된 락 파일(.git_sync.lock) 감지 (5분 초과). 강제 삭제 후 진행합니다.")
                os.remove(lock_file)
            else:
                log.info("로컬 서버가 현재 모바일 동기화를 진행 중입니다. 자동 업로드를 잠시 지연합니다.")
                return False
        except Exception as e:
            log.error(f"락 파일 시간 확인 및 삭제 중 오류 발생: {e}")
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

        # 1.8단계: 모바일 앱 Expo 웹 빌드 (소스 코드 변경 시 자동 재빌드)
        if needs_mobile_rebuild():
            log.info("1.8. 모바일 앱 소스 변경 감지 → Expo 웹 빌드 실행")
            build_expo_web()
        else:
            log.info("1.8. 모바일 앱 빌드 최신 상태 (건너뜀)")

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

        # 5단계: git push (main)
        log.info("5. GitHub push (main) 중...")
        env = os.environ.copy()
        env["GCM_INTERACTIVE"] = "never"
        env["GIT_TERMINAL_PROMPT"] = "0"
        
        result = run_no_window(
            ["git", "push", "origin", "main"],
            cwd=PROJECT_DIR,
            timeout=120,
            env=env
        )
        if result.returncode != 0:
            log.error(f"   GitHub push (main) 실패: {result.stderr[:300]}")
            return False

        # 6단계: gh-pages 브랜치 업데이트 (Pages 배포용)
        log.info("6. gh-pages 브랜치 업데이트 중...")
        try:
            # gh-pages 브랜치로 전환
            checkout_result = run_no_window(
                ["git", "checkout", "gh-pages"],
                cwd=PROJECT_DIR,
                timeout=30,
                env=env
            )
            if checkout_result.returncode != 0:
                # gh-pages 브랜치가 없으면 생성
                log.info("   gh-pages 브랜치 생성 중...")
                run_no_window(
                    ["git", "checkout", "-b", "gh-pages"],
                    cwd=PROJECT_DIR,
                    timeout=30,
                    env=env
                )
            
            # main 브랜치 병합
            merge_result = run_no_window(
                ["git", "merge", "main", "--no-edit"],
                cwd=PROJECT_DIR,
                timeout=30,
                env=env
            )
            
            # gh-pages 푸시
            push_result = run_no_window(
                ["git", "push", "origin", "gh-pages"],
                cwd=PROJECT_DIR,
                timeout=120,
                env=env
            )
            if push_result.returncode == 0:
                log.info("   gh-pages 브랜치 업데이트 완료")
            else:
                log.warning(f"   gh-pages push 실패 (무시): {push_result.stderr[:200]}")
            
            # main 브랜치로 복귀
            run_no_window(
                ["git", "checkout", "main"],
                cwd=PROJECT_DIR,
                timeout=30,
                env=env
            )
        except Exception as e:
            log.warning(f"   gh-pages 업데이트 중 예외 (무시): {e}")
            # main으로 복귀 시도
            try:
                run_no_window(["git", "checkout", "main"], cwd=PROJECT_DIR, timeout=30)
            except:
                pass

        log.info("=== GitHub 업로드 성공! ===")
        log.info("   주소: https://smuth-swing.github.io/stock-portfolio")
        return True

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

def check_source_changes():
    """StockPortfolioApp/src/ 소스 코드 변경 감지 → 자동 빌드 + 배포"""
    global last_src_mtime
    try:
        current_mtime = get_latest_src_mtime()
        if current_mtime == 0:
            return

        if last_src_mtime == 0:
            last_src_mtime = current_mtime
        elif current_mtime > last_src_mtime:
            log.info("📝 소스 코드 변경 감지! 5초 후 Expo 빌드 + GitHub 배포 시작...")
            last_src_mtime = current_mtime
            time.sleep(5)  # 파일 저장 완료 대기
            run_git_upload()
    except Exception as e:
        log.error(f"소스 코드 감시 오류: {e}")


if __name__ == "__main__":
    log.info("=" * 50)
    log.info("auto_github_uploader 시작됨")
    log.info(f"감시 파일: {WATCH_FILE}")
    log.info(f"소스 감시: {SRC_DIR}")
    log.info("=" * 50)

    while True:
        try:
            check_file()
            check_source_changes()
            check_schedule()
        except Exception as e:
            log.error(f"메인 루프 예외 발생: {e}")
        time.sleep(10)
