# 📈 주식 포트폴리오 관리 시스템

> Stock Portfolio Management — Excel-based, Flask-powered, GitHub Pages-deployed

## 빠른 시작

```powershell
# 서버 실행
python server.py
# → http://localhost:5000

# 자동 업로더 실행 (엑셀 변경 감지 → GitHub 자동 반영)
pythonw auto_github_uploader.py
```

## 작동 방식

```
OneDrive 엑셀 ←→ Flask 서버(:5000) ←→ 웹/모바일
                    ↓
              GitHub Pages (자동 배포)
```

1. **서버** (`server.py`): OneDrive 엑셀 파일을 읽어 JSON API 제공
2. **웹 프론트엔드** (`app.js`): 브라우저에서 엑셀 데이터 조회/편집
3. **자동 업로더** (`auto_github_uploader.py`): 엑셀 변경 감지 → JSON 변환 → GitHub Pages 배포
4. **모바일 PWA** (`mobile/`): GitHub Pages에서 JSON 받아 모바일에서 조회/편집

## 주요 파일

| 파일 | 설명 |
|------|------|
| `server.py` | Flask API 서버 (메인 백엔드) |
| `auto_github_uploader.py` | 엑셀 변경 감지 → 자동 Git push |
| `export_to_json.py` | 엑셀 → JSON 변환기 |
| `export_signals.py` | LS증권 API → 이평선/RSI 데이터 수집 |
| `ls_api.py` | LS증권 API 클라이언트 |
| `app.js` | 웹 프론트엔드 |
| `ARCHITECTURE.md` | ⭐ 상세 아키텍처 문서 |
| `.instructions.md` | ⭐ AI 코딩 도구용 프로젝트 가이드 |
| `CHANGELOG.md` | 변경 이력 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/read-excel?file=...&sheet=...` | 엑셀 데이터 조회 |
| POST | `/api/update-row` | 행 수정 |
| POST | `/api/save-journal` | 매매일지 저장 |
| POST | `/api/sync-receive` | 모바일 동기화 수신 |
| GET | `/api/ping` | 헬스 체크 |
| GET | `/api/ls/moving-averages` | 이평선 데이터 |

## 환경 설정

- **OS**: Windows 11
- **Python**: 3.12 (`C:\Users\zerod\AppData\Local\Programs\Python\Python312\`)
- **OneDrive**: `C:\Users\zerod\OneDrive`
- **엑셀 파일**: `주식 체크 리스트_20220328.xlsx` (OneDrive 내)
- **작업 디렉토리**: `c:\Users\zerod\.antigravity\주식 포트폴리오 관리`

## Git 설정

- **원격**: `https://github.com/smuth-swing/stock-portfolio.git`
- **GitHub Pages**: `https://smuth-swing.github.io/stock-portfolio`
- **인증**: `credential.helper=store` + `%USERPROFILE%\.git-credentials`
- ⚠️ `credential.helper=manager`(시스템) 대신 `store`(로컬) 사용 — 백그라운드 작업 스케줄러에서 wincredman 접근 불가 이슈

## 윈도우 백그라운드 작업

작업 스케줄러에 등록된 작업들:
- **Stock Server**: 로그인 시 Flask 서버 자동 시작
- **Auto Uploader**: 10분마다 엑셀 변경 감지 후 GitHub 업로드
- **Health Check**: 5분마다 서버 상태 확인

## 더 알아보기

- 📐 [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 아키텍처 상세
- 🤖 [.instructions.md](./.instructions.md) — AI 도구용 프로젝트 가이드
- 📝 [CHANGELOG.md](./CHANGELOG.md) — 변경 이력
