import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity,
  Modal,
  ActivityIndicator 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDataStore } from '../store/useDataStore';
import { PieChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING = 48;
const CHART_PAGE_WIDTH = SCREEN_WIDTH - CARD_PADDING;

// PC 버전과 동일한 색상 체계
const COLOR_OPERATING = 'rgba(212, 175, 55, 0.75)';   // 금색: 운영 종목
const COLOR_OPERATING_BORDER = '#D4AF37';
const COLOR_EXCLUDING = 'rgba(71, 85, 105, 0.75)';    // 진한 회색: 편출 종목
const COLOR_EXCLUDING_BORDER = '#475569';
const COLOR_AVG_LINE = '#EF4444';                       // 빨간색: 평균선

export default function PortfolioScreen() {
  const { portfolioMap, isLoading } = useDataStore();
  const [currentPage, setCurrentPage] = useState(0);
  const [showFullChart, setShowFullChart] = useState(false);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const [snapshots, setSnapshots] = useState<{ month: string; investment: number; cash: number; totalAsset: number; ratio: number }[]>([]);

  // AsyncStorage에서 월별 현금 스냅샷 로드
  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const raw = await AsyncStorage.getItem('monthlyCashSnapshots');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.sort((a: any, b: any) => a.month.localeCompare(b.month));
            setSnapshots(parsed);
          }
        }
      } catch (e) {}
    };
    loadSnapshots();
  }, []);

  // PC 버전과 동일한 데이터 파싱 로직
  const { sectorData, stockItems, totalInvestment, avgValue, stockCount } = useMemo(() => {
    if (!portfolioMap || !portfolioMap.data) {
      return { sectorData: [], stockItems: [], totalInvestment: 0, avgValue: 0, stockCount: 0 };
    }
    
    const sectors: { [key: string]: number } = {};
    const stocks: { label: string, value: number, sector: string, strategy: string }[] = [];
    const dataRows = portfolioMap.data.slice(1);
    const amountCols = portfolioMap.columns.filter(
      (c: string) => c.startsWith('Unnamed:') && parseInt(c.split(':')[1]) >= 4
    );
    const colors = ['#22C55E', '#F97316', '#38BDF8', '#EAB308', '#8B5CF6', '#14B8A6', '#F59E0B', '#64748B'];

    dataRows.forEach((row: any) => {
      const stockName = row['Unnamed: 3'] || '알수없음';
      const sector = row['Unnamed: 2'] || '기타';
      const strategy = row['Unnamed: 1'] || '';
      let amount = 0;
      amountCols.forEach((col: string) => {
        if (parseFloat(row[col]) === 1) amount++;
      });
      
      sectors[sector] = (sectors[sector] || 0) + amount;
      
      // 투자 금액이 0인 종목은 제외
      if (amount > 0) {
        stocks.push({ label: stockName, value: amount, sector, strategy });
      }
    });

    const total = Object.values(sectors).reduce((acc, value) => acc + value, 0);
    const sectorColorOverrides: { [key: string]: string } = { '바이오': '#F43F5E' };

    const formatSectors = () => {
      let cumulative = 0;
      let idx = 0;
      let smallSectorCount = 0;

      return Object.keys(sectors)
        .map(key => ({ key, value: sectors[key] }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .map(({ key, value }) => {
          const percentage = total ? Math.round((value / total) * 100) : 0;
          const color = sectorColorOverrides[key] || colors[idx % colors.length];
          const midValue = cumulative + (value / 2);
          const angle = (midValue / total) * 360;
          const rad = angle * (Math.PI / 180);
          const baseShift = idx >= 2 ? 10 : -10;
          let shiftDistance = baseShift;
          if (percentage <= 5) {
            smallSectorCount++;
            shiftDistance = baseShift + (smallSectorCount * 5);
          }
          const shiftTextX = Math.sin(rad) * shiftDistance;
          const shiftTextY = -Math.cos(rad) * shiftDistance;
          cumulative += value;
          idx++;
          return {
            value, percentage,
            text: percentage > 5 ? `${key} ${percentage}%` : `${key}`,
            color, label: key, shiftTextX, shiftTextY,
          };
        });
    };

    // PC 버전과 동일한 정렬: 운영 우선, 섹터별 그룹
    const sortedStocks = [...stocks].sort((a, b) => {
      if (a.strategy === '운영' && b.strategy !== '운영') return -1;
      if (a.strategy !== '운영' && b.strategy === '운영') return 1;
      return a.sector.localeCompare(b.sector);
    });

    const avg = stocks.length > 0
      ? stocks.reduce((acc, curr) => acc + curr.value, 0) / stocks.length
      : 0;

    return { 
      sectorData: formatSectors(), 
      stockItems: sortedStocks,
      totalInvestment: total,
      avgValue: avg,
      stockCount: stocks.length,
    };
  }, [portfolioMap]);

  // 스냅샷이 없으면 현재 투자금 기준 기본값 생성
  const activeSnapshots = useMemo(() => {
    if (snapshots.length > 0) return snapshots;
    if (totalInvestment > 0) {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return [{ month: monthStr, investment: totalInvestment, cash: 0, totalAsset: totalInvestment, ratio: 0 }];
    }
    return [];
  }, [snapshots, totalInvestment]);

  // useCallback으로 안정화하여 ScrollView 불필요한 리렌더 방지
  const onScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CHART_PAGE_WIDTH);
    setCurrentPage(prev => prev === page ? prev : page);
  }, []);

  // PieChart centerLabelComponent를 메모화하여 매 렌더링 재생성 방지
  const pieCenterLabel = useCallback(() => (
    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>{totalInvestment}M</Text>
      <Text style={{ fontSize: 10, color: '#94A3B8' }}>{stockCount}종목</Text>
    </View>
  ), [totalInvestment, stockCount]);

  if (isLoading && !portfolioMap) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>데이터 확인 중...</Text>
      </View>
    );
  }

  // ─── PC 버전과 동일 로직, 순수 View로 구현한 커스텀 가로 막대 차트 ───
  const renderCustomBarChart = (items: typeof stockItems, chartWidth: number) => {
    if (items.length === 0) return null;
    const maxVal = Math.max(...items.map(s => s.value), 1);
    const BAR_HEIGHT = 22;
    const BAR_GAP = 6;
    const LABEL_W = 90;    // 종목명 고정 너비
    const VALUE_W = 32;    // 금액 표시 너비
    const BAR_AREA = chartWidth - LABEL_W - VALUE_W - 24;
    const avgLineX = (avgValue / maxVal) * BAR_AREA;

    let lastSector = '';

    return (
      <View style={{ paddingHorizontal: 8 }}>
        {/* 평균선 범례 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: LABEL_W + 4 }}>
          <View style={{ width: 18, height: 2, backgroundColor: COLOR_AVG_LINE, marginRight: 5 }} />
          <Text style={{ color: COLOR_AVG_LINE, fontSize: 10, fontWeight: 'bold' }}>
            평균 {avgValue.toFixed(1)}M
          </Text>
        </View>

        {items.map((stock, index) => {
          const barWidth = (stock.value / maxVal) * BAR_AREA;
          const isAboveAvg = stock.value >= avgValue;
          const sectorChanged = stock.sector !== lastSector;
          lastSector = stock.sector;

          const isOperating = stock.strategy === '운영';
          const bgColor = isOperating ? COLOR_OPERATING : COLOR_EXCLUDING;
          const borderColor = isOperating ? COLOR_OPERATING_BORDER : COLOR_EXCLUDING_BORDER;

          return (
            <TouchableOpacity 
              key={`stock-${index}`}
              activeOpacity={0.7}
              onPress={() => {
                setShowFullChart(false);
                navigation.navigate('매매일지', { selectedStock: stock.label });
              }}
            >
              {/* 섹터 구분선 + 섹터명 */}
              {sectorChanged && (
                <View style={{ marginTop: index > 0 ? 6 : 0, marginBottom: 3, marginLeft: LABEL_W + 4 }}>
                  {index > 0 && (
                    <View style={{ height: 1, backgroundColor: 'rgba(212,175,55,0.25)', marginBottom: 4 }} />
                  )}
                  <Text style={{ color: '#D4AF37', fontSize: 9, fontWeight: 'bold' }}>
                    {stock.sector}
                  </Text>
                </View>
              )}

              {/* 행: 종목명 | 막대+평균선 | 금액 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: BAR_GAP, height: BAR_HEIGHT }}>
                {/* 종목명 */}
                <Text
                  numberOfLines={1}
                  style={{
                    width: LABEL_W,
                    color: isAboveAvg ? '#EF4444' : '#CBD5E1',
                    fontSize: 11,
                    fontWeight: isAboveAvg ? '700' : '400',
                    textAlign: 'right',
                    paddingRight: 8,
                  }}
                >
                  {stock.label}
                </Text>

                {/* 막대 영역 */}
                <View style={{ width: BAR_AREA, height: BAR_HEIGHT, position: 'relative' }}>
                  {/* 배경 */}
                  <View style={{
                    position: 'absolute', left: 0, top: 0,
                    width: BAR_AREA, height: BAR_HEIGHT,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 4,
                  }} />
                  {/* 막대 */}
                  <View style={{
                    position: 'absolute', left: 0, top: 0,
                    width: barWidth, height: BAR_HEIGHT,
                    backgroundColor: bgColor,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: borderColor,
                  }} />
                  {/* 평균 기준선 */}
                  <View style={{
                    position: 'absolute',
                    left: avgLineX,
                    top: 0, bottom: 0,
                    width: 1.5,
                    backgroundColor: COLOR_AVG_LINE,
                  }} />
                </View>

                {/* 금액 */}
                <Text style={{ width: VALUE_W, color: '#94A3B8', fontSize: 10, textAlign: 'right' }}>
                  {stock.value}M
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };




  // ─── 월별 현금 비중 트렌드 페이지 ───
  const renderCashTrendChart = () => {
    const list = activeSnapshots;
    if (list.length === 0) {
      return (
        <View style={[styles.chartPage, { paddingHorizontal: 24, flex: 1, justifyContent: 'center' }]}>
          <Text style={styles.cardTitle}>월별 현금 비중 트렌드</Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
            PC에서 [📸 이번 달 스냅샷 저장] 버튼으로 데이터를 추가해주세요.
          </Text>
        </View>
      );
    }

    const maxCash = Math.max(...list.map((s: any) => s.cash), 10);
    const maxRatio = Math.max(...list.map((s: any) => s.ratio), 100);
    const BAR_H = 18;
    const GAP = 6;
    const MONTH_W = 60;
    const RATIO_W = 44;
    const AMOUNT_W = 40;
    const BAR_W = CHART_PAGE_WIDTH - MONTH_W - RATIO_W - AMOUNT_W - 40;

    return (
      <View style={[styles.chartPage, { paddingHorizontal: 0, flex: 1 }]}>
        <Text style={[styles.cardTitle, { paddingHorizontal: 24, marginBottom: 12 }]}>월별 현금 비중 트렌드</Text>

        {/* 범례 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
            <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: 'bold' }}>현금 비중(%)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4AF37' }} />
            <Text style={{ color: '#D4AF37', fontSize: 11, fontWeight: 'bold' }}>보유 현금액(M)</Text>
          </View>
        </View>

        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}>
          {list.map((item: any, idx: number) => {
            const barWidth = Math.max((item.cash / maxCash) * BAR_W, 6);
            const ratioBarWidth = Math.max((item.ratio / maxRatio) * BAR_W, 4);
            return (
              <View key={`cash-${idx}`} style={{ marginBottom: GAP }}>
                {/* 상단: 월 + 현금비중 % */}
                <View style={{ flexDirection: 'row', alignItems: 'center', height: BAR_H }}>
                  <Text style={{ width: MONTH_W, color: '#E2E8F0', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
                    {item.month}
                  </Text>
                  <View style={{
                    width: RATIO_W, backgroundColor: 'rgba(34,197,94,0.15)',
                    borderColor: 'rgba(34,197,94,0.5)', borderWidth: 1, borderRadius: 4,
                    paddingVertical: 1, alignItems: 'center', marginRight: 6
                  }}>
                    <Text style={{ color: '#22C55E', fontSize: 9, fontWeight: '800' }}>{item.ratio}%</Text>
                  </View>
                  <View style={{ width: BAR_W, height: BAR_H, position: 'relative', justifyContent: 'center' }}>
                    {/* 비중 퍼센트 라인 (초록색 얇은 막대) */}
                    <View style={{
                      position: 'absolute', left: 0, height: 6,
                      width: ratioBarWidth, backgroundColor: 'rgba(34,197,94,0.3)',
                      borderRadius: 3
                    }} />
                  </View>
                  <Text style={{ width: AMOUNT_W, color: '#D4AF37', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>
                    {item.cash}M
                  </Text>
                </View>
                {/* 하단: 현금액 막대 (금색) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 4, marginTop: 2 }}>
                  <View style={{ width: MONTH_W + RATIO_W + 6 }} />
                  <View style={{ width: BAR_W, height: 4, position: 'relative' }}>
                    <View style={{
                      position: 'absolute', left: 0, top: 0, width: BAR_W, height: 4,
                      backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2
                    }} />
                    <View style={{
                      position: 'absolute', left: 0, top: 0, width: barWidth, height: 4,
                      backgroundColor: 'rgba(212,175,55,0.7)', borderRadius: 2
                    }} />
                  </View>
                  <View style={{ width: AMOUNT_W }} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ─── 종목별 투자 현황 페이지 ───
  const renderStockBarChart = () => {
    return (
      <View style={[styles.chartPage, { paddingHorizontal: 0, flex: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, paddingHorizontal: 24 }}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>종목별 투자 현황 ({stockCount}종목)</Text>
          <TouchableOpacity onPress={() => setShowFullChart(true)} style={styles.fullViewButton}>
            <Text style={styles.fullViewButtonText}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white" contentContainerStyle={{ paddingBottom: 40 }}>
            {renderCustomBarChart(stockItems, CHART_PAGE_WIDTH)}
          </ScrollView>
        </View>
      </View>
    );
  };

  // ─── 섹터별 파이 차트 페이지 ───
  const renderPieChart = () => (
    <View style={[styles.chartPage, { paddingHorizontal: 0, flex: 1 }]}>
      <Text style={[styles.cardTitle, { paddingHorizontal: 24 }]}>섹터별 투자 비중</Text>
      <View style={[styles.chartWrapper, { width: '100%', height: 280, paddingHorizontal: 0 }]}>
        <PieChart
          data={sectorData}
          donut
          radius={120}
          innerRadius={60}
          showText
          textColor="#FFFFFF"
          textSize={11}
          fontWeight="700"
          labelsPosition="outward"
          paddingHorizontal={40}
          paddingVertical={30}
          innerCircleColor="#1E293B"
          centerLabelComponent={pieCenterLabel}
        />
      </View>
      <View style={[styles.legendContainer, { paddingHorizontal: 24, marginTop: 0 }]}>
        {sectorData.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={styles.legendLabelGroup}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
            <View style={styles.legendRight}>
              <Text style={styles.legendPct}>{item.percentage}%</Text>
              <Text style={styles.legendValue}>{item.value}M</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        
        {portfolioMap ? (
          <View style={styles.glassCard}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              style={styles.pager}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {renderPieChart()}
              {renderStockBarChart()}
              {renderCashTrendChart()}
            </ScrollView>
            
            {/* 페이지 인디케이터 점(Dots) 3개 */}
            <View style={styles.indicatorContainer}>
              <View style={[styles.indicatorDot, currentPage === 0 && styles.indicatorDotActive]} />
              <View style={[styles.indicatorDot, currentPage === 1 && styles.indicatorDotActive]} />
              <View style={[styles.indicatorDot, currentPage === 2 && styles.indicatorDotActive]} />
            </View>
          </View>
        ) : (
          <View style={styles.glassCard}>
            <Text style={styles.infoText}>데이터가 아직 동기화되지 않았습니다.</Text>
          </View>
        )}
      </ScrollView>

      {/* 전체 화면 차트 모달 */}
      <Modal visible={showFullChart} animationType="slide" transparent={false}>
        <LinearGradient colors={['#0F172A', '#111827']} style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>전체 종목 투자 현황</Text>
            <TouchableOpacity onPress={() => setShowFullChart(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}>
            {renderCustomBarChart(stockItems, SCREEN_WIDTH)}
          </ScrollView>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, flexGrow: 1 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 25, letterSpacing: -0.5 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 28,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
  },
  pager: { width: CHART_PAGE_WIDTH, flex: 1 },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  indicatorDotActive: {
    width: 20,
    backgroundColor: '#00F2FE',
  },
  chartPage: { width: CHART_PAGE_WIDTH, paddingHorizontal: 24 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 25, textAlign: 'center' },
  chartWrapper: { alignItems: 'center', marginVertical: 10, height: 260 },
  legendContainer: { marginTop: 20, gap: 8 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  legendLabelGroup: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendLabel: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
  legendRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendPct: { color: '#00F2FE', fontSize: 15, fontWeight: '900', minWidth: 42, textAlign: 'right' },
  legendValue: { color: '#94A3B8', fontSize: 13, fontWeight: '600', minWidth: 46, textAlign: 'right' },
  infoText: { color: '#94A3B8', fontSize: 16, textAlign: 'center', marginVertical: 20 },
  fullViewButton: {
    marginLeft: 10,
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  fullViewButtonText: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold' },
  fullModalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  closeButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  closeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
});
