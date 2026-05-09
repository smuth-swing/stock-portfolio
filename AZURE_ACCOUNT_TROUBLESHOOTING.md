# 🔧 Azure 계정 문제 해결 가이드

## 자주 발생하는 오류와 해결법

### ❌ 오류 1: "테넌트 'Microsoft Services'에 없어..."

**전체 오류 메시지:**
```
선택한 사용자 계정이 테넌트 'Microsoft Services'에 없어 
이 테넌트의 애플리케이션에 액세스할 수 없습니다.
이 계정은 테넌트의 외부 사용자로 먼저 추가되어야 합니다.
다른 계정을 사용하세요.
```

**🔴 언제 발생?**
- 개인 Microsoft 계정 (outlook.com, hotmail.com)으로 로그인
- 회사/조직의 Azure 테넌트에 애플리케이션을 등록하려고 시도
- 계정이 테넌트에 등록되지 않음

**💡 원인 이해:**
```
Azure 테넌트 = 조직 계정 관리 시스템

예시:
✅ 개인 계정 + 개인 Azure 구독 = 성공
❌ 개인 계정 + 회사 Azure 테넌트 = 오류
✅ 회사 계정 + 회사 Azure 테넌트 = 성공
```

---

## ✅ 해결 방법 (3가지)

### 방법 1️⃣: 새로운 개인 Azure 구독 만들기 (권장) ⭐

**장점:**
- 가장 간단함
- 즉시 해결 가능
- 요금 없음 (무료 크레딧 $200)

**단계:**

**1단계: Azure 로그아웃**
```
현재 상태: Azure Portal에 회사 계정 또는 다른 계정으로 로그인되어 있음

작업:
1. Azure Portal 우측 상단 프로필 아이콘 클릭
2. "로그아웃" 클릭
3. 모든 브라우저 탭 닫기
```

**2단계: 새 개인 구독 생성**
```
1. https://azure.microsoft.com/ko-kr/free/ 접속
2. "무료 계정 시작" 버튼 클릭
3. 개인 Microsoft 계정 로그인 또는 생성
   - 없으면: outlook.com 또는 hotmail.com 새로 만들기
4. 기본 정보 입력
5. 신용카드 정보 입력 (요금 청구 안 됨, 검증용)
6. 구독 생성 완료
```

**3단계: 새 계정으로 Azure 접속**
```
1. https://portal.azure.com 접속
2. 새로 만든 개인 계정으로 로그인
3. 확인: 우측 상단에 개인 계정명 표시
```

**4단계: 앱 등록 다시 시작**
```
이제 SETUP_GRAPH_API.md의 "2️⃣ Azure 애플리케이션 등록" 부터 시작
```

**⏱️ 소요 시간:** 약 10-15분

---

### 방법 2️⃣: 회사 계정으로 진행

**요구사항:**
- 회사 Azure 관리자 계정
- 또는 IT 팀의 승인

**단계:**

**1단계: 회사 IT 팀에 요청**
```
요청 내용:
"Graph API를 사용하는 로컬 애플리케이션을 개발하려고 합니다.
개인 계정을 외부 사용자로 추가해주거나,
앱 개발 권한을 주실 수 있을까요?"

필요 정보:
- 개인 계정 이메일 (outlook.com, hotmail.com)
- 애플리케이션 이름: "Stock Portfolio Manager"
- 필요 권한: Files.ReadWrite, User.Read
```

**2단계: 관리자가 추가 후**
```
1. Azure Portal 접속
2. 앱 등록 진행
3. 리디렉트 URI: http://localhost:5000/auth/callback
```

**3단계: 로컬에서 인증**
```
나중에 서버 실행 후 /auth/login 접속 시:
- 회사 계정 (같은 이메일)으로 로그인
- 권한 승인
```

**⏱️ 소요 시간:** 관리자 대기 시간 포함 (1-2일)

---

### 방법 3️⃣: 다른 개인 계정 사용

**단계:**

**1단계: 새 Outlook 계정 생성**
```
1. https://outlook.com 접속
2. "계정 만들기" 클릭
3. 새 이메일 주소 만들기
   예: your-name@outlook.com
4. 비밀번호 설정
5. 계정 생성 완료
```

**2단계: 새 계정으로 Azure 접속**
```
1. 현재 계정 로그아웃 (방법1 참고)
2. https://portal.azure.com 접속
3. 새로 만든 계정으로 로그인
```

**3단계: 앱 등록**
```
SETUP_GRAPH_API.md의 "2️⃣ Azure 애플리케이션 등록" 진행
```

**⏱️ 소요 시간:** 약 5분

---

## 🎯 추천 선택

| 상황 | 권장 방법 | 이유 |
|------|---------|------|
| 개인 프로젝트 | 1️⃣ 방법 1 | 가장 빠르고 간단 |
| 회사 프로젝트 | 2️⃣ 방법 2 | 정식 계정 관리 |
| 빠른 테스트 필요 | 3️⃣ 방법 3 | 즉시 가능 |

---

## 🔍 현재 계정 확인하기

**Azure Portal에서 계정 확인:**
1. https://portal.azure.com 접속
2. 우측 상단 프로필 아이콘 클릭
3. 계정 정보 확인:

```
개인 계정 (올바른 것):
┌─────────────────────────────┐
│ 👤 John Doe                 │
│    john@outlook.com         │
│                             │
│ 📊 구독: MyPersonalSub      │
└─────────────────────────────┘

회사 계정 (문제 가능):
┌─────────────────────────────┐
│ 🏢 ABC Company              │
│    john@company.com         │
│                             │
│ 📊 구독: CompanySubName     │
└─────────────────────────────┘
```

---

## 💾 계정별 .env 설정

### 개인 계정 (권장)

```.env
TENANT_ID=common
CLIENT_ID=<개인 계정으로 등록한 앱의 ID>
CLIENT_SECRET=<개인 계정 앱의 시크릿>
REDIRECT_URI=http://localhost:5000/auth/callback
```

### 회사 계정 (선택사항)

```.env
TENANT_ID=<회사의 테넌트 ID>
CLIENT_ID=<회사 계정으로 등록한 앱의 ID>
CLIENT_SECRET=<회사 계정 앱의 시크릿>
REDIRECT_URI=http://localhost:5000/auth/callback
```

회사 테넌트 ID 찾기:
```
Azure Portal → Azure Active Directory → 개요 → 디렉토리 (테넌트) ID
```

---

## ❌ 실패 사례

### 케이스 1: outlook.com 계정으로 회사 테넌트 앱 등록 시도

```
❌ 오류: "테넌트 'Microsoft Services'에 없어..."

원인:
- outlook.com 계정 = 개인 계정
- Microsoft Services 테넌트 = 회사 테넌트
- 계정이 테넌트에 등록되지 않음

해결: 방법 1 또는 방법 2 사용
```

### 케이스 2: 개인 계정으로 앱 등록 후 회사 계정으로 로그인

```
❌ 오류: "리소스에 액세스할 수 없습니다"

원인:
- 앱을 개인 테넌트에 등록
- 하지만 회사 계정으로 로그인 시도
- 다른 테넌트의 사용자로 인식

해결: 
1. 로그인 시 등록한 계정과 같은 계정 사용
2. 또는 회사 계정으로 다시 앱 등록
```

---

## ✅ 올바른 프로세스

```
1단계: 계정 선택
   ↓
   개인? → 새 Azure 구독 생성 (방법 1)
   회사? → IT 관리자 승인 (방법 2)
   ↓

2단계: 같은 계정으로 Azure 로그인
   ↓
   개인 계정 로그인 또는 회사 계정 로그인
   ↓

3단계: 앱 등록 (SETUP_GRAPH_API.md 참고)
   ↓
   CLIENT_ID, CLIENT_SECRET 복사
   ↓

4단계: .env 파일 설정
   ↓
   같은 계정의 자격증명 입력
   ↓

5단계: 서버 실행 및 인증
   ↓
   python server_graph.py 실행
   http://localhost:5000/auth/login 방문
   같은 계정으로 로그인
   ✅ 성공!
```

---

## 🆘 여전히 문제가 있다면?

### 체크리스트

- [ ] 계정의 유형 확인 (개인/회사)
- [ ] Azure Portal에서 현재 로그인된 계정 확인
- [ ] .env 파일의 TENANT_ID 확인
- [ ] CLIENT_ID, CLIENT_SECRET이 현재 계정으로 등록한 앱의 값인지 확인
- [ ] 서버 실행 시 로그인하는 계정이 앱을 등록한 계정과 동일한지 확인

### 고급 디버깅

**token.json 파일 확인:**
```bash
# 프로젝트 폴더에서 token.json 파일 확인
# 포함된 계정 정보가 정확한지 확인

# 문제 시 토큰 삭제 후 재인증
rm token.json
python server_graph.py
# http://localhost:5000/auth/login 방문
```

---

**다시 처음부터:** [SETUP_GRAPH_API.md](SETUP_GRAPH_API.md) 참고

**궁금점이 있다면** 이 문서의 해당 섹션을 다시 읽어주세요! 🚀
