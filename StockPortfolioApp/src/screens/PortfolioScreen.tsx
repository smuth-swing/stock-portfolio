import React, { useMemo, useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDataStore } from '../store/useDataStore';
import { getPortfolioMapInfo } from '../utils/excelFields';
import { PieChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Line as SvgLine, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

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
  const { portfolioMap, cashSnapshots, cashAccounts, isLoading } = useDataStore();
  const [currentPage, setCurrentPage] = useState(0);
  const [showFullChart, setShowFullChart] = useState(false);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();

  // PC 버전과 동일한 데이터 파싱 로직
  const { sectorData, stockItems, totalInvestment, avgValue, stockCount } = useMemo(() => {
    if (!portfolioMap || !portfolioMap.data) {
      return { sectorData: [], stockItems: [], totalInvestment: 0, avgValue: 0, stockCount: 0 };
    }
    
    const sectors: { [key: string]: number } = {};
    const stocks: { label: string, value: number, sector: string, strategy: string }[] = [];
    const { stockCol, strategyCol, sectorCol, amountCols, dataRows } = getPortfolioMapInfo(portfolioMap);
    const colors = ['#22C55E', '#F97316', '#38BDF8', '#EAB308', '#8B5CF6', '#14B8A6', '#F59E0B', '#64748B'];

    dataRows.forEach((row: any) => {
      const stockName = (stockCol ? String(row[stockCol] || '').trim() : '') || '알수없음';
      const sector = (sectorCol ? String(row[sectorCol] || '').trim() : '') || '기타';
      const strategy = strategyCol ? String(row[strategyCol] || '').trim() : '';
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

  // 동기화된 현금 계좌 합계 (실시간 현금액 M)
  const liveCash = useMemo(() => {
    if (!cashAccounts || !Array.isArray(cashAccounts)) return null;
    return cashAccounts.reduce((sum: any, acc: any) => sum + (parseFloat(acc.amount) || 0), 0);
  }, [cashAccounts]);

  // 스토어의 cashSnapshots 사용 (실시간 현금 계좌 동기화 적용)
  const activeSnapshots = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let list = cashSnapshots && cashSnapshots.length > 0 ? [...cashSnapshots] : [];
    
    // 만약 동기화된 liveCash가 있다면 이번 달 스냅샷 데이터 실시간 보완/갱신
    if (liveCash !== null) {
      const existingIdx = list.findIndex((item: any) => item.month === currentMonthKey);
      const investment = totalInvestment > 0 ? totalInvestment : (existingIdx !== -1 ? (Number(list[existingIdx].investment) || 0) : 0);
      const totalAsset = investment + liveCash;
      const ratio = totalAsset > 0 ? parseFloat(((liveCash / totalAsset) * 100).toFixed(1)) : 0;
      
      const liveSnapshot = {
        month: currentMonthKey,
        investment,
        cash: liveCash,
        totalAsset,
        ratio,
      };

      if (existingIdx !== -1) {
        list[existingIdx] = liveSnapshot;
      } else {
        list.push(liveSnapshot);
      }
    }

    if (list.length === 0 && totalInvestment > 0) {
      return [{ month: currentMonthKey, investment: totalInvestment, cash: 0, totalAsset: totalInvestment, ratio: 0 }];
    }

    return list.sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));
  }, [cashSnapshots, liveCash, totalInvestment]);

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




  // ─── 월별 현금 비중 트렌드 페이지 (선 그래프 Line Chart) ───
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

    const maxCash = Math.max(...list.map((s: any) => Number(s.cash) || 0), 10);
    const maxRatio = Math.max(...list.map((s: any) => Number(s.ratio) || 0), 100);

    // SVG 차트 좌표 및 레이아웃 스펙
    const ITEM_WIDTH = Math.max(75, (CHART_PAGE_WIDTH - 24) / Math.max(list.length, 1));
    const SVG_WIDTH = Math.max(CHART_PAGE_WIDTH - 24, list.length * ITEM_WIDTH);
    const SVG_HEIGHT = 210;
    const TOP_PADDING = 32;
    const BOTTOM_PADDING = 35;
    const PLOT_HEIGHT = SVG_HEIGHT - TOP_PADDING - BOTTOM_PADDING;

    // 각 월별 점(X, Y) 좌표 계산
    const points = list.map((item: any, idx: number) => {
      const ratio = Number(item.ratio) || 0;
      const cash = Number(item.cash) || 0;
      const x = idx * ITEM_WIDTH + ITEM_WIDTH / 2;
      // Y 좌표: ratio 0% -> PLOT_HEIGHT + TOP_PADDING, ratio maxRatio% -> TOP_PADDING
      const ratioNorm = maxRatio > 0 ? ratio / maxRatio : 0;
      const y = TOP_PADDING + PLOT_HEIGHT * (1 - ratioNorm * 0.85);
      // 현금액(M) 막대 높이 및 Y
      const cashNorm = maxCash > 0 ? cash / maxCash : 0;
      const barHeight = Math.max(4, PLOT_HEIGHT * cashNorm * 0.45);
      const barY = TOP_PADDING + PLOT_HEIGHT - barHeight;

      return { x, y, barY, barHeight, ratio, cash, month: item.month };
    });

    // SVG Line Path 명령어 생성 (M x0,y0 L x1,y1 L x2,y2 ...)
    const lineD = points.reduce((acc: string, pt: any, idx: number) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // SVG Area Fill Path (선 아래 그라데이션 영역)
    const firstX = points[0]?.x || 0;
    const lastX = points[points.length - 1]?.x || 0;
    const bottomY = TOP_PADDING + PLOT_HEIGHT;
    const areaD = `${lineD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return (
      <View style={[styles.chartPage, { paddingHorizontal: 0, flex: 1 }]}>
        <Text style={[styles.cardTitle, { paddingHorizontal: 24, marginBottom: 10 }]}>월별 현금 비중 트렌드</Text>

        {/* 범례 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 14, height: 3, backgroundColor: '#22C55E', borderRadius: 2 }} />
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginLeft: -9 }} />
            <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: 'bold' }}>현금 비중 (%)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(212,175,55,0.7)', borderWidth: 1, borderColor: '#D4AF37' }} />
            <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: 'bold' }}>보유 현금액 (M)</Text>
          </View>
        </View>

        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          {/* 가로 스크롤 가능한 SVG 선 그래프 차트 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            <View style={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
              <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
                <Defs>
                  <SvgLinearGradient id="cashRatioGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#22C55E" stopOpacity="0.35" />
                    <Stop offset="1" stopColor="#22C55E" stopOpacity="0.0" />
                  </SvgLinearGradient>
                </Defs>

                {/* 그리드 가로선 3개 */}
                {[0, 0.5, 1].map((ratioStep, i) => {
                  const gridY = TOP_PADDING + PLOT_HEIGHT * ratioStep;
                  return (
                    <SvgLine
                      key={`grid-${i}`}
                      x1="0"
                      y1={gridY}
                      x2={SVG_WIDTH}
                      y2={gridY}
                      stroke="rgba(255, 255, 255, 0.07)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* 1. 하단 보유 현금액(M) 막대 그래프 */}
                {points.map((pt: any, idx: number) => (
                  <React.Fragment key={`bar-${idx}`}>
                    <Rect
                      x={pt.x - 14}
                      y={pt.barY}
                      width={28}
                      height={pt.barHeight}
                      fill="rgba(212, 175, 55, 0.45)"
                      stroke="#D4AF37"
                      strokeWidth="1"
                      rx="4"
                    />
                    {/* 현금액 M 수치 라벨 */}
                    <SvgText
                      x={pt.x}
                      y={pt.barY - 4}
                      fill="#D4AF37"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pt.cash}M
                    </SvgText>
                  </React.Fragment>
                ))}

                {/* 2. 현금 비중(%) 영역 채우기 (Area Gradient) */}
                <Path d={areaD} fill="url(#cashRatioGrad)" />

                {/* 3. 현금 비중(%) 선 그래프 (Green Line) */}
                <Path d={lineD} fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* 4. 현금 비중(%) 데이터 포인트(Circle 노드) & 비중 % 라벨 */}
                {points.map((pt: any, idx: number) => (
                  <React.Fragment key={`pt-${idx}`}>
                    {/* 외부 링 & 내부 노드 */}
                    <Circle cx={pt.x} cy={pt.y} r="6" fill="#0F172A" stroke="#22C55E" strokeWidth="2.5" />
                    <Circle cx={pt.x} cy={pt.y} r="2.5" fill="#22C55E" />

                    {/* 비중 % 수치 뱃지 텍스트 */}
                    <SvgText
                      x={pt.x}
                      y={pt.y - 10}
                      fill="#22C55E"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pt.ratio}%
                    </SvgText>

                    {/* X축 월 라벨 */}
                    <SvgText
                      x={pt.x}
                      y={SVG_HEIGHT - 10}
                      fill="#94A3B8"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pt.month}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            </View>
          </ScrollView>

          {/* 하단 월별 현금 스냅샷 수치 요약 테이블 카드 */}
          <View style={{ paddingHorizontal: 16, marginTop: 15 }}>
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 6 }}>
                <Text style={{ flex: 1, color: '#94A3B8', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>월</Text>
                <Text style={{ flex: 1, color: '#22C55E', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>현금 비중 (%)</Text>
                <Text style={{ flex: 1, color: '#D4AF37', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>보유 현금 (M)</Text>
                <Text style={{ flex: 1, color: '#E2E8F0', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>총 자산 (M)</Text>
              </View>
              {list.map((item: any, idx: number) => (
                <View key={`row-${idx}`} style={{ flexDirection: 'row', paddingVertical: 5, alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: '#E2E8F0', fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{item.month}</Text>
                  <Text style={{ flex: 1, color: '#22C55E', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{item.ratio}%</Text>
                  <Text style={{ flex: 1, color: '#D4AF37', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{item.cash}M</Text>
                  <Text style={{ flex: 1, color: '#94A3B8', fontSize: 11, textAlign: 'center' }}>{item.totalAsset || (item.investment + item.cash)}M</Text>
                </View>
              ))}
            </View>
          </View>
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
