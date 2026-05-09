# 📈 주식 포트폴리오 관리 시스템

## 🎯 프로젝트 상태

### 🟢 완료 (Graph API 버전 추가)
- ✅ Microsoft Graph API 기반 서버 구현
- ✅ 클라우드 직접 접근 아키텍처
- ✅ OAuth 2.0 인증 시스템
- ✅ 매매일지 실시간 저장
- ✅ 자동 토큰 갱신
- ✅ 기존 코드 완전 백업
- ✅ 마이그레이션 가이드 제공

---

## 📂 파일 구조

```
프로젝트 폴더/
│
├── 🟦 신규 파일 (Graph API 버전)
│   ├── server_graph.py              ⭐ 메인 서버 (클라우드 직접 접근)
│   ├── requirements_graph.txt        의존성
│   ├── .env.example                 설정 템플릿
│   ├── SETUP_GRAPH_API.md           설정 가이드 (상세)
│   └── MIGRATION_GUIDE.md           마이그레이션 가이드
│
├── 🟨 기존 파일 (로컬 버전)
│   ├── server.py                    로컬 OneDrive 폴더 사용
│   ├── app.js                       프론트엔드 (공용)
│   ├── index.html                   UI (공용)
│   ├── styles.css                   스타일 (공용)
│   ├── requirements.txt              의존성
│   └── ...
│
├── 📦 백업 폴더
│   ├── backup/
│   │   ├── server_backup.py
│   │   ├── app_backup.js
│   │   └── requirements_backup.txt
│   └── (실패 시 이곳에서 복구 가능)
│
└── 📋 문서
    ├── README.md                    이 파일
    ├── SETUP_GRAPH_API.md          상세 설정 가이드
    └── MIGRATION_GUIDE.md          기존→신규 전환 가이드
```

---

## 🚀 빠른 시작

### 옵션 1️⃣: 로컬 버전 (기존)
```bash
# 즉시 사용 가능
pip install -r requirements.txt
python server.py
# http://localhost:5000 접속
```

### 옵션 2️⃣: Graph API 버전 (권장) ⭐

**1단계: 의존성 설치**
```bash
pip install -r requirements_graph.txt
```

**2단계: Azure 앱 등록 (5분)**
- [Azure Portal](https://portal.azure.com) 방문
- `앱 등록` → 새 등록
- 리디렉트 URI: `http://localhost:5000/auth/callback`
- CLIENT_ID, CLIENT_SECRET 복사

**3단계: .env 설정**
```bash
copy .env.example .env
# .env 파일에 다음 입력:
TENANT_ID=common
CLIENT_ID=<복사한 ID>
CLIENT_SECRET=<복사한 시크릿>
```

**4단계: 서버 시작**
```bash
python server_graph.py

# 첫 실행 시:
# 1. 브라우저에서 http://localhost:5000/auth/login 접속
# 2. Microsoft 로그인
# 3. 권한 승인
# 4. 토큰 자동 저장됨 (token.json)
```

---

## 🔄 버전 비교

| 항목 | 로컬 (server.py) | Graph API (server_graph.py) |
|------|------|------|
| **초기 설정** | ✅ 간단 | ⚙️ Azure 필요 |
| **사용 난이도** | ✅ 쉬움 | ⚙️ 중간 |
| **데이터 저장** | 로컬 폴더 동기화 | 클라우드 직접 |
| **동기화 속도** | ⚠️ 지연 가능 | ✅ 즉시 |
| **안정성** | ⚠️ 파일 접근 문제 | ✅ 높음 |
| **보안** | ⚠️ 로컬 접근 | ✅ OAuth 2.0 |
| **네트워크 의존성** | 선택사항 | 필수 |
| **다중 계정 지원** | ✅ | ✅ 향후 계획 |

---

## 🎯 선택 기준

### 로컬 버전 추천 👇
- OneDrive 폴더가 완벽히 동기화되는 환경
- 인터넷 연결 불안정
- 빠른 프로토타이핑 필요
- Azure 계정 없음

### Graph API 버전 추천 👇 (⭐ 기본값)
- 안정적인 클라우드 동기화 필요
- **매매일지 데이터 손실 방지**
- 여러 디바이스에서 접근
- 보안 강화 필요
- 프로덕션 환경

---

## 🔒 보안

### 토큰 관리
- 토큰은 `token.json`에 자동 저장
- 만료 5분 전 자동 갱신
- 공개 리포지토리에 커밋 금지

### 환경 변수
- `.env` 파일 절대 공개 금지
- `.env`를 `.gitignore`에 추가

### 권장 사항
```bash
# .gitignore 추가
echo .env >> .gitignore
echo token.json >> .gitignore
```

---

## 🔧 문제 해결

### 문제 1: Graph API 버전에서 "파일을 찾을 수 없습니다"
```
해결: OneDrive에 파일이 있는지 확인하고,
    파일명이 정확히 일치하는지 확인 (한글 포함)
```

### 문제 2: "인증 필요" 메시지
```
해결: http://localhost:5000/auth/login 방문
    Microsoft 계정으로 로그인 후 권한 승인
```

### 문제 3: 토큰 오류
```
해결: token.json 삭제 후 재인증
    rm token.json
    python server_graph.py
```

### 빠른 롤백
```bash
# 문제 발생 시 로컬 버전으로 즉시 전환
python server.py
```

자세한 내용은 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) 참고

---

## 📊 기능

### 읽기 기능 (공용)
- ✅ 엑셀 시트 다중 지원
- ✅ 실시간 차트 시각화
- ✅ 포트폴리오 분석
- ✅ 데이터 검색/필터링

### 쓰기 기능 (저장)
- ✅ 매매일지 기록
- ✅ 자동 가격 계산
- ✅ 매매 색상 구분 (매수/매도)
- ✅ 클라우드 동기화

---

## 📋 체크리스트

### Graph API 전환 준비
- [ ] 현재 데이터 백업 확인
- [ ] `backup/` 폴더의 기존 파일 확인
- [ ] OneDrive 파일 접근 가능 확인

### Graph API 설정
- [ ] Azure Portal에서 앱 등록 완료
- [ ] CLIENT_ID, CLIENT_SECRET 복사 완료
- [ ] `.env` 파일 설정 완료
- [ ] 의존성 설치 완료 (`pip install -r requirements_graph.txt`)

### 테스트
- [ ] 서버 시작 (`python server_graph.py`)
- [ ] 인증 완료 (`/auth/login`)
- [ ] 파일 읽기 확인
- [ ] 매매일지 저장 테스트
- [ ] OneDrive에 저장 확인

---

## 📚 문서

| 문서 | 용도 |
|------|------|
| `README.md` | 📍 현재 위치 - 프로젝트 개요 |
| `SETUP_GRAPH_API.md` | 📍 상세 설정 가이드 (초보자) |
| `MIGRATION_GUIDE.md` | 📍 로컬→Graph API 전환 (중급자) |
| `server_graph.py` | 📍 코드 주석 참고 |

---

## 🎓 학습 자료

### Microsoft Graph API
- [공식 문서](https://docs.microsoft.com/en-us/graph/overview)
- [OAuth 2.0 인증](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [파일 API](https://docs.microsoft.com/en-us/graph/api/resources/driveitem)

### Flask
- [공식 문서](https://flask.palletsprojects.com/)
- [REST API 패턴](https://flask-restful.readthedocs.io/)

### 엑셀 처리
- [openpyxl](https://openpyxl.readthedocs.io/)
- [pandas](https://pandas.pydata.org/docs/)

---

## 💡 팁 & 트릭

### 1. 여러 파일 처리 (향후 계획)
```javascript
// UI에서 다른 파일 선택 가능하도록 확장
const file = prompt('파일명 입력:', '주식 체크 리스트_20220328.xlsx');
```

### 2. 데이터 자동 백업
```bash
# 정기적으로 token.json 제외하고 백업
7z a backup_$(date +%Y%m%d).7z -x!.env -x!token.json
```

### 3. 개발 환경 분리
```bash
# 로컬 테스트: server.py
# 프로덕션: server_graph.py
```

---

## 🤝 지원

### 버전 지원
- 📍 **로컬 버전 (server.py)**: 보관용 (완전 호환)
- 📍 **Graph API 버전 (server_graph.py)**: ⭐ 권장 (적극 지원)

### 버그 리포트
문제 발생 시 다음 정보 제공:
1. 사용 중인 버전 (로컬/Graph API)
2. 에러 메시지 전체
3. 단계별 재현 방법

---

## 🎉 마이그레이션 완료!

Graph API 버전으로 전환하면:
- ✅ 동기화 문제 완전 해결
- ✅ 매매일지 안정성 증대
- ✅ 클라우드 실시간 반영
- ✅ 보안 강화

---

## 📞 다음 단계

1. **즉시**: [SETUP_GRAPH_API.md](./SETUP_GRAPH_API.md) 읽기
2. **5분**: Azure 앱 등록 완료
3. **10분**: `.env` 파일 설정
4. **15분**: `python server_graph.py` 실행
5. **20분**: `/auth/login` 인증 완료

**예상 소요 시간: 약 20분 ⏱️**

---

**Happy Trading! 🚀📈**

최종 수정: 2026년 5월 1일
