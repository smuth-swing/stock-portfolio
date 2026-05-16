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

    // 프리미엄 네온/파스텔 그라데이션 컬러셋
    const colors = ['#00F2FE', '#4FACFE', '#A18CD1', '#FBC2EB', '#F6D365', '#FDA085'];
    let idx = 0;
    
    return Object.keys(sectors).map(key => {
      const value = sectors[key];
      const color = colors[idx % colors.length];
      idx++;
      return { value, text: `${value}M`, color, label: key };
    }).sort((a, b) => b.value - a.value);
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
                  radius={110}
                  innerRadius={70}
                  showText
                  textColor="white"
                  textSize={12}
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
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.label} ({item.value}M)</Text>
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
  legendContainer: { marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  legendItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 14 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', marginVertical: 20 },
});
