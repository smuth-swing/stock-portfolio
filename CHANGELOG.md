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

## 2026-08-24 — 엑셀 파일 손상 복구 + 동시 쓰기 손상 방지 (스냅샷 저장 오류)

### Problem / Motivation
계좌 현금 스냅샷 저장 시 "파일 접근이 안됨" 및 이후 모든 read-excel이 `Bad CRC-32 for file '[Content_Types].xml'`로 실패 — 엑셀 파일(xlsx zip)이 실제로 손상됨.

### Root Cause
1. **이중 서버 실행**: Task Scheduler(SYSTEM 권한)로 구동 중인 서버(구 코드)와 새로 띄운 서버가 동시에 0.0.0.0:5000을 LISTEN(SO_REUSEADDR) → 요청이 두 프로세스에 분산
2. 구 서버의 `save_cash_snapshots`가 `wb.save(full_path)`로 **비원자적·비직렬화** 저장 → 동시 요청(자동 스냅샷 + 수동 저장)의 zip 스트림이 뒤섞여 파일 손상

### Changes
- **server.py**: `_excel_write_lock` 추가 — 모든 엑셀 쓰기 엔드포인트(save-journal/update-row/delete-row/sync-receive/ls-import-trades/cash-snapshots/accounts)를 락으로 직렬화
- **server.py**: `save_workbook_safely()` — 임시 파일 저장 후 os.replace(실패 시 r+b 덮어쓰기+fsync) 방식의 안전 저장
- **server.py**: `load_workbook_retry()` — 동시 쓰기 순간의 비-zip 상태 읽기 재시도
- **server.py**: 쓰기 엔드포인트 load_workbook에 `rich_text=True` 일괄 적용 (서식 보존)
- **scratch/repair_excel.py**: 손상 파일 복구 스크립트 — 무손상 시트(1~6) + deflate 복구한 sheet7/8 + 골격 XML 재생성 (styles.xml은 최소 재생성 → 셀 서식은 기본값으로 변경됨)
- 서버 중복 실행 해소: SYSTEM 재시작 태스크(`StockPortfolioRestart`)로 단일 서버로 통일

### Affected Flows
- `POST /api/cash-snapshots`, 계좌/매매일지 저장 → Excel '현금비중'/'_계좌정보' 시트
- `GET /api/read-excel` 전체

### Verification
- 스냅샷 저장 1회: success, zip 무결성 유지
- 동시 저장 8회 스트레스: 전부 200 OK, zip 무결성 유지
- 복구 후 read-excel: 매매일지 1450행/포트폴리오 맵/현금비중 정상
- 손상 파일은 `backup\주식 체크 리스트_corrupt_*.xlsx`에 백업됨

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
