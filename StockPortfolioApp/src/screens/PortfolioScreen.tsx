import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { PieChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';

export default function PortfolioScreen() {
  const { portfolioMap, isLoading } = useDataStore();

  const chartData = useMemo(() => {
    if (!portfolioMap || !portfolioMap.data) return [];
    
    // Grouping by sector (Unnamed: 2)
    const sectors: { [key: string]: number } = {};
    const dataRows = portfolioMap.data.slice(1); // skip header
    const amountCols = portfolioMap.columns.filter((c: string) => c.startsWith('Unnamed:') && parseInt(c.split(':')[1]) >= 4);

    dataRows.forEach((row: any) => {
      const sector = row['Unnamed: 2'] || '기타';
      let amount = 0;
      amountCols.forEach((col: string) => {
        if (parseFloat(row[col]) === 1) amount++;
      });
      if (amount > 0) {
        sectors[sector] = (sectors[sector] || 0) + amount;
      }
    });

    const totalInvestment = Object.values(sectors).reduce((acc, value) => acc + value, 0);
    const sectorColorOverrides: { [key: string]: string } = {
      '바이오': '#F43F5E',
    };
    const colors = ['#22C55E', '#F97316', '#38BDF8', '#EAB308', '#8B5CF6', '#14B8A6', '#F59E0B', '#64748B'];
    let idx = 0;
    let cumulativeValue = 0;
    
    return Object.keys(sectors).map(key => ({ key, value: sectors[key] }))
      .sort((a, b) => b.value - a.value)
      .map(({ key, value }) => {
      const percentage = totalInvestment ? Math.round((value / totalInvestment) * 100) : 0;
      const color = sectorColorOverrides[key] || colors[idx % colors.length];
      const isSmallSlice = percentage <= 5;
      const midpoint = totalInvestment ? (cumulativeValue + value / 2) / totalInvestment : 0;
      const isLeftSide = Math.sin(2 * Math.PI * midpoint) < 0;
      const radialShiftX = isSmallSlice ? Math.sin(2 * Math.PI * midpoint) * 6 : 0;
      const radialShiftY = isSmallSlice ? -Math.cos(2 * Math.PI * midpoint) * 6 : 0;
      cumulativeValue += value;
      idx++;
      return {
        value,
        percentage,
        text: `${key}(${percentage}%)`,
        color,
        label: key,
        labelPosition: 'outward' as const,
        shiftTextX: isSmallSlice
          ? (isLeftSide ? -18 : 12) + radialShiftX
          : isLeftSide ? -22 : 8,
        shiftTextY: isSmallSlice ? (idx % 2 === 0 ? -6 : 6) + radialShiftY : 0,
      };
    });
  }, [portfolioMap]);

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
        <Text style={styles.title}>포트폴리오 분석</Text>
        
        {portfolioMap ? (
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>섹터별 투자 비중</Text>
            
            {chartData.length > 0 ? (
              <View style={styles.chartWrapper}>
                <PieChart
                  data={chartData}
                  donut
                  radius={96}
                  innerRadius={60}
                  paddingHorizontal={68}
                  showText
                  labelsPosition="outward"
                  textColor="#FFFFFF"
                  textSize={9}
                  fontWeight="700"
                  innerCircleColor="#1E293B"
                  centerLabelComponent={() => {
                    return (
                      <View style={{justifyContent: 'center', alignItems: 'center'}}>
                        <Text style={{fontSize: 26, color: 'white', fontWeight: 'bold'}}>
                          {chartData.reduce((acc, curr) => acc + curr.value, 0)}M
                        </Text>
                        <Text style={{fontSize: 12, color: '#94A3B8'}}>Total Investment</Text>
                      </View>
                    );
                  }}
                />
              </View>
            ) : (
              <Text style={styles.infoText}>표시할 데이터가 없습니다.</Text>
            )}

            <View style={styles.legendContainer}>
              {chartData.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={styles.legendLabelGroup}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={2}>{item.label}</Text>
                  </View>
                  <Text style={styles.legendValue}>{item.value}M/{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
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
  scrollContent: { padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 24, letterSpacing: 0.5 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#E2E8F0', marginBottom: 20 },
  chartWrapper: { alignItems: 'center', marginVertical: 10 },
  legendContainer: { marginTop: 28, gap: 10 },
  legendItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  legendLabelGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 9 },
  legendLabel: { flex: 1, color: '#E2E8F0', fontSize: 14, fontWeight: '600', lineHeight: 18 },
  legendValue: { minWidth: 82, color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', marginVertical: 20 },
});
