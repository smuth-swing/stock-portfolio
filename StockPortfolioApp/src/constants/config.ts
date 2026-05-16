import Constants from 'expo-constants';

// Expo 개발 서버의 호스트 주소(IP:Port)를 동적으로 가져옵니다.
// 이렇게 하면 PC 방화벽 문제 없이 Expo 서버 자체 통신망을 통해 데이터를 가져올 수 있습니다.
const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
const BASE_URL = hostUri ? `http://${hostUri}` : 'http://localhost:8081';

export const DATA_URLS = {
  tradeJournal: `${BASE_URL}/data/trade_journal.json`,
  portfolioMap: `${BASE_URL}/data/portfolio_map.json`,
  investigation: `${BASE_URL}/data/investigation.json`,
  performance: `${BASE_URL}/data/performance.json`,
  meta: `${BASE_URL}/data/meta.json`,
};

// 직접 다운로드 링크 변환 유틸리티
export const getDirectDownloadUrl = (sharedUrl: string) => {
  return sharedUrl; // 로컬 서버(Expo)이므로 변환 없이 그대로 사용
};
