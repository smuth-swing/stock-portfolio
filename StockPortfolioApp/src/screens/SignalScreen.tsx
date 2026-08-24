import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDataStore } from '../store/useDataStore';
import { getPortfolioMapInfo } from '../utils/excelFields';

export default function SignalScreen() {
  const { portfolioMap, investigation, meta, targetPrices, targetDates } = useDataStore();
  const [category, setCategory] = useState<'portfolio' | 'priority' | 'market'>('portfolio');
  const [signals, setSignals] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [stockCodes, setStockCodes] = useState<Record<string, string>>({});
  const [loadedStocks, setLoadedStocks] = useState<string[]>([]);
  const [foreignDiffs, setForeignDiffs] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadStockCodes = async () => {
      try {
        const ts = new Date().getTime();
        const res = await fetch(`data/stock_codes.json?t=${ts}`);
        if (res.ok) {
          const data = await res.json();
          setStockCodes(data);
        }
      } catch (e) {
        console.warn('Failed to load stock codes:', e);
      }
    };
    loadStockCodes();
  }, []);

  const pcIp = meta?.server_ip || '192.168.0.2';
  // PC 로컬 네트워크 환경에서의 API 접근 (Flask)
  const API_BASE = `http://${pcIp}:5000`;
  
  const isGitHubPages = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname.includes('github.io');

  // 탐구생활 시트에서 매매우선(모멘텀 또는 매매 전략 있음) 종목 추출
  const getPriorityStocks = () => {
    if (!investigation || !investigation.data) return [];
    
    const cols = investigation.columns || [];
    const getCol = (name: string) => cols.includes(name) ? name : '';
    const nameCol = getCol('종목명') || getCol('Unnamed: 1');
    const momentumCol = getCol('모멘텀') || getCol('Unnamed: 2');
    const strategyCol = getCol('매매 전략') || getCol('Unnamed: 6'); // 매매 전략 컬럼 추가
    
    if (!nameCol) return [];

    const prioritySet = new Set<string>();
    investigation.data.forEach((row: any) => {
      const stockName = String(row[nameCol] || '').trim();
      const hasMomentum = momentumCol && row[momentumCol] && String(row[momentumCol]).trim() !== '';
      const hasStrategy = strategyCol && row[strategyCol] && String(row[strategyCol]).trim() !== ''; // 매매 전략 유무 체크
      
      // 모멘텀 또는 매매 전략 중 하나라도 내용이 있고 취소선(~~)이 없는 경우 매매우선으로 처리
      if (stockName && stockName !== '종목' && stockName !== 'stock' && !stockName.includes('~~') && (hasMomentum || hasStrategy)) {
        prioritySet.add(stockName);
      }
    });
    return Array.from(prioritySet);
  };

  // 포트폴리오 맵 시트에서 보유 종목 추출
  const getPortfolioStocks = () => {
    if (!portfolioMap || !portfolioMap.data) return [];
    
    const { stockCol, amountCols, dataRows } = getPortfolioMapInfo(portfolioMap);

    const portSet = new Set<string>();
    dataRows.forEach((row: any) => {
      const stockName = String(row[stockCol as string] || '').trim();
      if (stockName && stockName !== '종목' && stockName !== 'stock') {
        let hasOne = false;
        amountCols.forEach((k: string) => {
          if (parseFloat(row[k]) === 1) hasOne = true;
        });
        if (hasOne) portSet.add(stockName);
      }
    });
    return Array.from(portSet);
  };

  const fetchSignal = async (stock: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/ls/moving-averages?name=${encodeURIComponent(stock)}`);
      if (!res.ok) throw new Error('API Error');
      const result = await res.json();
      if (result.success && result.data && result.data.current) {
        return result.data;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const refreshSignals = useCallback(async () => {
    setLoading(true);
    setSignals({});
    setForeignDiffs({});
    
    let stocks: string[] = [];
    let diffMap: Record<string, number> = {};
    if (category === 'portfolio') {
      stocks = getPortfolioStocks();
    } else if (category === 'priority') {
      stocks = getPriorityStocks();
    } else if (category === 'market') {
      if (isGitHubPages) {
        try {
          const ts = new Date().getTime();
          const res = await fetch(`data/market_interest_stocks.json?t=${ts}`);
          if (res.ok) {
            const data = await res.json();
            stocks = data.stocks || [];
            diffMap = data.foreign_diffs || {};
          }
        } catch (e) {
          console.warn('Failed to load offline market interest stocks:', e);
        }
      } else {
        try {
          const res = await fetch(`${API_BASE}/api/market-interest-stocks`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              stocks = data.stocks || [];
              diffMap = data.foreign_diffs || {};
            }
          }
        } catch (e) {
          console.warn('Failed to fetch market interest stocks from API, falling back to local file:', e);
          try {
            const res = await fetch(`data/market_interest_stocks.json`);
            if (res.ok) {
              const data = await res.json();
              stocks = data.stocks || [];
              diffMap = data.foreign_diffs || {};
            }
          } catch (fallbackErr) {}
        }
      }
    }
    
    setLoadedStocks(stocks);
    setForeignDiffs(diffMap);
    const newSignals: Record<string, any> = {};

    if (isGitHubPages) {
      // 오프라인/GitHub Pages 모바일 환경: 미리 수집된 JSON 파일에서 한 번에 읽음
      try {
        const ts = new Date().getTime();
        const res = await fetch(`data/moving_averages.json?t=${ts}`);
        if (res.ok) {
          const cachedSignals = await res.json();
          for (const stock of stocks) {
            const data = cachedSignals[stock];
            if (data && data.current) {
              newSignals[stock] = { ...data, loading: false };
            } else if (data && data.error) {
              newSignals[stock] = { error: true, loading: false };
            } else {
              newSignals[stock] = { error: true, loading: false };
            }
          }
        }
      } catch (e) {
        console.error('Offline JSON load error:', e);
        for (const stock of stocks) {
          newSignals[stock] = { error: true, loading: false };
        }
      }
      setSignals(newSignals);
    } else {
      // 로컬 PC 환경: LS API 실시간 호출 (속도 제한 방지 위해 순차 호출)
      for (const stock of stocks) {
        setSignals(prev => ({ ...prev, [stock]: { loading: true } }));
        
        const data = await fetchSignal(stock);
        newSignals[stock] = data ? { ...data, loading: false } : { error: true, loading: false };
        
        setSignals(prev => ({ ...prev, [stock]: newSignals[stock] }));
      }
    }
    
    setLoading(false);
  }, [category, portfolioMap, investigation, isGitHubPages, API_BASE]);



  useEffect(() => {
    refreshSignals();
  }, [refreshSignals]);

  const renderSignalRow = (stock: string) => {
    const data = signals[stock];
    
    if (!data) return null;
    if (data.loading) {
      return (
        <View key={stock} style={styles.card}>
          <Text style={styles.stockName}>{stock}</Text>
          <ActivityIndicator size="small" color="#00F2FE" />
        </View>
      );
    }
    
    if (data.error) {
      return (
        <View key={stock} style={styles.card}>
          <Text style={styles.stockName}>{stock}</Text>
          <Text style={styles.errorText}>서버 연결 불가 / 조회 실패</Text>
        </View>
      );
    }

    const current = data.current || 0;
    const ma5_month = data.ma5_month || 0;
    const ma5_month_next = data.ma5_month_next || ma5_month;
    const ma120_week = data.ma120_week || 0;
    
    let danger = false;
    let ma5CurText = '-';
    let ma5NextText = '-';
    let ma120Text = '-';
    
    if (ma5_month > 0) {
      if (current < ma5_month_next) danger = true;
      
      if (current < ma5_month) {
        const diff = Math.abs(((current - ma5_month) / ma5_month) * 100);
        ma5CurText = `${diff.toFixed(1)}% 하회`;
      }
      if (current < ma5_month_next) {
        const diff = Math.abs(((current - ma5_month_next) / ma5_month_next) * 100);
        ma5NextText = `${diff.toFixed(1)}% 하회`;
      }
    }
    
    if (ma120_week > 0) {
      const diffRaw = ((current - ma120_week) / ma120_week) * 100;
      const diffAbs = Math.abs(diffRaw);
      if (diffAbs <= 5.0) {
        ma120Text = diffRaw < 0 ? `${diffAbs.toFixed(1)}% 하회` : `${diffAbs.toFixed(1)}% 상회`;
        danger = true;
      }
    }
    
    const rsiD = data.rsi_day || 0;
    const rsiW = data.rsi_week || 0;
    const rsiM = data.rsi_month || 0;
    let rsiTexts = [];
    if (rsiD > 0 && rsiD <= 30) rsiTexts.push(`일:${rsiD}`);
    if (rsiW > 0 && rsiW <= 30) rsiTexts.push(`주:${rsiW}`);
    if (rsiM > 0 && rsiM <= 30) rsiTexts.push(`월:${rsiM}`);
    const rsiText = rsiTexts.length > 0 ? rsiTexts.join(', ') : '-';

    const targetPrice = targetPrices?.[stock];
    const targetDate = targetDates?.[stock];
    let isTargetReached = false;
    if (targetPrice) {
      const high_1w = data.high_1w || current;
      const low_1w = data.low_1w || current;
      if (current <= targetPrice || (high_1w >= targetPrice && low_1w <= targetPrice)) {
        isTargetReached = true;
      }
    }

    return (
      <View key={stock} style={[styles.card, (danger || isTargetReached) && styles.cardDanger]}>
        <View style={styles.cardHeader}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={styles.stockName}>{stock}</Text>
              {foreignDiffs[stock] !== undefined && (
                <View style={[
                  styles.foreignBadge,
                  { backgroundColor: foreignDiffs[stock] > 0 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                ]}>
                  <Text style={[
                    styles.foreignBadgeText,
                    { color: foreignDiffs[stock] > 0 ? '#00F2FE' : '#EF4444' }
                  ]}>
                    외인 {foreignDiffs[stock] > 0 ? '+' : ''}{foreignDiffs[stock].toFixed(2)}%p
                  </Text>
                </View>
              )}
              {isTargetReached && targetPrice && (
                <Text style={styles.targetReachedBadge}>🚨 목표가 도달 ({targetPrice.toLocaleString()}원)</Text>
              )}
            </View>
            {(targetPrice || targetDate) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                {targetPrice ? (
                  <>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>목표가: </Text>
                    <Text style={{ color: '#00F2FE', fontSize: 13, fontWeight: 'bold' }}>{targetPrice.toLocaleString()}원</Text>
                  </>
                ) : null}
                {targetDate ? (
                  <>
                    <Text style={{ color: '#94A3B8', fontSize: 13, marginLeft: targetPrice ? 8 : 0 }}>시점: </Text>
                    <Text style={{ color: '#00F2FE', fontSize: 13, fontWeight: 'bold' }}>{targetDate}</Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
          <Text style={styles.price}>{current.toLocaleString()}원</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>현재5월선</Text>
            <Text style={[styles.infoValue, ma5CurText !== '-' && styles.textDanger]}>{ma5CurText}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>미래5월선</Text>
            <Text style={[styles.infoValue, ma5NextText !== '-' && styles.textDanger]}>{ma5NextText}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>120주선</Text>
            <Text style={[styles.infoValue, ma120Text !== '-' && styles.textDanger]}>{ma120Text}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RSI 경고</Text>
            <Text style={[styles.infoValue, rsiText !== '-' && styles.textDanger]}>{rsiText}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>신호 포착 🎯</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={refreshSignals} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#00F2FE" />
            ) : (
              <Text style={styles.refreshBtnText}>🔄 새로고침</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterBtn, category === 'portfolio' && styles.filterBtnActive]}
          onPress={() => setCategory('portfolio')}
        >
          <Text style={[styles.filterBtnText, category === 'portfolio' && styles.filterBtnTextActive]}>포트폴리오</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, category === 'priority' && styles.filterBtnActive]}
          onPress={() => setCategory('priority')}
        >
          <Text style={[styles.filterBtnText, category === 'priority' && styles.filterBtnTextActive]}>매매우선</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, category === 'market' && styles.filterBtnActive]}
          onPress={() => setCategory('market')}
        >
          <Text style={[styles.filterBtnText, category === 'market' && styles.filterBtnTextActive]}>시장관심종목</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {loadedStocks.length === 0 ? (
          <Text style={styles.emptyText}>해당하는 종목이 없습니다.</Text>
        ) : (
          loadedStocks.map(stock => renderSignalRow(stock))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    padding: 20, 
    paddingTop: 60, 
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

  refreshBtn: {
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  refreshBtnText: {
    color: '#00F2FE',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    borderColor: '#00F2FE',
  },
  filterBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#00F2FE',
  },
  listContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#334155',
  },
  cardDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftColor: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  stockName: { fontSize: 18, fontWeight: 'bold', color: '#D4AF37' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#00F2FE' },
  cardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoRow: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: { color: '#94A3B8', fontSize: 13 },
  infoValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  textDanger: { color: '#EF4444' },
  textHighlight: { color: '#10B981' },
  errorText: { color: '#EF4444', fontSize: 13, marginTop: 10 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40 },
  targetReachedBadge: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  foreignBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  foreignBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
