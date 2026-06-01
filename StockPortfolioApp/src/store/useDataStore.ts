import { create } from 'zustand';
import {
  fetchJSON,
  getCachedData,
  getLastSyncTime,
  saveLastSyncTime,
  clearAllCache,
} from '../services/dataService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// 상태 타입 정의
// ─────────────────────────────────────────────
interface AppState {
  // 데이터
  tradeJournal: any;
  portfolioMap: any;
  investigation: any;
  performance: any;
  meta: any;

  // 상태 플래그
  isLoading: boolean;       // 초기 로딩 중
  isSyncing: boolean;       // 백그라운드 서버 동기화 중
  isOffline: boolean;       // 오프라인 여부
  error: string | null;     // 오류 메시지

  // 동기화 메타
  lastSyncTime: string | null; // 마지막 서버 동기화 시간
  hasCachedData: boolean;      // 로컬 캐시 데이터 보유 여부

  // 액션
  fetchData: () => Promise<void>;    // 앱 시작 시 데이터 로드
  refreshData: () => Promise<void>;  // 수동 서버 새로고침
  resetCache: () => Promise<void>;   // 캐시 초기화 (디버깅용)

  // 오프라인 동기화 큐
  syncQueue: any[];
  addToSyncQueue: (editData: any) => Promise<void>;
  clearSyncQueue: () => Promise<void>;
  loadSyncQueue: () => Promise<void>;
}

// ─────────────────────────────────────────────
// 데이터 키 목록
// ─────────────────────────────────────────────
const DATA_KEYS = [
  { k: 'tradeJournal',  s: 'tradeJournal' },
  { k: 'portfolioMap',  s: 'portfolioMap' },
  { k: 'investigation', s: 'investigation' },
  { k: 'performance',   s: 'performance' },
  { k: 'meta',          s: 'meta' },
] as const;

// ─────────────────────────────────────────────
// 데이터 유효성 검사 헬퍼
// ─────────────────────────────────────────────
const isValidData = (data: any): boolean => {
  if (!data) return false;
  if (Array.isArray(data.data) && data.data.length > 0) return true;
  if (typeof data.row_count === 'number' && data.row_count > 0) return true;
  if (typeof data === 'object' && Object.keys(data).length > 0) return true;
  return false;
};

// ─────────────────────────────────────────────
// Zustand 스토어
// ─────────────────────────────────────────────
export const useDataStore = create<AppState>((set, get) => ({
  tradeJournal: null,
  portfolioMap: null,
  investigation: null,
  performance: null,
  meta: null,
  isLoading: false,
  isSyncing: false,
  isOffline: false,
  error: null,
  syncQueue: [],
  lastSyncTime: null,
  hasCachedData: false,

  // ────────────────────────────────────────────
  // [1단계] 앱 시작: 로컬 캐시 우선 로드 → 백그라운드 서버 동기화
  // ────────────────────────────────────────────
  fetchData: async () => {
    set({ isLoading: true, error: null });

    // 마지막 동기화 시간 복원
    const lastSync = await getLastSyncTime();
    if (lastSync) set({ lastSyncTime: lastSync });

    let anyCacheLoaded = false;

    // [1단계] 로컬 캐시에서 즉시 로드
    console.log('[useDataStore] 💾 1단계: 로컬 캐시 로드 시작');
    for (const { k, s } of DATA_KEYS) {
      try {
        const cached = await getCachedData(k as any);
        if (cached && isValidData(cached)) {
          set((state: any) => ({ ...state, [s]: cached }));
          anyCacheLoaded = true;
        }
      } catch (e) {
        console.warn(`[useDataStore] 캐시 로드 실패 (${s}):`, e);
      }
    }

    // 로컬 캐시 로드 완료 → 로딩 해제
    set({ isLoading: false, hasCachedData: anyCacheLoaded });
    console.log(`[useDataStore] 💾 1단계 완료 - 캐시 데이터: ${anyCacheLoaded ? '있음' : '없음'}`);

    // [2단계] 백그라운드에서 서버 동기화 (화면 방해 없이)
    get().refreshData();
  },

  // ────────────────────────────────────────────
  // [2단계] 서버 동기화 (수동 새로고침에서도 사용)
  // ────────────────────────────────────────────
  refreshData: async () => {
    // 이미 동기화 중이면 건너뜀
    if (get().isSyncing) return;
    set({ isSyncing: true });

    console.log('[useDataStore] 🌐 2단계: 서버 동기화 시작');
    let anyServerLoaded = false;
    let serverFailed = false;

    const syncPromises = DATA_KEYS.map(async ({ k, s }) => {
      try {
        const result = await fetchJSON(k as any);
        if (result && result.data && isValidData(result.data)) {
          set((state: any) => ({ ...state, [s]: result.data }));
          anyServerLoaded = true;
        } else if (result === null) {
          // null은 "오프라인 또는 타임아웃" - 에러 아님
          serverFailed = true;
        }
      } catch (e) {
        console.warn(`[useDataStore] 서버 동기화 실패 (${s}):`, e);
        serverFailed = true;
      }
    });

    await Promise.all(syncPromises);

    // 동기화 결과 반영
    if (anyServerLoaded) {
      const now = new Date().toISOString();
      await saveLastSyncTime();
      set({
        isSyncing: false,
        isOffline: false,
        lastSyncTime: now,
        hasCachedData: true,
        error: null,
      });
      console.log('[useDataStore] ✅ 서버 동기화 완료');
    } else {
      set({
        isSyncing: false,
        isOffline: serverFailed,
        error: serverFailed && !get().hasCachedData
          ? '서버에 연결할 수 없습니다.\n이전에 저장된 데이터가 없습니다.'
          : null,
      });
      console.log(`[useDataStore] ${serverFailed ? '⚠️ 서버 연결 실패 (오프라인 모드)' : '✅ 동기화 종료'}`);
    }
  },

  // ────────────────────────────────────────────
  // 캐시 초기화 (디버깅/개발용)
  // ────────────────────────────────────────────
  resetCache: async () => {
    await clearAllCache();
    set({
      tradeJournal: null,
      portfolioMap: null,
      investigation: null,
      performance: null,
      meta: null,
      lastSyncTime: null,
      hasCachedData: false,
      isOffline: false,
      error: null,
    });
    console.log('[useDataStore] 🗑️ 캐시 초기화 완료');
  },

  // ────────────────────────────────────────────
  // 오프라인 동기화 큐 관리
  // ────────────────────────────────────────────
  loadSyncQueue: async () => {
    try {
      const qStr = await AsyncStorage.getItem('@sync_queue');
      if (qStr) {
        set({ syncQueue: JSON.parse(qStr) });
      }
    } catch (e) {}
  },
  
  addToSyncQueue: async (editData: any) => {
    const { syncQueue } = get();
    const newQueue = [...syncQueue, editData];
    set({ syncQueue: newQueue });
    await AsyncStorage.setItem('@sync_queue', JSON.stringify(newQueue));
  },
  
  clearSyncQueue: async () => {
    set({ syncQueue: [] });
    await AsyncStorage.removeItem('@sync_queue');
  }
}));

// 초기화 시 큐 로드
useDataStore.getState().loadSyncQueue();
