import { DATA_URLS } from '../constants/config';

// 표준 fetch()를 사용한 데이터 로드 (expo-file-system 의존성 제거)
export const fetchJSON = async (key: keyof typeof DATA_URLS) => {
  const url = DATA_URLS[key];

  if (!url) {
    console.warn(`[dataService] URL이 없습니다: ${key}`);
    return null;
  }

  try {
    console.log(`[dataService] 불러오는 중: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[dataService] HTTP 오류 ${response.status}: ${url}`);
      return null;
    }

    const data = await response.json();
    console.log(`[dataService] ✅ 성공: ${key} (${data?.row_count ?? '?'}행)`);
    return data;
  } catch (err) {
    console.error(`[dataService] ❌ 실패 (${key}):`, err);
    return null;
  }
};
