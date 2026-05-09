"""
작업 스케줄러에 주식 포트폴리오 서버를 등록하는 스크립트
Python의 subprocess로 schtasks를 직접 호출하여 한글 경로 문제 우회
"""
import subprocess
import sys
import os
import time

TASK_NAME = "StockPortfolioServer"
PYTHON_EXE = r"C:\Users\zerod\AppData\Local\Programs\Python\Python312\python.exe"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_PY = os.path.join(PROJECT_DIR, "server.py")
STARTUP_DIR = os.path.join(os.environ.get("APPDATA", ""), 
                            r"Microsoft\Windows\Start Menu\Programs\Startup")
STARTUP_LNK = os.path.join(STARTUP_DIR, "StockPortfolioServer.lnk")

print("=" * 55)
print("  주식 포트폴리오 서버 - 자동 시작 등록")
print("=" * 55)
print(f"  Python  : {PYTHON_EXE}")
print(f"  서버    : {SERVER_PY}")
print(f"  프로젝트: {PROJECT_DIR}")
print()

# 파일 존재 확인
if not os.path.isfile(PYTHON_EXE):
    print(f"[오류] Python을 찾을 수 없음: {PYTHON_EXE}")
    sys.exit(1)

if not os.path.isfile(SERVER_PY):
    print(f"[오류] server.py를 찾을 수 없음: {SERVER_PY}")
    sys.exit(1)

# 기존 스타트업 단축키 삭제
if os.path.isfile(STARTUP_LNK):
    try:
        os.remove(STARTUP_LNK)
        print("[OK] 기존 스타트업 단축키 삭제 완료")
    except Exception as e:
        print(f"[경고] 단축키 삭제 실패: {e}")

# 기존 작업 삭제
result = subprocess.run(
    ["schtasks", "/delete", "/tn", TASK_NAME, "/f"],
    capture_output=True, text=True, encoding="cp949"
)
if result.returncode == 0:
    print(f"[OK] 기존 작업 '{TASK_NAME}' 삭제 완료")

# 작업 등록 XML 방식 (가장 안정적인 방법)
username = os.environ.get('USERNAME', os.environ.get('COMPUTERNAME', 'User'))
xml_content = f"""<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Stock Portfolio Flask Server Port 5000</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
    <StartWhenAvailable>true</StartWhenAvailable>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{PYTHON_EXE}</Command>
      <Arguments>"{SERVER_PY}"</Arguments>
      <WorkingDirectory>{PROJECT_DIR}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

# XML 파일로 저장 (UTF-16 LE BOM 포함 - Windows 작업 스케줄러 요구 형식)
xml_path = os.path.join(PROJECT_DIR, "_task_temp.xml")
try:
    with open(xml_path, "wb") as f:
        # UTF-16 LE BOM (FF FE) 추가
        f.write(b"\xff\xfe")
        f.write(xml_content.encode("utf-16-le"))
    print("[OK] 작업 스케줄러 XML 생성 완료")
except Exception as e:
    print(f"[오류] XML 생성 실패: {e}")
    sys.exit(1)

# schtasks /create /xml 방식으로 등록
result = subprocess.run(
    ["schtasks", "/create", "/tn", TASK_NAME, "/xml", xml_path, "/f"],
    capture_output=True, text=True, encoding="cp949"
)

# 임시 XML 삭제
try:
    os.remove(xml_path)
except:
    pass

if result.returncode == 0:
    print(f"[성공] 작업 스케줄러 등록 완료!")
    print()
    
    # 즉시 서버 시작
    print("[시작] 서버를 지금 바로 실행합니다...")
    subprocess.run(["schtasks", "/run", "/tn", TASK_NAME], 
                   capture_output=True, encoding="cp949")
    
    print("[대기] 서버 시작 중... (5초)")
    time.sleep(5)
    
    # 포트 확인
    port_check = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True, text=True, encoding="cp949"
    )
    if ":5000" in port_check.stdout and "LISTENING" in port_check.stdout:
        print("[성공] 서버가 포트 5000에서 실행 중입니다!")
        print("  브라우저에서 http://localhost:5000 으로 접속하세요.")
    else:
        print("[확인] 서버가 시작 중일 수 있습니다.")
        print("  잠시 후 http://localhost:5000 으로 접속해보세요.")
        print(f"  로그 파일: {os.path.join(PROJECT_DIR, 'server_log.txt')}")
else:
    print(f"[오류] 등록 실패: {result.stderr or result.stdout}")
    sys.exit(1)

print()
print("=" * 55)
print("  다음 로그인부터 서버가 자동으로 실행됩니다.")
print("=" * 55)
input("\n엔터 키를 누르면 종료합니다...")
