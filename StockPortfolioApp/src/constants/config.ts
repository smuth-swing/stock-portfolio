import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────
// 서버 베이스 URL 구성
// ─────────────────────────────────────────────
// Expo Dev Server의 hostUri를 기반으로 데이터 URL을 생성합니다.
// (앱이 공유하는 Wi-Fi 망에서 PC가 expo start를 실행 중일 때만 동기화 가능)
let hostUri =
  Constants.expoConfig?.hostUri ||
  (Constants.manifest as any)?.hostUri ||
  null;

// 웹(PWA) 환경인 경우, 현재 브라우저의 origin을 사용합니다 (ngrok 등)
let BASE_URL = hostUri ? `http://${hostUri}` : '';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // 현재 경로가 /mobile 이나 /mobile/ 로 끝나는지 확인하여 BASE_URL 설정
  let pathname = window.location.pathname;
  // trailing slash 제거 (일관성)
  if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  // index.html 같은 파일명이 있다면 제거 (보통 PWA에서는 없음)
  pathname = pathname.replace(/\/[^/]+\.[^/]+$/, '');
  
  // 모바일 웹앱 경로 보장 (만약 잘못 파싱된 경우 강제로 맞춤)
  if (!pathname.endsWith('/mobile')) {
    pathname = '/stock-portfolio/mobile';
  }
  
  // 로컬 개발 서버(8082 등)로 구동 중인 경우 API 및 리소스 타겟을 5000포트 백엔드로 지정
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (window.location.port === '8082' || window.location.port === '19006') {
      BASE_URL = 'http://localhost:5000/mobile';
    } else {
      BASE_URL = window.location.origin + pathname;
    }
  } else {
    BASE_URL = window.location.origin + pathname;
  }
}

// 개발 중 서버 URL 확인용 로그
if (__DEV__) {
  if (BASE_URL) {
    console.log(`[config] 🔗 서버 URL: ${BASE_URL}`);
  } else {
    console.log('[config] 📵 서버 URL 없음 - 오프라인 모드로 시작');
  }
}

// ─────────────────────────────────────────────
// 데이터 엔드포인트 URL 맵
// ─────────────────────────────────────────────
// BASE_URL이 비어 있으면 빈 문자열 → dataService에서 null 처리
export const DATA_URLS = {
  tradeJournal:  BASE_URL ? `${BASE_URL}/data/trade_journal.json`  : '',
  portfolioMap:  BASE_URL ? `${BASE_URL}/data/portfolio_map.json`  : '',
  investigation: BASE_URL ? `${BASE_URL}/data/investigation.json`  : '',
  performance:   BASE_URL ? `${BASE_URL}/data/performance.json`    : '',
  cashSnapshots: BASE_URL ? `${BASE_URL}/data/cash_snapshots.json` : '',
  cashAccounts:  BASE_URL ? `${BASE_URL}/data/cash_accounts.json`  : '',
  meta:          BASE_URL ? `${BASE_URL}/data/meta.json`           : '',
  targetPrices:  BASE_URL ? `${BASE_URL}/data/target_prices.json`  : '',
  targetDates:   BASE_URL ? `${BASE_URL}/data/target_dates.json`   : '',
};

// ─────────────────────────────────────────────
// 직접 다운로드 링크 변환 유틸리티 (로컬 서버 방식이므로 변환 없이 그대로)
// ─────────────────────────────────────────────
export const getDirectDownloadUrl = (sharedUrl: string) => sharedUrl;
