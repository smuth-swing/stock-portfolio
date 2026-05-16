import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-gifted-charts';

export default function PerformanceScreen() {
  const { performance, isLoading } = useDataStore();

  const chartData = useMemo(() => {
    if (!performance || !performance.data) return { barData: [], lineData: [], totalProfit: 0 };

    let cumulative = 0;
    const barData: any[] = [];
    const lineData: any[] = [];
    
    // Filter valid years
    const rows = performance.data.filter((r: any) => {
      const y = r['연도'] || '';
      return y && !y.includes('총합') && !y.includes('평균') && !y.includes('최근');
    });

    rows.forEach((row: any) => {
      const year = String(row['연도']).replace('년', '');
      const profit = parseFloat(row['수익']) || 0;
      const profitM = profit / 1000000;
      
      cumulative += profitM;

      barData.push({
        value: profitM,
        label: year,
        frontColor: profit >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
        topLabelComponent: () => (
          <Text style={{color: profit >= 0 ? '#10B981' : '#EF4444', fontSize: 10, marginBottom: 2, fontWeight: 'bold'}}>
            {Math.abs(profitM) >= 1 ? profitM.toFixed(0) : ''}
          </Text>
        )
      });

      lineData.push({
        value: cumulative,
        dataPointText: cumulative.toFixed(0),
      });
    });

    return { barData, lineData, totalProfit: cumulative };
  }, [performance]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>실적 분석</Text>
        
        {performance ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>총 누적 수익 (M)</Text>
              <Text style={[styles.summaryValue, { color: chartData.totalProfit >= 0 ? '#10B981' : '#EF4444' }]}>
                {chartData.totalProfit > 0 ? '+' : ''}{chartData.totalProfit.toFixed(1)}M
              </Text>
            </View>

            <View style={styles.glassCard}>
              <Text style={styles.cardTitle}>연도별 수익 및 누적 추이</Text>
              
              {chartData.barData.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartWrapper}>
                  <BarChart
                    data={chartData.barData}
                    height={240}
                    barWidth={24}
                    spacing={36}
                    initialSpacing={16}
                    noOfSections={5}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor="rgba(255,255,255,0.2)"
                    yAxisTextStyle={{ color: '#94A3B8', fontSize: 11 }}
                    rulesColor="rgba(255,255,255,0.05)"
                    
                    // Line overlay
                    showLine
                    lineData={chartData.lineData}
                    lineConfig={{
                      color: '#F6D365',
                      thickness: 3,
                      dataPointsColor: '#F6D365',
                      dataPointsRadius: 4,
                      textColor: '#F6D365',
                      textFontSize: 12,
                      textShiftY: -12,
                    }}
                  />
                </ScrollView>
              ) : (
                <Text style={styles.infoText}>표시할 데이터가 없습니다.</Text>
              )}

              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>연도별 수익 (Bar)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F6D365', borderRadius: 0, height: 3 }]} />
                  <Text style={styles.legendText}>누적 수익 (Line)</Text>
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
  scrollContent: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 20, letterSpacing: 0.5 },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryLabel: { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  summaryValue: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 30 },
  chartWrapper: { marginVertical: 10 },
  legendContainer: { marginTop: 30, flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', marginVertical: 20 },
});
