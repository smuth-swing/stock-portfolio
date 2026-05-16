import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InvestigationScreen() {
  const { investigation, isLoading } = useDataStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
      </View>
    );
  }

  // 첫 두 줄은 헤더/공백이므로 제외하고 실제 데이터만 필터링
  const items = investigation?.data?.slice(2).filter((r: any) => r['Unnamed: 1']) || [];

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>탐구생활</Text>
        
        {items.length > 0 ? (
          items.map((item: any, index: number) => {
            const id = item['Unnamed: 0'] || String(index);
            const isExpanded = expandedId === id;
            
            return (
              <TouchableOpacity 
                key={id} 
                style={[styles.card, isExpanded && styles.cardExpanded]}
                onPress={() => toggleExpand(id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <Text style={styles.stockName}>{item['Unnamed: 1']}</Text>
                    {item['Unnamed: 6'] ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>전략 보유</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
                </View>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {item['Unnamed: 3'] ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🎯 매수 이유</Text>
                        <Text style={styles.sectionText}>{item['Unnamed: 3']}</Text>
                      </View>
                    ) : null}

                    {item['Unnamed: 4'] ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⚠️ 리스크</Text>
                        <Text style={styles.sectionText}>{item['Unnamed: 4']}</Text>
                      </View>
                    ) : null}

                    {item['Unnamed: 2'] ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>
                        <Text style={styles.sectionText}>{item['Unnamed: 2']}</Text>
                      </View>
                    ) : null}

                    {item['Unnamed: 6'] ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📈 매매 전략</Text>
                        <Text style={styles.sectionText}>{item['Unnamed: 6']}</Text>
                      </View>
                    ) : null}

                    {item['Unnamed: 5'] ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>
                        <Text style={styles.sectionText}>{item['Unnamed: 5']}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 24, letterSpacing: 0.5 },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(0, 242, 254, 0.3)',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  badge: { backgroundColor: 'rgba(0, 242, 254, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#00F2FE', fontSize: 11, fontWeight: 'bold' },
  expandIcon: { color: '#00F2FE', fontSize: 28, fontWeight: '300', marginTop: -4 },
  expandedContent: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#94A3B8', marginBottom: 8 },
  sectionText: { fontSize: 15, color: '#E2E8F0', lineHeight: 24 },
  glassCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', marginVertical: 20 },
});
