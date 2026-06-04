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
    if (selectedStock === '전체') return { investmentData: [], priceData: [] };
    
    // 해당 종목만 필터링 및 날짜 오름차순 정렬 (차트용)
    const stockTrades = validTrades
      .filter((r: any) => r['Unnamed: 1'] === selectedStock)
      .sort((a: any, b: any) => {
        const safeA = String(a['Unnamed: 0']).includes(' ') ? String(a['Unnamed: 0']).replace(' ', 'T') : a['Unnamed: 0'];
        const safeB = String(b['Unnamed: 0']).includes(' ') ? String(b['Unnamed: 0']).replace(' ', 'T') : b['Unnamed: 0'];
        let dateA = new Date(safeA).getTime();
        let dateB = new Date(safeB).getTime();
        if (isNaN(dateA)) dateA = 0;
        if (isNaN(dateB)) dateB = 0;
        return dateA - dateB; // 오래된 순서대로 정렬
      });

    const rawInvestmentData: any[] = [];
    const rawPriceData: any[] = [];

    stockTrades.forEach((row: any) => {
      // 날짜 라벨 포맷 (MM/DD)
      const safeDateStr = String(row['Unnamed: 0']).includes(' ') ? String(row['Unnamed: 0']).replace(' ', 'T') : row['Unnamed: 0'];
      const date = new Date(safeDateStr);
      const label = isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}/${date.getDate()}`;

      // 투자금액 (M단위로 변환: 원래 단위가 만원이면 /100)
      const rawAmount = row['Unnamed: 5'];
      const amountVal = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/,/g, '')) || 0;
      const investmentM = amountVal / 100;

      // 평균 단가
      const rawPrice = row['Unnamed: 3'];
      const priceVal = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/,/g, '')) || 0;

      rawInvestmentData.push({
        originalValue: investmentM,
        label: label,
        dataPointText: investmentM.toFixed(1),
      });

      rawPriceData.push({
        originalValue: priceVal,
        dataPointText: priceVal.toLocaleString(),
        textShiftY: 15,
      });
    });

    // 이중 축 이슈 해결을 위한 0~100 정규화 (Normalization)
    // 두 데이터의 단위가 너무 달라 작은 쪽이 바닥에 붙는 현상을 방지합니다.
    const maxInvestment = Math.max(...rawInvestmentData.map(d => d.originalValue)) || 1;
    const maxPrice = Math.max(...rawPriceData.map(d => d.originalValue)) || 1;

    const investmentData = rawInvestmentData.map(d => ({
      ...d,
      value: (d.originalValue / maxInvestment) * 100, // 0~100 스케일로 변환
    }));

    const priceData = rawPriceData.map(d => ({
      ...d,
      value: (d.originalValue / maxPrice) * 100,      // 0~100 스케일로 변환
    }));

    return { investmentData, priceData };
  }, [validTrades, selectedStock]);

  const handleFitToScreen = () => {
    if (chartData.investmentData.length > 0) {
      // (화면 너비 - 여백) / 데이터 개수로 자동 계산하여 한 화면에 꽉 차게 설정
      // 사용자 요청에 따라 10% 정도 더 여유 있게(간격을 90%로 축소) 조정
      const fitSpacing = ((width - 100) / Math.max(1, chartData.investmentData.length - 1)) * 0.9;
      setZoomLevel(Math.max(15, fitSpacing));
    }
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
      handleFitToScreen();
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
                {stock}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* PC 웹과 동일한 이중선 차트 영역 */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
        {selectedStock === '전체' ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.infoText}>상단에서 종목을 선택하시면 투자금액 및 평균 단가 트렌드 차트가 표시됩니다.</Text>
          </View>
        ) : chartData.investmentData.length > 0 ? (
          <View style={styles.glassCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{selectedStock} 매매 추이 (최근 6개월)</Text>
              
              {/* 줌 컨트롤러 */}
              <View style={styles.zoomControls}>
                <TouchableOpacity style={styles.zoomBtn} onPress={handleFitToScreen}>
                  <Text style={styles.zoomBtnText}>전체보기</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!isPinching}>
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
                  data2={chartData.priceData}
                  height={220}
                  width={Math.max(width - 80, chartData.investmentData.length * zoomLevel)}
                  spacing={zoomLevel}
                  initialSpacing={20}
                  thickness={3}
                  thickness2={2}
                  color="#D4AF37" // 투자금액 (골드)
                  color2="rgba(148, 163, 184, 0.7)" // 평균 단가 (슬레이트)
                  dataPointsColor="#D4AF37"
                  dataPointsColor2="#94A3B8"
                  textColor="#D4AF37"
                  textFontSize={10}
                  textShiftY={-15}
                  textColor2="#94A3B8"
                  textFontSize2={9}
                  yAxisColor="transparent"
                  xAxisColor="rgba(255,255,255,0.1)"
                  xAxisLabelTextStyle={{ color: '#FFFFFF', fontSize: 10 }}
                  yAxisTextStyle={{ color: '#D4AF37', fontSize: 10 }}
                  rulesColor="rgba(255,255,255,0.05)"
                  hideDataPoints={false}
                  curved
                  hideYAxisText={true} // 정규화되었으므로 Y축 숫자 대신 직접 포인트의 라벨만 표시
                  maxValue={120} // 라벨 여백 확보
                />
              </View>
            </ScrollView>
            
            {/* 범례 (Legend) */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D4AF37' }]} />
                <Text style={styles.legendText}>투자금액 (백만)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.legendText}>평균 단가</Text>
              </View>
            </View>

          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.infoText}>해당 종목의 최근 6개월 내 거래 내역이 없습니다.</Text>
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
