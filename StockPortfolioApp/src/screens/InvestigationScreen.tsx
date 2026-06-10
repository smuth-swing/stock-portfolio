import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────
// 헬퍼 함수: 컴포넌트 외부에 정의하여 매 렌더링 시 재생성 방지
// ─────────────────────────────────────────────
const getStockName = (item: any) => item['종목명'] || item['Unnamed: 1'] || '';
const getMomentum  = (item: any) => item['모멘텀'] || item['모델명'] || item['Unnamed: 2'] || item['Unnamed: 1'] || '';
const getReason    = (item: any) => item['매수이유'] || item['Unnamed: 3'] || '';
const getRisk      = (item: any) => item['리스크'] || item['Unnamed: 4'] || '';
const getCeo       = (item: any) => item['대표/경영진'] || item['Unnamed: 5'] || '';
const getStrategy  = (item: any) => item['매매 전략'] || item['Unnamed: 6'] || '';

export default function InvestigationScreen() {
  const { investigation, isLoading, refreshData, syncQueue, addToSyncQueue, markQueueAsSynced, meta } = useDataStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'priority'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [inputHeights, setInputHeights] = useState<Record<string, number>>({
    reason: 80,
    risk: 80,
    momentum: 80,
    strategy: 80,
    ceo: 80,
  });

  // 웹 전용: 텍스트 줄 수 기반으로 높이 계산 (onContentSizeChange 무한 루프 방지)
  const LINE_HEIGHT = 22;
  const INPUT_PADDING = 24; // 상하 패딩 합계
  const MIN_HEIGHT = 80;

  const computeWebHeight = useCallback((text: string | undefined): number => {
    if (!text) return MIN_HEIGHT;
    const lineCount = text.split('\n').length;
    return Math.max(MIN_HEIGHT, lineCount * LINE_HEIGHT + INPUT_PADDING);
  }, []);

  // 네이티브 전용: onContentSizeChange 이벤트 기반 높이 조절
  const handleContentSizeChange = useCallback((field: string, event: any) => {
    if (Platform.OS === 'web') return; // 웹은 computeWebHeight 사용
    if (!event?.nativeEvent?.contentSize) return;
    const { height } = event.nativeEvent.contentSize;
    if (typeof height !== 'number') return;
    
    setInputHeights(prev => {
      const newHeight = Math.max(MIN_HEIGHT, height + 20);
      if (Math.abs((prev[field] || MIN_HEIGHT) - newHeight) < 5) return prev;
      return {
        ...prev,
        [field]: newHeight,
      };
    });
  }, []);

  // 웹에서 사용할 필드별 높이 계산 (editForm이 변경될 때만 재계산)
  const webHeights = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    return {
      reason: computeWebHeight(editForm.reason),
      risk: computeWebHeight(editForm.risk),
      momentum: computeWebHeight(editForm.momentum),
      strategy: computeWebHeight(editForm.strategy),
      ceo: computeWebHeight(editForm.ceo),
    };
  }, [editForm.reason, editForm.risk, editForm.momentum, editForm.strategy, editForm.ceo, computeWebHeight]);

  // 플랫폼에 따라 적절한 높이를 반환하는 헬퍼
  const getFieldHeight = useCallback((field: string): number => {
    if (Platform.OS === 'web' && webHeights) {
      return (webHeights as any)[field] || MIN_HEIGHT;
    }
    return inputHeights[field] || MIN_HEIGHT;
  }, [webHeights, inputHeights]);

  // refreshData를 ref로 보관: useEffect 의존성 배열에서 제외하여 무한 리렌더 방지
  const refreshDataRef = useRef(refreshData);
  useEffect(() => { refreshDataRef.current = refreshData; }, [refreshData]);

  // syncQueue 파생 상태를 메모화: 렌더링마다 some() 반복 연산 방지
  const hasPendingSync = useMemo(
    () => !!syncQueue && syncQueue.some(item => item.isPendingSync !== false),
    [syncQueue]
  );
  const hasPendingServerUpdate = useMemo(
    () => !!syncQueue && syncQueue.some(item => item.isPendingSync === false),
    [syncQueue]
  );

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

  const toggleExpand = useCallback((id: string) => {
    // 웹 환경에서는 LayoutAnimation 미지원 → 네이티브만 사용
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // 10초 자동 갱신: hasPendingServerUpdate가 true일 때만 활성화
  // refreshData를 ref로 참조하여 의존성 배열에서 제외 → interval 재생성 방지
  useEffect(() => {
    if (!hasPendingServerUpdate) return;

    const interval = setInterval(() => {
      refreshDataRef.current();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasPendingServerUpdate]);

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
      
      // ★ Zustand 상태를 불변 방식으로 업데이트 (직접 뮤테이션 금지)
      const updatedData = [...investigation.data];
      updatedData[realIndex] = newRowData;
      useDataStore.setState({ investigation: { ...investigation, data: updatedData } });
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
              {hasPendingSync
                ? `🔄 PC 동기화 대기 중인 수정내역 (${syncQueue.length}건)`
                : `⏳ GitHub 서버 반영 대기 중... (${syncQueue.length}건)`}
            </Text>
            {hasPendingSync && (
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
                            style={[styles.multilineInput, { height: getFieldHeight('reason') }]} 
                            multiline scrollEnabled={true} value={editForm.reason} 
                            onChangeText={t => setEditForm(prev => ({...prev, reason: t}))} 
                            onContentSizeChange={e => handleContentSizeChange('reason', e)}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>⚠️ 리스크</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: getFieldHeight('risk') }]} 
                            multiline scrollEnabled={true} value={editForm.risk} 
                            onChangeText={t => setEditForm(prev => ({...prev, risk: t}))} 
                            onContentSizeChange={e => handleContentSizeChange('risk', e)}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: getFieldHeight('momentum') }]} 
                            multiline scrollEnabled={true} value={editForm.momentum} 
                            onChangeText={t => setEditForm(prev => ({...prev, momentum: t}))} 
                            onContentSizeChange={e => handleContentSizeChange('momentum', e)}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>📈 매매 전략</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: getFieldHeight('strategy') }]} 
                            multiline scrollEnabled={true} value={editForm.strategy} 
                            onChangeText={t => setEditForm(prev => ({...prev, strategy: t}))} 
                            onContentSizeChange={e => handleContentSizeChange('strategy', e)}
                          />
                        </View>
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>
                          <TextInput 
                            style={[styles.multilineInput, { height: getFieldHeight('ceo') }]} 
                            multiline scrollEnabled={true} value={editForm.ceo} 
                            onChangeText={t => setEditForm(prev => ({...prev, ceo: t}))} 
                            onContentSizeChange={e => handleContentSizeChange('ceo', e)}
                          />
                        </View>
                        
                        <View style={styles.actionButtons}>
                          <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={(e) => {
                            if (Platform.OS === 'web' && e && typeof (e as any).stopPropagation === 'function') {
                              (e as any).stopPropagation();
                            }
                            cancelEditing();
                          }}>
                            <Text style={styles.cancelBtnText}>취소</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={(e) => {
                            if (Platform.OS === 'web' && e && typeof (e as any).stopPropagation === 'function') {
                              (e as any).stopPropagation();
                            }
                            saveEditing(realIdx, item);
                          }} disabled={isSaving}>
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
                        
                        <TouchableOpacity style={styles.editContentBtn} onPress={(e) => {
                          if (Platform.OS === 'web' && e && typeof (e as any).stopPropagation === 'function') {
                            (e as any).stopPropagation();
                          }
                          startEditing(realIdx, item);
                        }}>
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
