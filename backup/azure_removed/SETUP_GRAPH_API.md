# 📊 Stock Portfolio Analysis Server - Microsoft Graph API 버전

## 🎯 개요

이 버전은 **Microsoft Graph API**를 사용하여 OneDrive 클라우드의 엑셀 파일에 **직접 접근**합니다.
- ✅ 로컬 동기화 지연 문제 완전 해결
- ✅ 클라우드에 직접 저장 (실시간 동기화)
- ✅ 보안: OAuth 2.0 인증
- ✅ 안정성: 자동 토큰 갱신

---

## 🚀 시작하기

### 1️⃣ 파일 준비

```bash
# Graph API 버전 서버 설치 의존성
pip install -r requirements_graph.txt

# .env 파일 생성 (.env.example 참고)
copy .env.example .env
```

### 2️⃣ Azure 애플리케이션 등록

**Azure Portal에서 다음 단계를 따르세요:**

#### A. 애플리케이션 등록

**📍 단계 1: Azure Portal 접속**
1. [https://portal.azure.com](https://portal.azure.com)을 브라우저에서 엽니다
2. Microsoft 계정(또는 회사 계정)으로 로그인
3. 로그인 후 Azure 대시보드 화면이 표시됩니다

**📍 단계 2: Azure Active Directory 찾기**

**⚠️ 중요:** 어떤 계정을 사용 중인지 확인하세요!

우측 상단 프로필 확인:
```
개인 계정:   👤 이름 (outlook.com / hotmail.com)
회사 계정:   🏢 회사명 / 이름 (company.onmicrosoft.com)
```

**개인 계정의 경우:**
- 계속 진행하면 됨 (아래 단계 따르기)

**회사 계정의 경우:**
- 회사 IT 관리자에게 문의 필요
- 또는 개인 계정으로 새 Azure 구독 생성 (옵션 1 참고)
- 오류 "테넌트 'Microsoft Services'에 없어..." 발생하면 → **[문제 해결](#-오류-선택한-사용자-계정이-테넌트-microsoft-services에-없어) 참고**

1. 좌측 메뉴에서 `☰` (메뉴 아이콘) 클릭 (보이지 않으면 좌측 사이드바 참고)
2. `모든 서비스` 검색 또는 좌측 메뉴 스크롤
3. **"Azure Active Directory"** 찾아서 클릭
   - 또는 검색창에 "Azure Active Directory" 입력 후 클릭
   - 또는 상단 검색창에 "aad" 입력하면 빠름

**📍 단계 3: 앱 등록 메뉴 진입**
1. Azure Active Directory 페이지 진입
2. 좌측 메뉴에서 **`앱 등록`** 찾아서 클릭
   ```
   ├─ 개요
   ├─ 빠른 시작
   ├─ 앱 등록 ← 클릭
   ├─ 엔터프라이즈 애플리케이션
   └─ ...
   ```

**📍 단계 4: 새 등록 버튼 클릭**
1. 앱 등록 페이지가 열립니다
2. 상단에 `+ 새 등록` 버튼 클릭
   - 기존 앱 목록이 표시되면, 우측 상단 `+ 새 등록` 버튼 클릭

**📍 단계 5: 애플리케이션 등록 양식 작성**

**이름 입력:**
- 입력 필드: `이름`
- 입력값: `Stock Portfolio Manager` 
- (원하는 이름으로 변경 가능, 예: `MyStockApp`, `포트폴리오`)

**지원되는 계정 유형 선택:**
- 옵션 찾기: "이 애플리케이션을 누가 사용할 수 있나요?"
- 선택: **`개인 Microsoft 계정 또는 모든 조직 디렉토리의 계정`** 선택
  ```
  ○ 이 조직 디렉토리의 계정만
  ● 개인 Microsoft 계정 또는 모든 조직 디렉토리의 계정 ← 선택
  ○ 개인 Microsoft 계정만
  ```

**리디렉트 URI 설정 (중요!):**
1. "리디렉트 URI (선택 사항)" 섹션 찾기
2. 드롭다운 메뉴: **`Web`** 선택
3. URI 입력 필드에 정확히 입력:
   ```
   http://localhost:5000/auth/callback
   ```
   ⚠️ **반드시 정확히 입력** (띄어쓰기, 대소문자 포함)

**📍 단계 6: 등록 완료**
1. 하단 `등록` 버튼 클릭
2. 잠시 후 새 앱이 생성되고 "개요" 페이지로 이동

**📍 단계 7: 클라이언트 ID 복사 (중요!)**
1. 개요 페이지에서 다음 항목 찾기:
   ```
   애플리케이션 (클라이언트) ID: [12345678-1234-1234-1234-123456789012]
   ```
2. 클라이언트 ID 값 우측의 **복사 아이콘** 클릭 (또는 텍스트 선택 후 Ctrl+C)
3. `.env` 파일의 `CLIENT_ID=` 뒤에 붙여넣기
   ```env
   CLIENT_ID=12345678-1234-1234-1234-123456789012
   ```

#### B. 클라이언트 시크릿 생성 (중요!)

⚠️ **주의:** 시크릿은 한 번만 표시되므로 반드시 복사해서 `.env`에 저장하세요!

**📍 단계 1: 인증서 및 암호 메뉴 진입**
1. 좌측 메뉴에서 **`인증서 및 암호`** 클릭
   ```
   ├─ 개요
   ├─ 빠른 시작
   ├─ 앱 등록
   ├─ 소유권
   ├─ 인증서 및 암호 ← 클릭
   └─ ...
   ```

**📍 단계 2: 클라이언트 암호 생성**
1. 페이지가 여러 탭으로 나뉨:
   - `인증서` 탭
   - `클라이언트 암호` 탭 ← **이 탭 클릭**

2. "클라이언트 암호" 탭에서:
3. `+ 새 클라이언트 암호` 버튼 클릭

**📍 단계 3: 클라이언트 암호 정보 입력**

**설명 입력:**
- 필드: `설명`
- 입력값: `Local Development` (또는 원하는 설명)

**만료 기간 선택:**
- 필드: `만료`
- 선택: **`권장 (24개월)`** 권장 (또는 `6개월` 선택 가능)

**📍 단계 4: 추가 버튼 클릭**
1. `추가` 버튼 클릭
2. 새로운 암호가 생성되고 표에 추가됨

**📍 단계 5: 시크릿 값 복사 (반드시 지금!)** 

⚠️ **중요:** 이 페이지를 벗어나면 시크릿을 다시 볼 수 없습니다!

1. 새로 생성된 행 찾기:
   ```
   | 설명 | 값 | 만료 날짜 |
   |------|-----|----------|
   | Local Development | ••••••••••••••••••••• | [만료날짜] |
   ```

2. `값` 열의 **우측 복사 아이콘** 클릭 (또는 더블클릭해서 선택 후 Ctrl+C)

3. `.env` 파일의 `CLIENT_SECRET=` 뒤에 즉시 붙여넣기:
   ```env
   CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-~
   ```

**✅ 체크:** 
- [ ] 시크릿 값이 `.env`에 저장됨
- [ ] 절대 공개하지 않기

#### C. API 권한 설정

**📍 단계 1: API 권한 메뉴 진입**
1. 좌측 메뉴에서 **`API 권한`** 클릭
   ```
   ├─ 개요
   ├─ 빠른 시작
   ├─ 앱 등록
   ├─ API 권한 ← 클릭
   ├─ 인증서 및 암호
   └─ ...
   ```

**📍 단계 2: 권한 추가 버튼 클릭**
1. API 권한 페이지에 기존 권한 목록 표시
2. 상단에 `+ 권한 추가` 버튼 클릭

**📍 단계 3: Microsoft Graph 선택**
1. "권한 추가" 패널이 우측에서 열림
2. **API 선택** 섹션:
   ```
   ├─ Microsoft API
   │  ├─ Azure Service Management
   │  ├─ Microsoft Graph ← 클릭
   │  └─ ...
   └─ 내 조직이 사용하는 API
   ```
3. **`Microsoft Graph`** 클릭

**📍 단계 4: 권한 유형 선택**
1. 다음 화면에서 두 가지 옵션 제시:
   ```
   □ 위임된 권한 (사용자 대신 액세스) ← 선택
   □ 애플리케이션 권한 (앱이 직접 액세스)
   ```
2. **`위임된 권한`** 클릭

**📍 단계 5: 필요한 권한 검색 및 선택**

권한 검색 창에 다음을 차례로 검색:

**첫 번째: `Files.ReadWrite` 권한**
1. 검색 상자: "Files.ReadWrite" 입력
2. 결과에서 **`Files.ReadWrite`** 체크박스 ✓
   ```
   □ Files.Read - 사용자 파일 읽기
   ☑ Files.ReadWrite - 사용자 파일 읽기 및 쓰기 ← 선택
   ```

**두 번째: `User.Read` 권한**
1. 검색 상자 지우고: "User.Read" 입력
2. 결과에서 **`User.Read`** 체크박스 ✓
   ```
   ☑ User.Read - 사용자 프로필 읽기 ← 선택
   ```

**세 번째: `offline_access` 권한**
1. 검색 상자 지우고: "offline_access" 입력
2. 결과에서 **`offline_access`** 체크박스 ✓
   ```
   ☑ offline_access - 오프라인 액세스 유지 ← 선택
   ```

**📍 단계 6: 권한 추가 완료**
1. 하단 `권한 추가` 버튼 클릭
2. 권한 목록에 세 가지 추가됨 확인:
   ```
   ✓ Files.ReadWrite (위임됨)
   ✓ User.Read (위임됨)
   ✓ offline_access (위임됨)
   ```

**📍 단계 7: 관리자 동의 부여 (선택사항)**
1. 상단에 노란 경고: "이 애플리케이션에 필요한 권한이..."
2. `<관리자> 에 대한 관리자 동의 부여` 버튼 보임 (필요시 클릭)
3. 조직의 관리자 계정이 필요하면 건너뜀 (일반 사용자는 로그인 시 동의)

#### D. 테넌트 ID 확인 (선택사항 - 개인 계정은 `common` 사용)

**📍 개인 Microsoft 계정 사용자:**
- 테넌트 ID를 따로 입력할 필요 없음
- `.env`에 `TENANT_ID=common` 입력하면 됨

**📍 회사/조직 계정 사용자 (선택사항):**

1. 좌측 메뉴에서 **`개요`** 클릭
   ```
   ├─ 개요 ← 클릭
   ├─ 빠른 시작
   ├─ 앱 등록
   └─ ...
   ```

2. 개요 페이지에서 다음 정보 찾기:
   ```
   애플리케이션 (클라이언트) ID: [12345678-1234-1234-1234-123456789012]
   디렉토리 (테넌트) ID: [abcdef12-3456-7890-abcd-ef1234567890] ← 복사
   ```

3. 우측 복사 아이콘 클릭

4. `.env` 파일에 입력:
   ```env
   TENANT_ID=abcdef12-3456-7890-abcd-ef1234567890
   ```

### 3️⃣ .env 파일 설정

**📍 .env 파일 생성 (이미 생성됨)**
```bash
copy .env.example .env
```

**📍 .env 파일 편집 (메모장 또는 VS Code로 열기)**

프로젝트 폴더의 `.env` 파일을 열어서 다음과 같이 수정:

```.env
# 개인 계정: common 사용
# 회사 계정: Azure Portal의 디렉토리(테넌트) ID 입력
TENANT_ID=common

# Azure Portal - 애플리케이션 (클라이언트) ID 에서 복사
CLIENT_ID=12345678-1234-1234-1234-123456789012

# Azure Portal - 클라이언트 시크릿 값에서 복사 (한 번만 표시!)
CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-~

# 로컬 개발 환경용 (변경 금지)
REDIRECT_URI=http://localhost:5000/auth/callback
```

**✅ 저장 확인:**
- [ ] 세 개의 값이 모두 입력됨 (TENANT_ID, CLIENT_ID, CLIENT_SECRET)
- [ ] REDIRECT_URI는 정확히 `http://localhost:5000/auth/callback`
- [ ] 파일 저장 완료

### 4️⃣ 서버 시작

**📍 터미널/PowerShell 열기**
1. 프로젝트 폴더에서 `Shift + 우클릭`
2. `PowerShell 또는 터미널을 여기서 열기` 클릭
   (또는 VS Code 터미널: Ctrl+`)

**📍 서버 실행**
```bash
python server_graph.py
```

**📍 정상 출력 예시**

첫 번째 실행 (토큰 없음):
```
======================================================================
  Stock Portfolio Analysis Server - Microsoft Graph API Version
======================================================================
❌ 인증이 필요합니다. http://localhost:5000/auth/login으로 이동하세요.
  Server Address: http://localhost:5000
  Auth Login: http://localhost:5000/auth/login
======================================================================
```

두 번째 실행 (토큰 저장됨):
```
======================================================================
  Stock Portfolio Analysis Server - Microsoft Graph API Version
======================================================================
✅ 저장된 토큰 로드됨
  Server Address: http://localhost:5000
  Auth Login: http://localhost:5000/auth/login
======================================================================
```

**✅ 체크:**
- [ ] 에러 메시지 없음
- [ ] 서버가 실행 중 (터미널이 멈춤 상태)
- [ ] `http://localhost:5000` 접속 가능

### 5️⃣ 인증 진행

**📍 단계 1: 로그인 페이지 방문**
1. 브라우저를 열고 다음 주소 입력:
   ```
   http://localhost:5000/auth/login
   ```
2. 자동으로 Microsoft 로그인 페이지로 리디렉트됨

**📍 단계 2: Microsoft 계정 로그인**
1. "이메일, 전화 또는 Skype" 입력란에 Microsoft 계정 입력
   - 예: `user@outlook.com` 또는 회사 이메일
2. `다음` 버튼 클릭

3. 비밀번호 입력
4. `로그인` 버튼 클릭

**📍 단계 3: 권한 승인**

다음과 같은 페이지가 표시:
```
Stock Portfolio Manager에서 다음 권한을 요청합니다:

☑ 파일 읽기 및 쓰기 (Files.ReadWrite)
☑ 프로필 읽기 (User.Read)
☑ 오프라인에서 액세스 유지 (offline_access)

[ 수락 ]  [ 거절 ]
```

`[ 수락 ]` 버튼 클릭

**📍 단계 4: 인증 완료**
1. 자동으로 `http://localhost:5000` 홈페이지로 리디렉트
2. 성공 메시지 표시:
   ```
   ✅ 인증 성공!
   이제 애플리케이션을 사용할 수 있습니다.
   ```

**📍 단계 5: 토큰 저장 확인**
1. 프로젝트 폴더에서 `token.json` 파일 생성 확인
   ```
   프로젝트/
   ├── server_graph.py
   ├── .env
   ├── token.json ← 자동 생성됨
   └── ...
   ```

2. 터미널을 확인하면:
   ```
   토큰 저장됨: token.json
   ```

**✅ 인증 완료!**
- [ ] token.json 파일 생성됨
- [ ] 홈페이지에서 데이터 조회 가능
- [ ] 이제 매매일지 저장 테스트 가능

---

## 📁 파일 구조

```
프로젝트 폴더/
├── server_graph.py           # 🔷 NEW: Graph API 버전 (현재)
├── server.py                 # 로컬 버전 (기존)
├── app.js                    # 프론트엔드
├── requirements_graph.txt    # 🔷 NEW: Graph API 의존성
├── requirements.txt          # 로컬 버전 의존성
├── .env.example             # 🔷 NEW: 설정 템플릿
├── .env                      # 🔷 NEW: 실제 설정 (생성 필요)
├── token.json                # 🔷 NEW: 저장된 인증 토큰 (자동 생성)
└── backup/                   # 백업 폴더
    ├── server_backup.py
    ├── app_backup.js
    └── requirements_backup.txt
```

---

## 🔄 기존 버전으로 롤백

문제가 발생하면 기존 로컬 버전으로 돌아갈 수 있습니다:

```bash
# 기존 버전 사용
python server.py

# 또는 한 단계씩 테스트하려면:
# 1. 기존 app.js 복원
# 2. requirements.txt 의존성 설치
pip install -r requirements.txt
```

---

## 🔧 문제 해결

### ❌ 오류: "선택한 사용자 계정이 테넌트 'Microsoft Services'에 없어..."

**오류 메시지 전체:**
```
선택한 사용자 계정이 테넌트 'Microsoft Services'에 없어 이 테넌트의 
애플리케이션에 액세스할 수 없습니다. 
이 계정은 테넌트의 외부 사용자로 먼저 추가되어야 합니다. 
다른 계정을 사용하세요.
```

**🔴 원인:**
- 개인 Microsoft 계정 (outlook.com, hotmail.com)으로 로그인
- 회사/조직의 Azure 테넌트에 앱을 등록하려고 시도
- 계정과 테넌트가 불일치

**📍 [자세한 해결법 보기](./AZURE_ACCOUNT_TROUBLESHOOTING.md)** ← **여기를 클릭하세요!**

빠른 해결:
- ✅ **추천:** 새 개인 Azure 구독 만들기
  1. [https://azure.microsoft.com/ko-kr/free/](https://azure.microsoft.com/ko-kr/free/) 접속
  2. 개인 Microsoft 계정 (없으면 만들기)
  3. 무료 구독 생성
  4. 새 계정으로 앱 등록 다시 시작

- 또는 회사 IT 관리자에게 추가 요청
- 또는 다른 개인 계정 사용

[상세 3가지 해결법 및 프로세스 보기](./AZURE_ACCOUNT_TROUBLESHOOTING.md)

---

### Q1: "클라이언트 시크릿이 설정되지 않았습니다" 메시지

✅ **해결:**
- `.env` 파일이 프로젝트 루트에 있는지 확인
- TENANT_ID, CLIENT_ID, CLIENT_SECRET 모두 입력되었는지 확인
- 파일 저장 후 서버 재시작

### Q2: "인증 코드를 받지 못했습니다"

✅ **해결:**
- Azure 앱 리디렉트 URI가 `http://localhost:5000/auth/callback`과 정확히 일치하는지 확인
- 포트가 5000인지 확인 (이미 사용 중이면 변경 필요)

### Q3: "파일을 찾을 수 없습니다"

✅ **해결:**
- OneDrive에 `주식 체크 리스트_20220328.xlsx` 파일이 있는지 확인
- 파일 이름이 정확히 일치하는지 확인 (한글 포함)
- Microsoft 계정으로 로그인한 OneDrive 확인

### Q4: 토큰 만료되었음

✅ **해결:**
- `token.json` 파일 삭제
- 서버 재시작 후 `/auth/login`으로 다시 인증
- 토큰은 자동 갱신됨 (만료 5분 전)

---

## 🌐 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|-------|------|
| `/` | GET | 메인 페이지 |
| `/auth/login` | GET | Microsoft 로그인 페이지로 리디렉트 |
| `/auth/callback` | GET | 인증 콜백 (자동) |
| `/api/onedrive-status` | GET | 연결 상태 확인 |
| `/api/read-excel` | GET | 엑셀 파일 읽기 |
| `/api/save-journal` | POST | 매매일지 저장 |

### 요청 예시

**매매일지 저장:**
```javascript
fetch('http://localhost:5000/api/save-journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        file: '주식 체크 리스트_20220328.xlsx',
        sheet: '매매일지',
        row: ['2026-05-01', 'AAPL', 10, 180.5, '매수', 1805]
    })
})
```

---

## 🔐 보안 주의사항

⚠️ **주의사항:**
- `.env` 파일을 버전 관리에 커밋하지 마세요
- 클라이언트 시크릿을 공개하지 마세요
- `token.json`은 민감한 정보를 포함하므로 백업하지 마세요
- 프로덕션 환경에서는 HTTPS 사용 필수

---

## 📝 버전 비교

| 항목 | 로컬 버전 (server.py) | Graph API 버전 (server_graph.py) |
|------|-----|------|
| 저장 위치 | 로컬 OneDrive 폴더 | OneDrive 클라우드 |
| 동기화 | 지연 가능성 | 즉시 |
| 인증 | 로컬 폴더 접근 | OAuth 2.0 |
| 설정 | 간단함 | Azure 등록 필요 |
| 보안 | 낮음 | 높음 |

---

## 📞 도움말

각 파일의 주석 참고:
- `server_graph.py`: API 함수 상세 설명
- `app.js`: 프론트엔드 로직
- `.env.example`: 설정 항목 설명

---

## ✅ 체크리스트

### 시작 전 필수 확인

- [ ] **Microsoft 계정 확인**
  - [ ] 개인 계정: outlook.com 또는 hotmail.com
  - [ ] 또는 회사 계정이 있으면 IT 관리자 승인 필수

- [ ] **의존성 설치**
  - [ ] `pip install -r requirements_graph.txt` 실행 완료

- [ ] **Azure 앱 등록**
  - [ ] [Azure Portal](https://portal.azure.com) 접속 가능
  - [ ] 앱 등록 완료
  - [ ] CLIENT_ID 복사 완료
  - [ ] CLIENT_SECRET 복사 완료 (한 번만 표시)

- [ ] **.env 파일 설정**
  - [ ] `.env` 파일 생성됨
  - [ ] TENANT_ID 입력됨
  - [ ] CLIENT_ID 입력됨
  - [ ] CLIENT_SECRET 입력됨
  - [ ] 파일 저장 완료

- [ ] **OneDrive 확인**
  - [ ] `주식 체크 리스트_20220328.xlsx` 파일 존재
  - [ ] 파일 이름 정확히 일치 (한글 포함)

- [ ] **환경 확인**
  - [ ] Python 3.7+ 설치됨
  - [ ] 포트 5000 사용 가능 (다른 프로그램 미사용)

### 서버 실행 전 최종 확인

- [ ] 터미널에서 `python server_graph.py` 에러 없음
- [ ] 브라우저에서 `http://localhost:5000` 접속 가능
- [ ] `/auth/login` 페이지로 리디렉트됨
- [ ] Microsoft 계정 로그인 페이지 표시됨
미사용 내용임

---

**Happy Trading! 📈**
