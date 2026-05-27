"""
build_and_serve_pwa.py — PWA 빌드 후 ngrok으로 외부 접속 URL 생성
============================================================
사용법:
  python build_and_serve_pwa.py          # 빌드 + 서버 + ngrok 한번에 실행
  python build_and_serve_pwa.py --skip-build  # 빌드 생략, 서버+ngrok만
  python build_and_serve_pwa.py --ngrok-only  # ngrok URL만 출력 (서버 이미 실행 중일 때)

아이폰 설치 방법:
  1. 이 스크립트 실행 후 출력되는 HTTPS ngrok URL을 메모
  2. 아이폰 Safari에서 해당 URL 열기
  3. 하단 [공유] 버튼 → [홈 화면에 추가] 클릭
  4. 완료! 이후 앱처럼 전체 화면으로 실행됩니다
"""

import os
import sys
import time
import signal
import subprocess
import argparse
import ctypes
import datetime
from pathlib import Path
from threading import Thread

# ── 절전 모드 방지 함수 (Windows 전용) ─────────────────
def sleep_manager():
    """10:00 ~ 17:00 사이에만 절전 모드를 차단하고 나머지 시간엔 허용하는 백그라운드 스레드"""
    if os.name != 'nt':
        return
        
    is_sleep_prevented = False
    
    while True:
        try:
            current_hour = datetime.datetime.now().hour
            # 10시부터 17시(오후 5시) 전까지 절전 모드 차단 (10:00 ~ 16:59)
            should_prevent = (10 <= current_hour < 17)
            
            if should_prevent and not is_sleep_prevented:
                # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
                print(f"[시스템] 현재 시간({current_hour}시) - 절전 모드 진입을 차단합니다.")
                is_sleep_prevented = True
            elif not should_prevent and is_sleep_prevented:
                # ES_CONTINUOUS (기본 상태 복귀)
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
                print(f"[시스템] 현재 시간({current_hour}시) - 일과 종료로 절전 모드를 다시 허용합니다.")
                is_sleep_prevented = False
        except Exception as e:
            pass
            
        time.sleep(60) # 1분마다 시간 확인

def start_sleep_manager():
    if os.name == 'nt':
        t = Thread(target=sleep_manager, daemon=True)
        t.start()

def allow_sleep():
    """서버 종료 시 절전 모드 진입을 다시 허용합니다."""
    if os.name == 'nt':
        try:
            # ES_CONTINUOUS
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
        except Exception:
            pass

# Windows 터미널 UTF-8 출력 설정
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# ── 경로 설정 ──────────────────────────────────────────
BASE_DIR = Path(__file__).parent
APP_DIR = BASE_DIR / 'StockPortfolioApp'
DIST_DIR = APP_DIR / 'dist'
FLASK_PORT = 5000

# ── ngrok 토큰 (선택) ───────────────────────────────────
# https://dashboard.ngrok.com/get-started/your-authtoken 에서 무료 토큰 발급
# 아래 문자열을 본인 토큰으로 교체하거나 환경변수 NGROK_TOKEN으로 설정
NGROK_TOKEN = os.getenv('NGROK_TOKEN', '3ECl5uc4IEFgbWHCOuk49VAyz3r_62aFpmWjuVrFmszwpiJYV')


def build_web():
    """Expo 웹 빌드 실행"""
    print("=" * 60)
    print("  📦 Expo 웹 빌드 시작...")
    print("=" * 60)

    result = subprocess.run(
        ['npx', 'expo', 'export', '--platform', 'web'],
        cwd=str(APP_DIR),
        shell=True,
    )

    if result.returncode != 0:
        print("[오류] Expo 웹 빌드 실패!")
        print("  → StockPortfolioApp 폴더에서 직접 실행해보세요:")
        print("     npx expo export --platform web")
        return False

    print(f"[OK] 빌드 완료 → {DIST_DIR}")
    return True


def copy_data_json():
    """public/data/*.json 을 dist/data 에 복사 (서비스 워커용)"""
    src_data = APP_DIR / 'public' / 'data'
    dst_data = DIST_DIR / 'data'
    dst_data.mkdir(parents=True, exist_ok=True)

    import shutil
    copied = 0
    if src_data.exists():
        for f in src_data.glob('*.json'):
            shutil.copy2(f, dst_data / f.name)
            copied += 1
    if copied > 0:
        print(f"[OK] JSON 데이터 {copied}개 파일을 dist/data 에 복사 완료")
    else:
        print("[경고] public/data 에 JSON 파일이 없습니다. export_to_json.py를 먼저 실행하세요.")


def copy_pwa_assets():
    """manifest.json, sw.js 를 dist 루트에 복사"""
    import shutil
    public_dir = APP_DIR / 'public'
    for fname in ['manifest.json', 'sw.js']:
        src = public_dir / fname
        if src.exists():
            shutil.copy2(src, DIST_DIR / fname)
            print(f"[OK] {fname} → dist/ 복사 완료")


def start_flask_server():
    """Flask 서버를 별도 프로세스로 시작"""
    print("\n[서버 시작] server.py 실행 중...")
    proc = subprocess.Popen(
        ['python', 'server.py'],
        cwd=str(BASE_DIR),
        shell=True,
    )
    time.sleep(2)  # 서버 기동 대기
    return proc


def start_ngrok():
    """pyngrok으로 Flask 서버를 외부에 노출"""
    try:
        from pyngrok import ngrok, conf

        # 토큰이 있으면 설정
        if NGROK_TOKEN:
            ngrok.set_auth_token(NGROK_TOKEN)

        print("\n[ngrok] 터널 생성 중...")
        tunnel = ngrok.connect(FLASK_PORT, "http")
        public_url = tunnel.public_url

        # http → https 강제 변환 (Safari PWA는 https 필수)
        if public_url.startswith('http://'):
            public_url = public_url.replace('http://', 'https://', 1)

        return public_url, tunnel
    except ImportError:
        print("[오류] pyngrok 미설치. 실행: pip install pyngrok")
        return None, None
    except Exception as e:
        print(f"[오류] ngrok 실행 실패: {e}")
        return None, None


def print_guide(url):
    """아이폰 설치 가이드 출력"""
    mobile_url = f"{url}/mobile/"
    print("\n")
    print("=" * 60)
    print("  🎉 PWA 앱 준비 완료!")
    print("=" * 60)
    print(f"\n  📱 아이폰에서 열 주소:")
    print(f"\n     {mobile_url}\n", flush=True)
    print("─" * 60)
    print("  홈 화면에 추가하는 방법 (1회만 하면 됩니다):")
    print()
    print("  1️⃣  아이폰 Safari 앱을 엽니다")
    print(f"  2️⃣  위 주소를 주소창에 입력하고 접속합니다")
    print("  3️⃣  화면 하단 가운데 [공유 □↑] 버튼을 탭합니다")
    print("  4️⃣  스크롤해서 [홈 화면에 추가] 를 탭합니다")
    print("  5️⃣  [추가] 버튼을 탭합니다")
    print()
    print("  ✅ 이제 바탕화면 아이콘으로 전체화면 앱 실행 가능!")
    print()
    print("  ⚠️  주의: PC가 켜져 있고 이 스크립트가 실행 중이어야")
    print("     최신 데이터 동기화가 됩니다.")
    print("     (한번 열고 나면 오프라인에서도 저장된 데이터 조회 가능)")
    print("─" * 60)
    print("  종료하려면 Ctrl+C 를 누르세요", flush=True)
    print("=" * 60, flush=True)


def main():
    parser = argparse.ArgumentParser(description="PWA Build & Serve with ngrok")
    parser.add_argument('--skip-build', action='store_true', help="Skip Expo web build")
    parser.add_argument('--ngrok-only', action='store_true', help="Start ngrok only (assumes server is running)")
    parser.add_argument('--skip-server', action='store_true', help="Skip Flask server start (e.g. run by task scheduler)")
    args = parser.parse_args()

    flask_proc = None
    
    # 서버 구동 시 시간에 따른 절전 모드 방지 관리 시작
    start_sleep_manager()

    try:
        # 1. 웹 빌드
        if not args.skip_build and not args.ngrok_only:
            if not build_web():
                sys.exit(1)

        # 2. dist 파일 정리 (데이터 JSON, SW, 매니페스트 복사)
        if not args.ngrok_only and DIST_DIR.exists():
            copy_data_json()
            copy_pwa_assets()

        # 3. Flask 서버 시작 (--skip-server 또는 --ngrok-only 시 생략)
        if not args.ngrok_only and not args.skip_server:
            flask_proc = start_flask_server()
        elif args.skip_server:
            print("\n[서버] 기존 실행 중인 서버 사용 (스케줄러 관리)")

        # 4. ngrok 터널 생성
        url, tunnel = start_ngrok()

        if url:
            print_guide(url)
        else:
            print(f"\n[안내] ngrok 없이 로컬 주소로만 접근 가능합니다:")
            print(f"  → http://localhost:{FLASK_PORT}/mobile/")
            print("  (같은 Wi-Fi 내에서만 접속 가능)")

        # 5. 무한 대기 (Ctrl+C 종료)
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n[종료] 서버를 종료합니다...")
    finally:
        if flask_proc:
            flask_proc.terminate()
        try:
            from pyngrok import ngrok
            ngrok.kill()
        except Exception:
            pass
        
        # 서버 종료 시 절전 모드 허용 복구
        allow_sleep()
        print("[완료] 모든 프로세스 종료됨")


if __name__ == '__main__':
    main()
