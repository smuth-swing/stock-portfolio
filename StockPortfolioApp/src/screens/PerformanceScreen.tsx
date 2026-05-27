import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';

export default function PerformanceScreen() {
  const { performance, isLoading } = useDataStore();

  const chartData = useMemo(() => {
    if (!performance || !performance.data) return { rows: [], totalProfit: 0 };

    // Filter valid years
    const rawRows = performance.data.filter((r: any) => {
      const y = r['연도'] || '';
      return y && !y.includes('총합') && !y.includes('평균') && !y.includes('최근');
    });

    // 세로형은 과거에서 최근순으로 (위에서 아래로)
    rawRows.sort((a: any, b: any) => parseInt(a['연도']) - parseInt(b['연도']));

    let cumulativeSum = 0;
    const parsedRows: any[] = [];

    rawRows.forEach((row: any) => {
      const year = String(row['연도']).replace('년', '').trim();
      const profit = parseFloat(row['수익']) || 0;
      const yieldVal = (parseFloat(row['수익율']) || 0) * 100;
      const profitM = profit / 1000000;
      
      cumulativeSum += profitM;

      parsedRows.push({
        year,
        profitM,
        yieldVal,
        cumulativeSum
      });
    });

    return { rows: parsedRows, totalProfit: cumulativeSum };
  }, [performance]);

  // 데이터가 없고 로딩 중일 때만 스피너 표시
  if (isLoading && !performance) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>데이터 확인 중...</Text>
      </View>
    );
  }

  const renderCustomPerformanceChart = () => {
    if (chartData.rows.length === 0) {
      return <Text style={styles.infoText}>표시할 데이터가 없습니다.</Text>;
    }

    const ROW_H = 40;
    const LABEL_W = 40;  // 년도 영역
    const CHART_W = Dimensions.get('window').width - 40 - LABEL_W; // 40은 좌우 padding
    
    // 연도수익과 누적수익의 전체 최소/최대값을 구하여 스케일 계산
    const allValues = chartData.rows.flatMap((r: any) => [r.profitM, r.cumulativeSum]);
    const maxVal = Math.max(...allValues, 1);
    const minVal = Math.min(...allValues, 0);
    const range = maxVal - minVal;

    // 양옆 텍스트가 잘리지 않도록 내부 여백(Padding) 적용
    const PADDING_X = 35; 
    const USABLE_W = CHART_W - PADDING_X * 2;
    
    // 0 (기준선)의 X 좌표를 동적으로 계산 (모두 양수면 왼쪽 끝에 붙음)
    const CENTER_X = PADDING_X + USABLE_W * ((0 - minVal) / range);
    
    const getX = (val: number) => CENTER_X + (val / range) * USABLE_W;

    // 누적 수익 라인 그래프용 좌표 계산
    const points = chartData.rows.map((r: any, i: number) => ({
      x: getX(r.cumulativeSum),
      y: i * ROW_H + (ROW_H / 2),
      val: r.cumulativeSum
    }));
    const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <View style={{ width: '100%', paddingVertical: 10 }}>
        {/* 테이블 헤더 */}
        <View style={styles.chartHeaderRow}>
          <Text style={[styles.chartHeaderText, { width: LABEL_W, textAlign: 'center' }]}>연도</Text>
          <Text style={[styles.chartHeaderText, { width: CHART_W, textAlign: 'center' }]}>수익 & 누적 (M)</Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {/* Y축 연도 라벨 */}
          <View style={{ width: LABEL_W }}>
            {chartData.rows.map((item: any, index: number) => (
              <View key={`year-${index}`} style={{ height: ROW_H, justifyContent: 'center' }}>
                <Text style={styles.rowYearText}>{item.year}</Text>
              </View>
            ))}
          </View>

          {/* 차트 영역 (막대 + 선) */}
          <View style={{ width: CHART_W, height: chartData.rows.length * ROW_H, position: 'relative' }}>
            {/* 중앙 0 기준선 */}
            <View style={[styles.centerAxis, { left: CENTER_X }]} />
            
            {/* 막대 차트 (연도수익) */}
            {chartData.rows.map((item: any, index: number) => {
              const x = getX(item.profitM);
              const isPositive = item.profitM >= 0;
              const barW = Math.abs(x - CENTER_X);
              
              return (
                <View key={`bar-${index}`} style={[
                  styles.bar,
                  { 
                    top: index * ROW_H + (ROW_H / 2) - 8,
                    backgroundColor: isPositive ? '#10B981' : '#EF4444',
                    width: barW,
                  },
                  isPositive ? { left: CENTER_X } : { right: CHART_W - CENTER_X }
                ]}>
                  {/* 막대 텍스트 (바깥쪽 배치) */}
                  <Text style={[
                    styles.barValueText,
                    isPositive 
                      ? { left: barW + 6, color: '#10B981' }
                      : { right: barW + 6, color: '#EF4444' }
                  ]}>
                    {item.profitM > 0 ? '+' : ''}{item.profitM.toFixed(1)} <Text style={{ fontSize: 9 }}>({item.yieldVal > 0 ? '+' : ''}{item.yieldVal.toFixed(1)}%)</Text>
                  </Text>
                </View>
              );
            })}

            {/* 선 차트 (누적수익) - SVG 오버레이 */}
            <Svg style={{ position: 'absolute', left: 0, top: 0, width: CHART_W, height: chartData.rows.length * ROW_H }}>
              <Polyline points={polylineStr} fill="none" stroke="#F6D365" strokeWidth="2.5" />
              {points.map((p, i) => (
                <React.Fragment key={`cum-${i}`}>
                  <Circle cx={p.x} cy={p.y} r="4" fill="#F6D365" />
                  <SvgText
                    x={p.x}
                    y={p.y - 10}
                    fill="#F6D365"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {p.val.toFixed(1)}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>실적 분석</Text>
        
        {performance ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>총 누적 수익 (백만 원)</Text>
              <Text style={[styles.summaryValue, { color: chartData.totalProfit >= 0 ? '#10B981' : '#EF4444' }]}>
                {chartData.totalProfit > 0 ? '+' : ''}{chartData.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}M
              </Text>
            </View>

            <View style={styles.glassCard}>
              <Text style={styles.cardTitle}>연도별 실적 및 누적 추이</Text>
              
              {renderCustomPerformanceChart()}

              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>수익 (+)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>손실 (-)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F6D365' }]} />
                  <Text style={styles.legendText}>누적수익</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.glassCard}>
            <Text style={styles.infoText}>데이터가 아직 동기화되지 않았습니다.</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 25, letterSpacing: -0.5 },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 28,
    padding: 28,
    marginBottom: 25,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  summaryLabel: { color: '#F1F5F9', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  summaryValue: { fontSize: 46, fontWeight: '900', letterSpacing: -1.5 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 28,
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 20, textAlign: 'center' },
  
  // Custom Horizontal Chart Styles
  chartHeaderRow: {
    flexDirection: 'row', 
    marginBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.1)', 
    paddingBottom: 8
  },
  chartHeaderText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, height: 26 },
  rowYearText: { width: 40, color: '#CBD5E1', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  barArea: { height: '100%', position: 'relative', justifyContent: 'center' },
  centerAxis: { position: 'absolute', top: -4, bottom: -4, width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  bar: { position: 'absolute', height: 16, borderRadius: 3 },
  barValueText: { position: 'absolute', fontSize: 10, fontWeight: 'bold' },
  rowCumulativeText: { fontSize: 12, fontWeight: 'bold', textAlign: 'right' },

  legendContainer: { 
    marginTop: 30, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 20,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 3, marginRight: 8 },
  legendText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  infoText: { color: '#94A3B8', fontSize: 16, textAlign: 'center', marginVertical: 30 },
});
