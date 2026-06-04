"""Git 기록에서 탐구생활 데이터 변화 추적"""
import subprocess
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

# investigation.json이 변경된 커밋들을 확인
result = subprocess.run(
    ['git', 'log', '--oneline', '--follow', '-p', '--', 'StockPortfolioApp/public/data/investigation.json'],
    capture_output=True, text=True, encoding='utf-8',
    cwd=r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'
)

# 각 커밋별로 investigation.json의 row_count 변화를 추적
commits = [
    'b5be304',  # 06-04 00:19
    '1ac1a44',  # 06-04 00:19
    'dcb2eb8',  # 06-04 00:04
    'c5e0d2e',  # 06-03 16:31
    '9862069',  # 06-03 16:28
    'd1be71a',  # 06-03 15:50
    '41042cc',  # 06-03 15:45
    'd95e3ed',  # 06-03 15:24
    '76e2cb9',  # 06-03 15:02
    '6a1f27a',  # 06-03 14:53
    'a46e20f',  # 06-03 14:20
    '69766bb',  # 06-03 13:54
    '3d6f52e',  # 06-03 08:48
    'dcdff28',  # 06-03 07:48
    '39b62b2',  # 06-02 22:00
    '3fb2e3e',  # 06-02 21:37
    '2d7f91b',  # 06-01
]

print("=== 탐구생활(investigation.json) Git 이력 추적 ===\n")
print(f"{'커밋':10s} | {'행수':>5s} | 내용 샘플")
print("-" * 80)

for commit in commits:
    try:
        r = subprocess.run(
            ['git', 'show', f'{commit}:StockPortfolioApp/public/data/investigation.json'],
            capture_output=True, text=True, encoding='utf-8',
            cwd=r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'
        )
        if r.returncode == 0:
            data = json.loads(r.stdout)
            row_count = data['row_count']
            # 마지막 데이터 행의 내용 일부
            last_row = data['data'][-1] if data['data'] else {}
            cols = data['columns']
            # 첫 번째 유효한 컬럼 값 찾기
            sample = ""
            for col in cols[:3]:
                val = str(last_row.get(col, ''))
                if val:
                    sample += f"{col}={val} "
            
            # 커밋 날짜도 가져오기
            r2 = subprocess.run(
                ['git', 'log', '-1', '--format=%ci', commit],
                capture_output=True, text=True, encoding='utf-8',
                cwd=r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'
            )
            date = r2.stdout.strip()[:16]
            
            print(f"{commit:10s} | {row_count:5d} | {date} | {sample[:50]}")
        else:
            print(f"{commit:10s} | (파일 없음)")
    except Exception as e:
        print(f"{commit:10s} | 오류: {e}")

# 현재 파일도 확인
print("\n--- 현재 파일 ---")
with open(r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리\StockPortfolioApp\public\data\investigation.json', encoding='utf-8') as f:
    current = json.load(f)
print(f"현재 행수: {current['row_count']}")
print(f"현재 컬럼: {current['columns'][:5]}")
