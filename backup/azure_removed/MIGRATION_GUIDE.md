# 📋 마이그레이션 가이드: 로컬 → Graph API

## 🔄 버전 선택 가이드

### 로컬 버전 (server.py)
```bash
python server.py
```
- ✅ 설정 간단함
- ✅ 즉시 사용 가능
- ❌ 동기화 지연 가능
- ❌ 파일 접근 권한 필요

### Graph API 버전 (server_graph.py) ⭐ **권장**
```bash
python server_graph.py
```
- ✅ 즉시 클라우드 동기화
- ✅ OAuth 2.0 보안
- ✅ 안정성 높음
- ❌ Azure 등록 필요
- ❌ 초기 설정 시간 소요

---

## 🚀 Graph API 버전 빠른 시작

### 1. 의존성 설치
```bash
pip install -r requirements_graph.txt
```

### 2. Azure 설정 (5분)
1. [Azure Portal](https://portal.azure.com) 방문
2. `Azure Active Directory` → `앱 등록` → `새 등록`
3. **이름**: Stock Portfolio Manager
4. **계정 유형**: 개인 Microsoft 계정 또는 모든 조직
5. **리디렉트 URI (Web)**: `http://localhost:5000/auth/callback`
6. 등록 → 클라이언트 ID 복사

### 3. 시크릿 생성
1. `인증서 및 암호` → `새 클라이언트 암호`
2. **설명**: Local Dev
3. **시크릿 값** 복사

### 4. API 권한 설정
1. `API 권한` → `권한 추가`
2. **Microsoft Graph** 선택
3. **위임된 권한** 체크:
   - `Files.ReadWrite`
   - `User.Read`
   - `offline_access`

### 5. .env 설정
```bash
copy .env.example .env
# .env 파일 편집
TENANT_ID=common
CLIENT_ID=<복사한 ID>
CLIENT_SECRET=<복사한 시크릿>
```

### 6. 서버 시작
```bash
python server_graph.py

# 첫 실행 시:
# http://localhost:5000/auth/login 방문
# Microsoft 로그인 → 권한 승인
# 자동 토큰 저장 (token.json)
```

---

## 🔧 문제 해결

### 🔴 "파일을 찾을 수 없습니다"

**원인**: OneDrive에 엑셀 파일이 없거나 이름이 다름

**해결**:
1. OneDrive에서 파일 확인: `주식 체크 리스트_20220328.xlsx`
2. 파일 이름 정확히 일치 (한글 포함)
3. `server_graph.py` 49번 줄 변경:
   ```python
   EXCEL_FILE_PATH = '실제 파일명.xlsx'
   ```

### 🔴 "인증 필요"

**원인**: 토큰이 저장되지 않음

**해결**:
1. `http://localhost:5000/auth/login` 방문
2. Microsoft 계정으로 로그인
3. 권한 요청 수락
4. `token.json` 파일 생성 확인

### 🔴 "토큰 갱신 실패"

**원인**: CLIENT_SECRET 만료 또는 오류

**해결**:
1. Azure Portal에서 새 시크릿 생성
2. `.env` 파일 업데이트
3. `token.json` 삭제
4. 서버 재시작

---

## 📊 기능 비교 상세

| 기능 | 로컬 | Graph API |
|------|------|-----------|
| **파일 읽기** | ✅ | ✅ |
| **파일 쓰기** | ✅ (지연) | ✅ (즉시) |
| **매매일지 저장** | ✅ (불안정) | ✅ (안정) |
| **시트 탭 변경** | ✅ | ✅ |
| **차트 시각화** | ✅ | ✅ |
| **포트폴리오 계산** | ✅ | ✅ |
| **다중 파일 지원** | 제한 | ✅ 향후 지원 |

---

## 🎯 권장 사용 방법

### 개발/테스트: 로컬 버전
- 빠른 테스트 필요
- Azure 설정 없이 진행

### 실무 운영: Graph API 버전 ⭐
- 안정적인 클라우드 동기화
- 데이터 손실 방지
- 보안 강화

---

## 🔄 버전 전환

### 로컬 → Graph API
```bash
# 1. 새 의존성 설치
pip install -r requirements_graph.txt

# 2. .env 파일 설정
copy .env.example .env
# ... Azure 정보 입력 ...

# 3. Graph API 서버 실행
python server_graph.py
```

### Graph API → 로컬 (롤백)
```bash
# 1. 기존 의존성만 사용
pip install -r requirements.txt

# 2. 로컬 서버 실행
python server.py
```

---

## 📁 파일 관리

### 백업 유지
```
backup/
├── server_backup.py           # 원본 로컬 버전
├── app_backup.js              # 원본 프론트엔드
└── requirements_backup.txt    # 원본 의존성
```

### 새 버전 추가
```
프로젝트/
├── server.py (로컬)
├── server_graph.py (Graph API) ← NEW
├── app.js (공용)
├── requirements.txt (로컬)
├── requirements_graph.txt (Graph API) ← NEW
├── .env.example ← NEW
└── SETUP_GRAPH_API.md ← NEW
```

---

## ✅ 체크리스트

### Graph API 전환 전
- [ ] 현재 데이터 백업 완료
- [ ] `backup/` 폴더에 기존 파일 있음
- [ ] OneDrive 파일 동기화 완료

### Graph API 전환 시
- [ ] Azure Portal에서 앱 등록 완료
- [ ] CLIENT_ID, CLIENT_SECRET 복사 완료
- [ ] `.env` 파일 설정 완료
- [ ] `pip install -r requirements_graph.txt` 실행
- [ ] `/auth/login`에서 인증 완료

### Graph API 안정화 후
- [ ] 로컬 버전 보관 (백업용)
- [ ] 정기적인 데이터 확인
- [ ] 토큰 자동 갱신 작동 확인

---

## 🆘 긴급 상황

### 시스템 복구 (5분 이내)
```bash
# 1. 현재 버전 중단 (Ctrl+C)
# 2. 로컬 버전 실행
python server.py
# 3. 브라우저 캐시 삭제
```

### 데이터 무결성 확인
```bash
# token.json 삭제 후 재인증
del token.json
# 또는
rm token.json

# 서버 재시작
python server_graph.py
```

---

**🎉 마이그레이션 완료 후엔 더이상 동기화 문제가 없을 것입니다!**

추가 질문: SETUP_GRAPH_API.md 파일 참고
