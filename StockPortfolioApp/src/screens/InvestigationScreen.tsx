import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InvestigationScreen() {
  const { investigation, isLoading, refreshData, syncQueue, addToSyncQueue, markQueueAsSynced, meta } = useDataStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'priority'>('all');
  
  // 엑셀 컬럼명 변경 대응을 위한 헬퍼 함수
  const getStockName = (item: any) => item['종목명'] || item['Unnamed: 1'] || '';
  const getMomentum = (item: any) => item['모멘텀'] || item['모델명'] || item['Unnamed: 2'] || item['Unnamed: 1'] || '';
  const getReason = (item: any) => item['매수이유'] || item['Unnamed: 3'] || '';
  const getRisk = (item: any) => item['리스크'] || item['Unnamed: 4'] || '';
  const getCeo = (item: any) => item['대표/경영진'] || item['Unnamed: 5'] || '';
  const getStrategy = (item: any) => item['매매 전략'] || item['Unnamed: 6'] || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sync') === 'success') {
        markQueueAsSynced().then(() => {
          alert('✅ 성공적으로 PC 서버에 전송되었습니다.\n데이터는 잠시 후 화면에 반영됩니다.');
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      }
    }
  }, []);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const hasPendingServerUpdate = syncQueue && syncQueue.some(item => item.isPendingSync === false);
    
    if (hasPendingServerUpdate) {
      interval = setInterval(() => {
        refreshData();
      }, 10000); // 10초마다 자동 갱신 확인
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncQueue, refreshData]);

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
  const allItems = allData.filter((r: any) => getStockName(r));
  
  const items = allItems.filter((item: any) => {
    if (filter === 'priority' && !getMomentum(item)) return false;
    if (searchQuery.trim() !== '') {
      const stockName = getStockName(item);
      if (!stockName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  });

  const startEditing = (realIdx: number, item: any) => {
    setEditingIndex(realIdx);
    setEditForm({
      reason: getReason(item),
      risk: getRisk(item),
      momentum: getMomentum(item),
      strategy: getStrategy(item),
      ceo: getCeo(item)
    });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const saveEditing = async (realIndex: number, rowData: any) => {
    setIsSaving(true);
    try {
      // ★ _filePath가 null일 경우 file_name으로 fallback
      const filePath = investigation._filePath || investigation.file_name || '';
      const sheetName = investigation.current_sheet;
      const columns = investigation.columns;
      
      // 하위호환성(Unnamed) 및 신규 컬럼명 모두 지원
      const newRowData = { 
        ...rowData, 
        '매수이유': editForm.reason, 'Unnamed: 3': editForm.reason,
        '리스크': editForm.risk, 'Unnamed: 4': editForm.risk,
        '모멘텀': editForm.momentum, 'Unnamed: 2': editForm.momentum, 'Unnamed: 1': editForm.momentum,
        '매매 전략': editForm.strategy, 'Unnamed: 6': editForm.strategy,
        '대표/경영진': editForm.ceo, 'Unnamed: 5': editForm.ceo
      };
      const values = columns.map((col: string) => newRowData[col] !== undefined && newRowData[col] !== null ? newRowData[col] : '');

      const editTask = { 
        file: filePath, 
        sheet: sheetName, 
        rowIndex: realIndex,
        stockName: newRowData['종목명'] || newRowData['Unnamed: 1'] || '',
        values,
        timestamp: new Date().toISOString()
      };
      await addToSyncQueue(editTask);
      
      investigation.data[realIndex] = newRowData; 
    } catch (e) {
      console.error('Failed to queue content', e);
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
    }
  };

  const handleSync = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const pcIp = meta?.server_ip || '192.168.0.2';
      const targetUrl = `http://${pcIp}:5000/api/sync-receive`;
      
      if (confirm('PC 서버로 데이터를 전송합니다.\n보안 정책(Mixed Content) 우회를 위해 화면이 깜빡일 수 있습니다.')) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = targetUrl;
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(syncQueue);
        
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
    } else {
      alert('웹(PWA) 환경에서만 동기화가 지원됩니다.');
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
  
          <View style={styles.filterContainer}>
            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>전체</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'priority' && styles.filterBtnActive]}
              onPress={() => setFilter('priority')}
            >
              <Text style={[styles.filterBtnText, filter === 'priority' && styles.filterBtnTextActive]}>매매우선</Text>
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

        {syncQueue && syncQueue.length > 0 && (
          <View style={styles.syncBanner}>
            <Text style={styles.syncBannerText}>
              {syncQueue.some(item => item.isPendingSync !== false) 
                ? `🔄 PC 동기화 대기 중인 수정내역 (${syncQueue.length}건)`
                : `⏳ GitHub 서버 반영 대기 중... (${syncQueue.length}건)`}
            </Text>
            {syncQueue.some(item => item.isPendingSync !== false) && (
              <TouchableOpacity style={styles.syncBtn} onPress={handleSync}>
                <Text style={styles.syncBtnText}>PC로 전송하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
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
                    <Text style={styles.stockName}>
                      {getStockName(item)}
                    </Text>
                    {getMomentum(item) ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>매매우선</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
                </View>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {editingIndex === realIdx ? (
                      <View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>🎯 매수 이유</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: Math.max(80, editForm.height_reason || 80) }]} 
                            multiline scrollEnabled={false} value={editForm.reason} 
                            onChangeText={t => setEditForm({...editForm, reason: t})} 
                            onContentSizeChange={(e) => setEditForm({...editForm, height_reason: e.nativeEvent.contentSize.height})}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>⚠️ 리스크</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: Math.max(80, editForm.height_risk || 80) }]} 
                            multiline scrollEnabled={false} value={editForm.risk} 
                            onChangeText={t => setEditForm({...editForm, risk: t})} 
                            onContentSizeChange={(e) => setEditForm({...editForm, height_risk: e.nativeEvent.contentSize.height})}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: Math.max(80, editForm.height_momentum || 80) }]} 
                            multiline scrollEnabled={false} value={editForm.momentum} 
                            onChangeText={t => setEditForm({...editForm, momentum: t})} 
                            onContentSizeChange={(e) => setEditForm({...editForm, height_momentum: e.nativeEvent.contentSize.height})}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>📈 매매 전략</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: Math.max(80, editForm.height_strategy || 80) }]} 
                            multiline scrollEnabled={false} value={editForm.strategy} 
                            onChangeText={t => setEditForm({...editForm, strategy: t})} 
                            onContentSizeChange={(e) => setEditForm({...editForm, height_strategy: e.nativeEvent.contentSize.height})}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: Math.max(80, editForm.height_ceo || 80) }]} 
                            multiline scrollEnabled={false} value={editForm.ceo} 
                            onChangeText={t => setEditForm({...editForm, ceo: t})} 
                            onContentSizeChange={(e) => setEditForm({...editForm, height_ceo: e.nativeEvent.contentSize.height})}
                          />
                        </View>
                        
                        <View style={styles.actionButtons}>
                          <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={cancelEditing}>
                            <Text style={styles.cancelBtnText}>취소</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={() => saveEditing(realIdx, item)} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator size="small" color="#0F172A" /> : <Text style={styles.saveBtnText}>저장</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        {getReason(item) ? (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🎯 매수 이유</Text>
                            <Text style={styles.sectionText}>{getReason(item)}</Text>
                          </View>
                        ) : null}

                        {getRisk(item) ? (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⚠️ 리스크</Text>
                            <Text style={styles.sectionText}>{getRisk(item)}</Text>
                          </View>
                        ) : null}

                        {getMomentum(item) ? (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>
                            <Text style={styles.sectionText}>{getMomentum(item)}</Text>
                          </View>
                        ) : null}

                        {getStrategy(item) ? (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📈 매매 전략</Text>
                            <Text style={styles.sectionText}>{getStrategy(item)}</Text>
                          </View>
                        ) : null}

                        {getCeo(item) ? (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>
                            <Text style={styles.sectionText}>{getCeo(item)}</Text>
                          </View>
                        ) : null}
                        
                        <TouchableOpacity style={styles.editContentBtn} onPress={() => startEditing(realIdx, item)}>
                          <Text style={styles.editContentBtnText}>내용 수정 ✏️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
  multilineInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, padding: 12,
    color: '#FFFFFF', fontSize: 15, lineHeight: 22,
    textAlignVertical: 'top',
  },
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  cancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#475569' },
  saveBtn: { backgroundColor: '#00F2FE' },
  cancelBtnText: { color: '#94A3B8', fontWeight: 'bold' },
  saveBtnText: { color: '#0F172A', fontWeight: 'bold' },
  editContentBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.3)'
  },
  editContentBtnText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  glassCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  infoText: { color: '#64748B', fontSize: 16, textAlign: 'center', marginVertical: 20 },
  syncBanner: { backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: '#EAB308', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncBannerText: { color: '#FDE047', fontSize: 14, fontWeight: 'bold', flex: 1 },
  syncBtn: { backgroundColor: '#EAB308', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  syncBtnText: { color: '#422006', fontSize: 13, fontWeight: 'bold' },
});
