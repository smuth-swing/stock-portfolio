import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

export default function TradeScreen() {
  const { tradeJournal, isLoading } = useDataStore();
  const route = useRoute<RouteProp<any, '매매일지'>>();
  const [selectedStock, setSelectedStock] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(60); // 차트 간격(Zoom) 제어
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(60);
  const chartScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (route.params?.selectedStock) {
      setSelectedStock(route.params.selectedStock);
    }
  }, [route.params?.selectedStock]);

  // 최근 6개월 데이터만 필터링
  const validTrades = useMemo(() => {
    if (!tradeJournal || !tradeJournal.data) return [];
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return tradeJournal.data.slice(1).filter((r: any) => {
      const rawDate = r['Unnamed: 0'];
      const rawStock = r['Unnamed: 1'];
      
      // 값이 아예 없거나, 헤더인 경우 필터링
      if (!rawDate || rawDate === 'Date' || !rawStock || rawStock === '종목') return false;
      
      // 모바일 환경을 고려한 날짜 파싱 (띄어쓰기를 T로 변환)
      const safeDateStr = String(rawDate).includes(' ') ? String(rawDate).replace(' ', 'T') : rawDate;
      const tradeDate = new Date(safeDateStr);
      
      return !isNaN(tradeDate.getTime()) && tradeDate >= sixMonthsAgo;
    });
  }, [tradeJournal]);

  // 종목 필터 목록 추출 (최근 6개월에 거래된 종목만)
  const stocks = useMemo(() => {
    const stockSet = new Set<string>();
    validTrades.forEach((row: any) => {
      const name = row['Unnamed: 1'];
      if (name && typeof name === 'string' && name.trim()) stockSet.add(name.trim());
    });
    return ['전체', ...Array.from(stockSet).sort()];
  }, [validTrades]);

  // 검색어로 필터링된 종목 목록
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return stocks;
    return stocks.filter(s => s.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  }, [stocks, searchQuery]);

  // 차트 데이터 구성 (선택된 종목)
  const chartData = useMemo(() => {
    const portfolioMap = useDataStore.getState().portfolioMap;

    if (selectedStock === '전체') {
      const getYearWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 보정
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
      };

      const weeklyGroups: { [key: string]: number } = {};

      validTrades.forEach((row: any) => {
        const rawDate = row['Unnamed: 0'];
        const safeDateStr = String(rawDate).includes(' ') ? String(rawDate).replace(' ', 'T') : rawDate;
        const date = new Date(safeDateStr);
        
        const qty = parseFloat(row['Unnamed: 2']) || 0;
        const price = parseFloat(row['Unnamed: 3']) || 0;

        const tradeOnes = Math.round((qty * price) / 1000000);
        let numVal = tradeOnes * 100;

        const tradeType = String(row['Unnamed: 4'] || '').trim();
        if (tradeType === '매도') {
          numVal = -Math.abs(numVal);
        } else {
          numVal = Math.abs(numVal);
        }

        const monday = getYearWeek(date);
        const mondayKey = monday.toISOString().split('T')[0];

        if (!weeklyGroups[mondayKey]) {
          weeklyGroups[mondayKey] = 0;
        }
        weeklyGroups[mondayKey] += numVal;
      });

      const weeklyTotals = Object.entries(weeklyGroups).map(([mondayKey, total]) => {
        return {
          mondayKey,
          mondayDate: new Date(mondayKey),
          total
        };
      });
      weeklyTotals.sort((a, b) => a.mondayDate.getTime() - b.mondayDate.getTime());

      // 현재 누적 투자금액 결정 (포트폴리오 맵 데이터 기준)
      let currentTotal = 9500; // 만원 단위 (기본 9500만원)
      if (portfolioMap && portfolioMap.data) {
        let totalMarks = 0;
        const rows = portfolioMap.data.slice(1);
        const cols = portfolioMap.columns || [];
        rows.forEach((row: any) => {
          const stockName = String(row['Unnamed: 3'] || '').trim();
          if (!stockName || stockName === '종목') return;
          
          for (let colIdx = 4; colIdx < cols.length; colIdx++) {
            const colName = cols[colIdx];
            if (row[colName] === 1 || row[colName] === 1.0) {
              totalMarks++;
            }
          }
        });
        if (totalMarks > 0) {
          currentTotal = totalMarks * 100;
        }
      }

      // 누적 투자금액 역산
      const n = weeklyTotals.length;
      const cumulativeAmounts: number[] = new Array(n);
      if (n > 0) {
        cumulativeAmounts[n - 1] = currentTotal;
        for (let i = n - 1; i > 0; i--) {
          cumulativeAmounts[i - 1] = cumulativeAmounts[i] - weeklyTotals[i].total;
        }
      }

      const maxCumulative = Math.max(...cumulativeAmounts) || 1;

      const investmentData = weeklyTotals.map((w, idx) => {
        const d = w.mondayDate;
        const label = isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
        const cumulativeM = Math.round(cumulativeAmounts[idx] / 100);
        const weeklyM = Math.round(w.total / 100);
        const sign = weeklyM > 0 ? '+' : '';
        const weeklyText = `${sign}${weeklyM}`;
        const value = (cumulativeAmounts[idx] / maxCumulative) * 100;

        return {
          value: value,
          originalValue: cumulativeM,
          label: label,
          dataPointText: '',
          dataPointLabelComponent: () => (
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 60, height: 40, zIndex: 999, overflow: 'visible' }}>
              <Text style={{
                color: '#D4AF37',
                fontSize: 9,
                fontWeight: 'bold',
                position: 'absolute',
                bottom: 29, // 선 및 점 위로 3글자만큼 올림
                textAlign: 'center',
                zIndex: 1000
              }}>
                {cumulativeM}
              </Text>
              <Text style={{
                color: '#94A3B8',
                fontSize: 8,
                fontWeight: 'bold',
                position: 'absolute',
                bottom: 11, // 선 및 점 위로 3글자만큼 올림
                textAlign: 'center',
                zIndex: 1000
              }}>
                {weeklyText}
              </Text>
            </View>
          )
        };
      });

      return { investmentData, priceData: [] };
    }

    // 개별 종목일 때의 로직
    const stockTrades = validTrades
      .filter((r: any) => r['Unnamed: 1'] === selectedStock)
      .sort((a: any, b: any) => {
        const safeA = String(a['Unnamed: 0']).includes(' ') ? String(a['Unnamed: 0']).replace(' ', 'T') : a['Unnamed: 0'];
        const safeB = String(b['Unnamed: 0']).includes(' ') ? String(b['Unnamed: 0']).replace(' ', 'T') : b['Unnamed: 0'];
        let dateA = new Date(safeA).getTime();
        let dateB = new Date(safeB).getTime();
        if (isNaN(dateA)) dateA = 0;
        if (isNaN(dateB)) dateB = 0;
        return dateA - dateB;
      });

    const rawInvestmentData: any[] = [];
    const rawPriceData: any[] = [];

    stockTrades.forEach((row: any) => {
      const safeDateStr = String(row['Unnamed: 0']).includes(' ') ? String(row['Unnamed: 0']).replace(' ', 'T') : row['Unnamed: 0'];
      const date = new Date(safeDateStr);
      const label = isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}/${date.getDate()}`;

      const rawAmount = row['Unnamed: 5'];
      const amountVal = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/,/g, '')) || 0;
      const investmentM = amountVal / 100;

      const rawPrice = row['Unnamed: 3'];
      const priceVal = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/,/g, '')) || 0;

      const roundedInvestmentM = Math.round(investmentM);

      rawInvestmentData.push({
        originalValue: roundedInvestmentM,
        label: label,
        dataPointText: roundedInvestmentM.toString(),
      });

      rawPriceData.push({
        originalValue: priceVal,
        dataPointText: priceVal.toLocaleString(),
        textShiftY: 15,
      });
    });

    const maxInvestment = Math.max(...rawInvestmentData.map(d => d.originalValue)) || 1;
    const maxPrice = Math.max(...rawPriceData.map(d => d.originalValue)) || 1;

    const investmentData = rawInvestmentData.map(d => ({
      ...d,
      value: (d.originalValue / maxInvestment) * 100,
    }));

    const priceData = rawPriceData.map(d => ({
      ...d,
      value: (d.originalValue / maxPrice) * 100,
    }));

    return { investmentData, priceData };
  }, [validTrades, selectedStock]);

  // 종목 또는 총합 필터 선택 시 최신 날짜(우측 끝)로 자동 스크롤 이동
  useEffect(() => {
    if (chartData.investmentData.length > 0 && chartScrollRef.current) {
      const timer = setTimeout(() => {
        chartScrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedStock, chartData.investmentData.length]);

  const handleFitToScreen = () => {
    if (chartData.investmentData.length > 0) {
      // (화면 너비 - 여백) / 데이터 개수로 자동 계산하여 한 화면에 꽉 차게 설정
      // 사용자 요청에 따라 10% 정도 더 여유 있게(간격을 90%로 축소) 조정
      const fitSpacing = ((width - 100) / Math.max(1, chartData.investmentData.length - 1)) * 0.9;
      setZoomLevel(Math.max(15, fitSpacing));
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(150, prev * 1.3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(15, prev * 0.7));
  };

  const getTouchDistance = (touches: any[]) => {
    const [firstTouch, secondTouch] = touches;
    const dx = firstTouch.pageX - secondTouch.pageX;
    const dy = firstTouch.pageY - secondTouch.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePinchStart = (event: any) => {
    const touches = event.nativeEvent.touches;
    if (touches.length !== 2) return;

    pinchStartDistance.current = getTouchDistance(touches);
    pinchStartZoom.current = zoomLevel;
    setIsPinching(true);
  };

  const handlePinchMove = (event: any) => {
    const touches = event.nativeEvent.touches;
    if (touches.length !== 2 || !pinchStartDistance.current) return;

    const currentDistance = getTouchDistance(touches);
    const scale = currentDistance / pinchStartDistance.current;
    const nextZoom = pinchStartZoom.current * scale;
    setZoomLevel(Math.min(150, Math.max(15, nextZoom)));
  };

  const handlePinchEnd = () => {
    pinchStartDistance.current = null;
    setIsPinching(false);
  };

  // 종목 선택 시 자동으로 전체보기(Fit) 적용
  useEffect(() => {
    if (selectedStock !== '전체' && chartData.investmentData.length > 0) {
      // handleFitToScreen 로직 인라인 (의존성 순환 방지)
      const fitSpacing = ((width - 100) / Math.max(1, chartData.investmentData.length - 1)) * 0.9;
      setZoomLevel(Math.max(15, fitSpacing));
    }
  }, [selectedStock, chartData.investmentData.length]);

  // 데이터가 전혀 없고 로딩 중일 때만 스피너 표시
  // (캐시 데이터라도 있으면 바로 화면 진입)
  if (isLoading && !tradeJournal) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>데이터 확인 중...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      
      {/* 종목 검색기 */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 종목명 검색..."
          placeholderTextColor="#475569"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 종목 선택기 */}
      <View style={styles.selectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {filteredStocks.map(stock => (
            <TouchableOpacity 
              key={stock} 
              style={[styles.pill, selectedStock === stock && styles.pillActive]}
              onPress={() => setSelectedStock(stock)}
            >
              <Text style={[styles.pillText, selectedStock === stock && styles.pillTextActive]}>
                {stock === '전체' ? '총합' : stock}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* PC 웹과 동일한 이중선 차트 영역 */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
        {chartData.investmentData.length > 0 ? (
          <View style={styles.glassCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{selectedStock === '전체' ? '총합' : selectedStock} 매매 추이 (최근 6개월)</Text>
              
              {/* 줌 컨트롤러 */}
              <View style={styles.zoomControls}>
                <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut}>
                  <Text style={styles.zoomBtnText}>축소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn}>
                  <Text style={styles.zoomBtnText}>확대</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView ref={chartScrollRef} horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!isPinching}>
              <View
                style={{ paddingTop: 30, paddingBottom: 10 }}
                onStartShouldSetResponder={(event) => event.nativeEvent.touches.length === 2}
                onMoveShouldSetResponder={(event) => event.nativeEvent.touches.length === 2}
                onResponderGrant={handlePinchStart}
                onResponderMove={handlePinchMove}
                onResponderRelease={handlePinchEnd}
                onResponderTerminate={handlePinchEnd}
              >
                <LineChart
                  data={chartData.investmentData}
                  height={220}
                  width={Math.max(width - 80, chartData.investmentData.length * zoomLevel)}
                  spacing={zoomLevel}
                  initialSpacing={20}
                  thickness={3}
                  color="#D4AF37" // 투자금액 (골드)
                  dataPointsColor="#D4AF37"
                  textColor="#D4AF37"
                  textFontSize={10}
                  textShiftY={-15}
                  yAxisColor="transparent"
                  xAxisColor="rgba(255,255,255,0.1)"
                  xAxisLabelTextStyle={{ color: '#FFFFFF', fontSize: 10 }}
                  yAxisTextStyle={{ color: '#D4AF37', fontSize: 10 }}
                  rulesColor="rgba(255,255,255,0.05)"
                  hideDataPoints={false}
                  curved
                  hideYAxisText={true} // 정규화되었으므로 Y축 숫자 대신 직접 포인트의 라벨만 표시
                  maxValue={140} // 라벨 여백 확보
                  {...(selectedStock !== '전체' ? {
                    data2: chartData.priceData,
                    thickness2: 2,
                    color2: "rgba(148, 163, 184, 0.7)",
                    dataPointsColor2: "#94A3B8",
                    textColor2: "#94A3B8",
                    textFontSize2: 9,
                  } : {})}
                />
              </View>
            </ScrollView>
            
            {/* 범례 (Legend) */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D4AF37' }]} />
                <Text style={styles.legendText}>
                  {selectedStock === '전체' ? '누적 투자금 (백만)' : '투자금액 (백만)'}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.legendText}>
                  {selectedStock === '전체' ? '주간 증감 (백만)' : '평균 단가'}
                </Text>
              </View>
            </View>

          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.infoText}>
              {selectedStock === '전체'
                ? '매매일지의 최근 6개월 내 거래 내역이 없습니다.'
                : '해당 종목의 최근 6개월 내 거래 내역이 없습니다.'}
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', paddingHorizontal: 20, marginBottom: 16, letterSpacing: 0.5 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: '#E2E8F0', fontSize: 14,
  },
  selectorContainer: { height: 44, marginBottom: 16 },
  pill: { 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center'
  },
  pillActive: { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: '#D4AF37' },
  pillText: { color: '#94A3B8', fontWeight: '600', fontSize: 14 },
  pillTextActive: { color: '#D4AF37', fontWeight: 'bold' },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#E2E8F0' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  zoomBtnText: { color: '#E2E8F0', fontSize: 13, fontWeight: 'bold' },
  legendContainer: { marginTop: 20, flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
