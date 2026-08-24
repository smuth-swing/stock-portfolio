# Changelog

All notable changes to this project will be documented in this file.

Format: `## YYYY-MM-DD — Summary`

---

## 2026-08-24 — 포트폴리오 맵 컬럼 매핑 수정 (엑셀 헤더 변경 대응)

### Problem / Motivation
엑셀 '포트폴리오 맵' 시트의 헤더가 기존 `Unnamed: N` 형식에서 실제 이름(전략/분류/종목) + 숫자 금액 헤더(100, 200, ...) 형식으로 변경되면서, 포트폴리오 탭에서 엑셀 데이터를 읽지 못하는 문제 발생. (매매일지 탭은 정상)

### Changes
- **app.js**: `getPortfolioMapColumns()` 헬퍼 추가 — 명명 컬럼과 구 Unnamed 포맷을 모두 자동 해석
- **app.js**: `updateChart()` 포트폴리오 맵 분기 — 하드코딩된 `Unnamed: 3/1/2/4` 대신 동적 컬럼 사용, 데이터 첫 행 헤더 포함 여부도 자동 판별
- **app.js**: `updatePortfolioMapCache()` — 같은 헬퍼를 사용해 종목/금액 컬럼 해석

### Affected Flows
- `GET /api/read-excel?sheet=포트폴리오 맵` 응답 → 차트/요약 스탯/포트폴리오 맵 캐시 렌더링

### Verification
- API 호출 확인: 38행, 컬럼 `Unnamed: 0|전략|분류|종목|100.0|...|4400.0|Unnamed: 46..49`
- 포트폴리오 탭에서 차트/투자 요약이 표시되는지 확인 필요

---

## 2026-08-24 — 모바일 앱 매매일지/포트폴리오 데이터 미표시 수정 (웹 빌드 재배포)

### Problem / Motivation
엑셀 헤더 변경(Unnamed → 명명 컬럼) 이후 모바일 앱(Expo 웹 번들)에서도 매매일지/포트폴리오 탭이 하드코딩된 `Unnamed: N` 컬럼을 참조해 데이터가 빈 화면으로 표시됨.

### Changes
- **StockPortfolioApp/src/utils/excelFields.ts**: 신규 파일 — `getField`(명명 컬럼 우선 + Unnamed 폴백), `getJournalDataRows`, `getPortfolioMapInfo` 헬퍼
- **StockPortfolioApp/src/screens/PortfolioScreen.tsx**: 포트폴리오 맵 파싱을 헬퍼 기반 동적 해석으로 교체
- **StockPortfolioApp/src/screens/TradeScreen.tsx**: 매매일지(date/stock/qty/price/type/amount) 및 누적 투자금 계산을 헬퍼 기반으로 교체
- **StockPortfolioApp/src/screens/SignalScreen.tsx**: 포트폴리오 종목 추출을 헬퍼 기반으로 교체
- **StockPortfolioApp/src/services/dataService.ts**: localhost API URL 파생 시 origin 사용 (경로 접두사 /stock-portfolio 오류 수정)
- **StockPortfolioApp/public/sw.js**: SW 캐시 버전 v20→v21 (기존 클라이언트 강제 갱신)
- **app.js**: 포트폴리오 맵 금액 컬럼에 `Unnamed: 4+` 포함 (46~49열 마크 누락 수정, 총 투자 220→225백만)
- 웹 재빌드(`npx expo export -p web`) → `copy_dist_to_mobile.py`로 `mobile/` 반영

### Affected Flows
- `StockPortfolioApp/public/data/*.json` → GitHub Pages → 모바일 PWA 렌더링
- 로컬 환경에서는 `/api/read-excel` 직접 호출

### Verification
- 모바일 매매일지: 주간 추이 차트/종목 목록 표시 확인
- 모바일 포트폴리오: 섹터 비중(전닉주 40% 등), 15종목, 총 225M 표시 확인
- 데스크톱 포트폴리오: 총 투자 225백만으로 모바일과 일치 확인

---

## 2026-08-07 — Git Credential Fix (Background Push)

### Problem
Mobile data sync showed "GitHub Pages 반영 대기 중" indefinitely. Commits accumulated locally but never reached GitHub Pages.

### Root Cause
Background Python processes (Task Scheduler) cannot access Windows Credential Manager (`wincredman`). Git push failed with:
```
fatal: Unable to persist credentials with the 'wincredman' credential store.
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

### Fix
1. Set local `credential.helper=store` (overrides system `manager`)
2. Created `%USERPROFILE%\.git-credentials` with GitHub PAT
3. Added `.git_sync.lock` to `.gitignore`
4. Manually pushed 5 accumulated commits

### Affected Files
- `auto_github_uploader.py` — No code changes (uses inherited git config)
- `server.py` — No code changes (uses inherited git config)
- `.gitignore` — Added `.git_sync.lock`
- `.git-credentials` — Created at `%USERPROFILE%`
- `ARCHITECTURE.md` — Created
- `.instructions.md` — Created
- `CHANGELOG.md` — Created

### Verification
- ✅ `auto_github_uploader.py` successfully pushed after fix
- ✅ `git push origin main` works from terminal
- ✅ `.git_sync.lock` properly cleaned up

---

## Template for Future Changes

```markdown
## YYYY-MM-DD — Brief Summary

### Problem / Motivation
What issue was addressed or what feature was added.

### Changes
- **File A**: What changed and why
- **File B**: What changed and why

### Affected Flows
- Which data flows / endpoints are affected

### Verification
- How to verify the change works
```
