"""오늘 커밋에서 탐구생활 데이터 변화 상세 추적 - 최근 데이터와 6/3~6/4 변화에 집중"""
import subprocess
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CWD = r'c:\Users\zerod\.antigravity\주식 포트폴리오 관리'

# 6/3~6/4 커밋들에서 탐구생활 행수 변화 추적
commits_info = [
    ('249a03f', '06-04 20:22 (현재)'),
    ('b5be304', '06-04 00:19'),
    ('dcb2eb8', '06-04 00:04'),
    ('c5e0d2e', '06-03 16:31'),
    ('d1be71a', '06-03 15:50'),
    ('76e2cb9', '06-03 15:02'),
    ('a46e20f', '06-03 14:20'),
    ('69766bb', '06-03 13:54'),
    ('3d6f52e', '06-03 08:48'),
    ('dcdff28', '06-03 07:48'),
    ('39b62b2', '06-02 22:00'),
    ('3fb2e3e', '06-02 21:37'),
    ('634b6cf', '06-02 21:28'),
    ('2d7f91b', '06-01 23:07'),
]

print("=== 탐구생활 데이터 변화 상세 추적 ===\n")
prev_names = None
for commit, desc in commits_info:
    try:
        r = subprocess.run(
            ['git', 'show', f'{commit}:StockPortfolioApp/public/data/investigation.json'],
            capture_output=True, text=True, encoding='utf-8', cwd=CWD
        )
        if r.returncode != 0:
            print(f"{desc:25s} | 파일 없음")
            continue
            
        data = json.loads(r.stdout)
        row_count = data['row_count']
        cols = data['columns']
        
        # 종목명 추출
        names = []
        for row in data['data']:
            name = row.get('종목명', '') or row.get(cols[1] if len(cols) > 1 else '', '')
            if name and name.strip():
                names.append(name.strip())
        
        change = ""
        if prev_names is not None:
            added = set(names) - set(prev_names)
            removed = set(prev_names) - set(names)
            if added:
                change += f" +[{', '.join(added)}]"
            if removed:
                change += f" -[{', '.join(removed)}]"
        
        print(f"{desc:25s} | {row_count:3d}행 | 종목{len(names)}개{change}")
        prev_names = names
    except Exception as e:
        print(f"{desc:25s} | 오류: {e}")

# 핸드폰에서 수정했다면 OneDrive 버전 기록에서 복구 가능한지 확인
print("\n" + "=" * 60)
print("  복구 방법 안내")
print("=" * 60)
print("""
1. OneDrive 웹 (onedrive.live.com) 에서 파일 우클릭 → '버전 기록' 확인
2. 핸드폰에서 수정한 시점의 버전을 복원 가능
3. Git에서도 과거 버전 복원 가능 (git checkout <commit> -- <file>)
""")
