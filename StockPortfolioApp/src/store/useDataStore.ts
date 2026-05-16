import { create } from 'zustand';
import { fetchJSON } from '../services/dataService';

interface AppState {
  tradeJournal: any;
  portfolioMap: any;
  investigation: any;
  performance: any;
  meta: any;
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export const useDataStore = create<AppState>((set) => ({
  tradeJournal: null,
  portfolioMap: null,
  investigation: null,
  performance: null,
  meta: null,
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      // 순서대로 하나씩 로딩 (디버깅 편의)
      const trade      = await fetchJSON('tradeJournal');
      const portfolio  = await fetchJSON('portfolioMap');
      const inv        = await fetchJSON('investigation');
      const perf       = await fetchJSON('performance');
      const metaData   = await fetchJSON('meta');

      set({
        tradeJournal: trade,
        portfolioMap: portfolio,
        investigation: inv,
        performance: perf,
        meta: metaData,
        isLoading: false,
      });
    } catch (err: any) {
      console.error('[useDataStore] fetchData 오류:', err);
      set({
        error: err.message || '데이터를 불러오는 중 오류가 발생했습니다.',
        isLoading: false,
      });
    }
  },
}));
