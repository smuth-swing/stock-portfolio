import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DATA_URLS } from '../constants/config';

// 캐시 키 접두사 - AsyncStorage 충돌 방지
const CACHE_PREFIX = 'stock_portfolio_cache_';
const META_KEY = 'stock_portfolio_last_sync';

// 서버 요청 타임아웃 (ms)
const FETCH_TIMEOUT_MS = 6000;

// ─────────────────────────────────────────────
// 1. 로컬 캐시 읽기 (AsyncStorage - 빠르고 안정적)
// ─────────────────────────────────────────────
export const getCachedData = async (key: keyof typeof DATA_URLS) => {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log(`[dataService] 💾 캐시 로드 성공: ${key}`);
      return parsed;
    }
  } catch (e) {
    console.warn(`[dataService] 캐시 읽기 실패 (${key}):`, e);
  }
  return null;
};

// ─────────────────────────────────────────────
// 2. 마지막 동기화 시간 읽기
// ─────────────────────────────────────────────
export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(META_KEY);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// 3. 서버에서 데이터 가져와 캐시 갱신
// ─────────────────────────────────────────────
export const fetchJSON = async (key: keyof typeof DATA_URLS) => {
  let url = DATA_URLS[key];
  // BASE_URL이 없거나 빈 문자열이면 서버 없이 실행 중 → 즉시 null
  if (!url) {
    console.log(`[dataService] 📵 서버 URL 없음 - 오프라인 모드 (${key})`);
    return null;
  }

  // 만약 BASE_URL이 로컬 API 서버(localhost:5000)를 가리키고 있다면
  // 정적 JSON 파일 대신 백엔드의 실시간 /api/read-excel API를 호출하여 CORS 문제 완벽 회피
  if (url.includes('localhost:5000') || url.includes('127.0.0.1:5000')) {
    // API 베이스는 origin만 사용 (경로 접두사 /mobile, /stock-portfolio/mobile 등과 무관)
    const origin = new URL(url).origin;
    if (key === 'cashAccounts') {
      url = `${origin}/api/cash-accounts`;
    } else {
      const sheetMap: Record<string, string> = {
        tradeJournal: '매매일지',
        portfolioMap: '포트폴리오 맵',
        investigation: '탐구생활',
        performance: '실적',
      };
      const sheetName = sheetMap[key];
      if (sheetName) {
        url = `${origin}/api/read-excel?sheet=${encodeURIComponent(sheetName)}&file=${encodeURIComponent('주식 체크 리스트_20220328.xlsx')}`;
      }
    }
  }

  // 네트워크 연결 먼저 확인
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log(`[dataService] 📵 오프라인 상태 - 캐시 유지 (${key})`);
      return null;
    }
  } catch {
    console.log(`[dataService] 📵 네트워크 상태 확인 불가 (${key})`);
    return null;
  }

  // 타임아웃 적용 fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const urlWithCacheBuster = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;

  try {
    const response = await fetch(urlWithCacheBuster, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // 캐시 저장 (비동기, 실패해도 계속)
      AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data)).catch(e =>
        console.warn(`[dataService] 캐시 쓰기 실패 (${key}):`, e)
      );

      console.log(`[dataService] 🌐 서버 동기화 완료: ${key}`);
      return { data, fromServer: true };
    } else {
      console.warn(`[dataService] 서버 응답 오류 (${key}): ${response.status}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.log(`[dataService] ⏱️ 서버 응답 타임아웃 (${key})`);
    } else {
      console.log(`[dataService] ❌ 서버 연결 실패 (${key}): ${err.message}`);
    }
  }

  return null;
};

// ─────────────────────────────────────────────
// 4. 마지막 동기화 시간 저장
// ─────────────────────────────────────────────
export const saveLastSyncTime = async () => {
  try {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(META_KEY, now);
  } catch (e) {
    console.warn('[dataService] 동기화 시간 저장 실패:', e);
  }
};

// ─────────────────────────────────────────────
// 5. 캐시 전체 삭제 (초기화용)
// ─────────────────────────────────────────────
export const clearAllCache = async () => {
  try {
    const keys = Object.keys(DATA_URLS).map(k => `${CACHE_PREFIX}${k}`);
    keys.push(META_KEY);
    await AsyncStorage.multiRemove(keys);
    console.log('[dataService] 🗑️ 캐시 전체 삭제 완료');
  } catch (e) {
    console.warn('[dataService] 캐시 삭제 실패:', e);
  }
};
