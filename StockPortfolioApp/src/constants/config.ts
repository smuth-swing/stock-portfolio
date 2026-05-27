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
  BASE_URL = window.location.origin + '/mobile';
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
  meta:          BASE_URL ? `${BASE_URL}/data/meta.json`           : '',
};

// ─────────────────────────────────────────────
// 직접 다운로드 링크 변환 유틸리티 (로컬 서버 방식이므로 변환 없이 그대로)
// ─────────────────────────────────────────────
export const getDirectDownloadUrl = (sharedUrl: string) => sharedUrl;
