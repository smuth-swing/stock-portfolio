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
  markQueueAsSynced: () => Promise<void>;
  cleanupSyncQueue: () => Promise<void>;

  // 목표가 저장소 (로컬)
  targetPrices: Record<string, number>;
  setTargetPrice: (stock: string, price: number | null) => Promise<void>;
  loadTargetPrices: () => Promise<void>;

  // 목표 시점 저장소 (로컬)
  targetDates: Record<string, string>;
  setTargetDate: (stock: string, date: string | null) => Promise<void>;
  loadTargetDates: () => Promise<void>;
}

// ─────────────────────────────────────────────
// 데이터 키 목록 (서버 동기화 대상)
// ※ targetPrices는 로컬 전용이므로 여기에 포함하지 않음 (loadTargetPrices로 별도 관리)
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

const applyQueueToData = (dataKey: string, dataObj: any, queue: any[]) => {
  if (!queue || queue.length === 0 || !dataObj || !dataObj.data) return dataObj;
  
  const newData = { ...dataObj, data: [...dataObj.data] };
  // ★ columns는 dataObj에서 직접 참조 (스프레드 시 누락 방지)
  const columns = dataObj.columns || [];
  
  queue.forEach(edit => {
    if (edit.sheet === '탐구생활' && dataKey === 'investigation') {
      const idx = edit.rowIndex;
      if (newData.data[idx]) {
        newData.data[idx] = { ...newData.data[idx] };
        edit.values.forEach((val: any, i: number) => {
           const colName = columns[i];
           if (colName) {
               newData.data[idx][colName] = val;
           }
        });
      }
    }
  });
  return newData;
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
  targetPrices: {},
  setTargetPrice: async (stock: string, price: number | null) => {
    const { targetPrices } = get();
    const newPrices = { ...targetPrices };
    if (price === null) {
      delete newPrices[stock];
    } else {
      newPrices[stock] = price;
    }
    set({ targetPrices: newPrices });
    await AsyncStorage.setItem('@target_prices', JSON.stringify(newPrices));
  },
  loadTargetPrices: async () => {
    try {
      const pStr = await AsyncStorage.getItem('@target_prices');
      if (pStr) set({ targetPrices: JSON.parse(pStr) });
    } catch (e) {}
  },
  targetDates: {},
  setTargetDate: async (stock: string, date: string | null) => {
    const { targetDates } = get();
    const newDates = { ...targetDates };
    if (date === null) {
      delete newDates[stock];
    } else {
      newDates[stock] = date;
    }
    set({ targetDates: newDates });
    await AsyncStorage.setItem('@target_dates', JSON.stringify(newDates));
  },
  loadTargetDates: async () => {
    try {
      const dStr = await AsyncStorage.getItem('@target_dates');
      if (dStr) set({ targetDates: JSON.parse(dStr) });
    } catch (e) {}
  },

  // ────────────────────────────────────────────
  // [1단계] 앱 시작: 로컬 캐시 우선 로드 → 백그라운드 서버 동기화
  // ────────────────────────────────────────────
  fetchData: async () => {
    set({ isLoading: true, error: null });

    // 마지막 동기화 시간 복원
    const lastSync = await getLastSyncTime();
    if (lastSync) set({ lastSyncTime: lastSync });

    let anyCacheLoaded = false;

    // [1단계] 로컬 캐시에서 즉시 로드 (병렬 처리로 속도 최적화)
    console.log('[useDataStore] 💾 1단계: 로컬 캐시 로드 시작');
    const cacheResults = await Promise.all(
      DATA_KEYS.map(async ({ k, s }) => {
        try {
          const cached = await getCachedData(k as any);
          return { s, cached };
        } catch (e) {
          console.warn(`[useDataStore] 캐시 로드 실패 (${s}):`, e);
          return { s, cached: null };
        }
      })
    );

    for (const { s, cached } of cacheResults) {
      if (cached && isValidData(cached)) {
        set((state: any) => ({ ...state, [s]: applyQueueToData(s, cached, state.syncQueue) }));
        anyCacheLoaded = true;
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
          set((state: any) => ({ ...state, [s]: applyQueueToData(s, result.data, state.syncQueue) }));
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
    
    // 서버 데이터를 다 불러온 후에, 서버의 갱신 시간과 비교하여 이미 반영된 큐 정리
    await get().cleanupSyncQueue();
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
  },

  markQueueAsSynced: async () => {
    const { syncQueue } = get();
    // ★ PC 서버 전송 완료: isPendingSync를 false로, sentAt에 전송 시각 기록
    const now = new Date().toISOString();
    const newQueue = syncQueue.map(item => ({ ...item, isPendingSync: false, sentAt: now }));
    set({ syncQueue: newQueue });
    await AsyncStorage.setItem('@sync_queue', JSON.stringify(newQueue));
    console.log(`[useDataStore] 📤 큐 ${newQueue.length}건 PC 전송 완료 표시`);
  },

  cleanupSyncQueue: async () => {
    const { syncQueue, meta } = get();
    if (!syncQueue || syncQueue.length === 0) return;
    if (!meta || !meta.updated_at) return;
    
    const serverTime = new Date(meta.updated_at).getTime();
    const newQueue = syncQueue.filter(edit => {
      if (!edit.timestamp) return false;
      
      // 아직 PC로 전송하지 않은 항목은 무조건 유지
      if (edit.isPendingSync !== false) return true;
      
      // ★ 수정 시각(timestamp) 기준으로 서버 반영 여부 확인
      // 서버의 meta.updated_at이 수정 시각(edit.timestamp)보다 이후이면,
      // 서버 데이터가 우리 편집 이후에 갱신된 것이므로 편집이 반영됨 → 삭제 가능
      // 기기 간 미세한 클럭 오차 방지를 위해 3초의 보정 시간을 적용
      const editTime = new Date(edit.timestamp).getTime();
      return serverTime < (editTime - 3000); // 서버가 수정 시각(보정치 적용) 이전에 갱신됨 → 아직 미반영 → 유지
    });
    
    if (newQueue.length !== syncQueue.length) {
      set({ syncQueue: newQueue });
      await AsyncStorage.setItem('@sync_queue', JSON.stringify(newQueue));
      console.log(`[useDataStore] 🧹 서버에 이미 반영된 큐 ${syncQueue.length - newQueue.length}개 정리 완료 (남은 큐: ${newQueue.length}건)`);
    }
  }
}));

// 초기화 시 큐 로드
useDataStore.getState().loadSyncQueue();
useDataStore.getState().loadTargetPrices();
useDataStore.getState().loadTargetDates();
