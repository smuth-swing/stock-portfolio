import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InvestigationScreen() {
  const { investigation, isLoading, refreshData } = useDataStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'strategy'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  // 데이터가 없고 로딩 중일 때만 스피너 표시
  if (isLoading && !investigation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>데이터 확인 중...</Text>
      </View>
    );
  }

  // 데이터 추출 로직
  const allData = investigation?.data || [];
  const allItems = allData.slice(2).map((r: any, idx: number) => ({ ...r, _realIndex: idx + 2 })).filter((r: any) => r['Unnamed: 1']);
  
  const items = allItems.filter((item: any) => {
    if (filter === 'strategy' && !item['Unnamed: 6']) return false;
    if (searchQuery.trim() !== '') {
      const stockName = item['Unnamed: 1'] || '';
      if (!stockName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  });

  const handleSaveStockName = async (realIndex: number, originalName: string) => {
    if (editName.trim() === '' || editName === originalName) {
      setEditingIndex(null);
      return;
    }

    // 서버 저장 로직
    setIsSaving(true);
    try {
      const filePath = investigation._filePath;
      const sheetName = investigation.current_sheet;
      const rowData = allData[realIndex];
      const columns = investigation.columns;
      
      const newRowData = { ...rowData, 'Unnamed: 1': editName.trim() };
      const values = columns.map((col: string) => newRowData[col] !== undefined && newRowData[col] !== null ? newRowData[col] : '');

      let base = '';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const pathname = window.location.pathname.replace(/\/[^/]*$/, '');
        base = window.location.origin + pathname;
      }

      if (base) {
        await fetch(`${base}/api/update-row`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: filePath, sheet: sheetName, rowIndex: realIndex, values })
        });
        // 갱신 (PWA 캐시 우회를 위해 잠시 대기 후 리프레시)
        setTimeout(() => {
          refreshData();
        }, 500);
      }
    } catch (e) {
      console.error('Failed to update stock name', e);
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>탐구생활</Text>
          <View style={styles.filterContainer}>
            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>전체</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'strategy' && styles.filterBtnActive]}
              onPress={() => setFilter('strategy')}
            >
              <Text style={[styles.filterBtnText, filter === 'strategy' && styles.filterBtnTextActive]}>전략보유</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 종목명 검색..."
            placeholderTextColor="#475569"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        {items.length > 0 ? (
          items.map((item: any, index: number) => {
            const id = item['Unnamed: 0'] || String(index);
            const isExpanded = expandedId === id;
            const realIdx = item._realIndex;
            
            return (
              <TouchableOpacity 
                key={id} 
                style={[styles.card, isExpanded && styles.cardExpanded]}
                onPress={() => {
                  if (editingIndex !== realIdx) toggleExpand(id);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    {editingIndex === realIdx ? (
                      <TextInput
                        style={styles.editInput}
                        value={editName}
                        onChangeText={setEditName}
                        onBlur={() => handleSaveStockName(realIdx, item['Unnamed: 1'])}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => { setEditingIndex(realIdx); setEditName(item['Unnamed: 1']); }}>
                        <Text style={styles.stockName}>
                          {item['Unnamed: 1']} ✏️
                        </Text>
                      </TouchableOpacity>
                    )}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  filterContainer: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, padding: 4 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  filterBtnActive: { backgroundColor: 'rgba(0, 242, 254, 0.2)' },
  filterBtnText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: '#00F2FE' },
  searchContainer: { marginBottom: 16 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: '#E2E8F0', fontSize: 14,
  },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  stockName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  editInput: { 
    fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', 
    borderBottomWidth: 1, borderBottomColor: '#00F2FE', 
    padding: 0, margin: 0, minWidth: 100 
  },
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
