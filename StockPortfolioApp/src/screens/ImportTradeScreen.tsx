/**
 * ImportTradeScreen.tsx
 * LS증권 OpenAPI 연동 — 거래내역 조회 및 매매일지 가져오기 화면
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Switch, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── API BASE URL (config.ts와 동일 로직) ─────────────────
function getApiBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const pathname = window.location.pathname.replace(/\/[^/]*$/, '');
    return window.location.origin + pathname;
  }
  return '';
}

// ─── 날짜 헬퍼 ────────────────────────────────────────────
function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
function formatDisplay(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// ─── 타입 ─────────────────────────────────────────────────
interface Trade {
  date: string;
  ticker: string;
  name: string;
  type: '매수' | '매도';
  qty: number;
  price: number;
  amount: number;
  investment: number;
  fee: number;
  memo: string;
  selected: boolean;
}

interface LsConfig {
  app_key: string;
  app_secret: string;
  account: string;
  account_pw: string;
  configured: boolean;
}

// ─── 서브 컴포넌트: 설정 패널 ──────────────────────────────
function ConfigPanel({ onSaved }: { onSaved: () => void }) {
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [account, setAccount] = useState('');
  const [accountPw, setAccountPw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 기존 설정 불러오기
    const base = getApiBase();
    if (!base) return;
    fetch(`${base}/api/ls/config`)
      .then(r => r.json())
      .then((cfg: LsConfig) => {
        setAppKey(cfg.app_key || '');
        setAppSecret(cfg.app_secret || '');
        setAccount(cfg.account || '');
        setAccountPw(cfg.account_pw || '');
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const base = getApiBase();
    if (!base) { Alert.alert('오류', '서버에 연결된 상태에서만 설정할 수 있습니다.'); return; }
    if (!appKey || !appSecret || !account || !accountPw) {
      Alert.alert('입력 오류', '모든 항목을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch(`${base}/api/ls/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_key: appKey, app_secret: appSecret, account, account_pw: accountPw }),
      });
      const result = await resp.json();
      if (result.success) {
        Alert.alert('저장 완료', 'LS증권 API 설정이 저장되었습니다.', [{ text: '확인', onPress: onSaved }]);
      } else {
        Alert.alert('저장 실패', result.error || '알 수 없는 오류');
      }
    } catch (e) {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.configCard}>
      <Text style={styles.configTitle}>🔑 LS증권 OpenAPI 설정</Text>
      <Text style={styles.configHint}>openapi.ls-sec.co.kr 에서 발급한 키를 입력하세요</Text>

      {[
        { label: 'App Key', value: appKey, setter: setAppKey, secure: false },
        { label: 'App Secret', value: appSecret, setter: setAppSecret, secure: true },
        { label: '계좌번호 (숫자만)', value: account, setter: setAccount, secure: false },
        { label: '계좌 비밀번호', value: accountPw, setter: setAccountPw, secure: true },
      ].map(({ label, value, setter, secure }) => (
        <View key={label} style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{label}</Text>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setter}
            secureTextEntry={secure}
            placeholder={`${label} 입력`}
            placeholderTextColor="#475569"
            autoCapitalize="none"
          />
        </View>
      ))}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveBtnText}>설정 저장</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────
export default function ImportTradeScreen() {
  const [tab, setTab] = useState<'fetch' | 'config'>('fetch');
  const [fromDate, setFromDate] = useState(toYYYYMMDD(new Date()));
  const [toDate, setToDate] = useState(toYYYYMMDD(new Date()));
  const [stockCode, setStockCode] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [excelFile, setExcelFile] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  // 서버 연결 여부 및 설정 상태 확인
  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    const base = getApiBase();
    if (!base) { setConfigured(false); return; }
    try {
      const resp = await fetch(`${base}/api/ls/config`);
      const cfg: LsConfig = await resp.json();
      setConfigured(cfg.configured);
    } catch {
      setConfigured(false);
    }
  };

  // 거래내역 조회
  const handleFetch = useCallback(async () => {
    const base = getApiBase();
    if (!base) { Alert.alert('오류', '로컬 서버에 연결된 상태에서만 조회할 수 있습니다.'); return; }
    if (!configured) { Alert.alert('설정 필요', '먼저 "API 설정" 탭에서 LS증권 API 키를 등록하세요.'); return; }

    setLoading(true);
    setTrades([]);
    try {
      const resp = await fetch(`${base}/api/ls/fetch-trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_date: fromDate, to_date: toDate, stock_code: stockCode }),
      });
      const result = await resp.json();

      if (!resp.ok || !result.success) {
        Alert.alert('조회 실패', result.error || '알 수 없는 오류');
        return;
      }

      if (result.trades.length === 0) {
        Alert.alert('결과 없음', '해당 기간에 체결 내역이 없습니다.');
        return;
      }

      setTrades(result.trades.map((t: any) => ({ ...t, memo: '', selected: true })));
    } catch (e) {
      Alert.alert('연결 오류', '서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, stockCode, configured]);

  // 전체 선택/해제
  const toggleSelectAll = (val: boolean) => {
    setSelectAll(val);
    setTrades(prev => prev.map(t => ({ ...t, selected: val })));
  };

  // 개별 선택 토글
  const toggleTrade = (idx: number) => {
    setTrades(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  // 종목명 수정
  const updateTradeName = (idx: number, name: string) => {
    setTrades(prev => prev.map((t, i) => i === idx ? { ...t, name } : t));
  };

  // 메모 수정
  const updateMemo = (idx: number, memo: string) => {
    setTrades(prev => prev.map((t, i) => i === idx ? { ...t, memo } : t));
  };

  // Excel DB 저장
  const handleImport = useCallback(async () => {
    const base = getApiBase();
    if (!base) { Alert.alert('오류', '서버 연결이 필요합니다.'); return; }

    const selected = trades.filter(t => t.selected);
    if (selected.length === 0) { Alert.alert('선택 없음', '저장할 거래를 선택하세요.'); return; }
    if (!excelFile) { Alert.alert('파일 필요', '저장할 Excel 파일 경로를 입력하세요.\n예: 주식 체크 리스트_20220328.xlsx'); return; }

    setSaving(true);
    try {
      const resp = await fetch(`${base}/api/ls/import-trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: excelFile, trades: selected }),
      });
      const result = await resp.json();

      if (result.success) {
        Alert.alert('저장 완료 ✅', result.message, [{
          text: '확인',
          onPress: () => setTrades([]),
        }]);
      } else {
        Alert.alert('저장 실패', result.error || '알 수 없는 오류');
      }
    } catch (e) {
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [trades, excelFile]);

  const selectedCount = trades.filter(t => t.selected).length;

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <Text style={styles.title}>거래내역 가져오기</Text>

      {/* 탭 */}
      <View style={styles.tabRow}>
        {(['fetch', 'config'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'fetch' ? '📊 거래 조회' : '⚙️ API 설정'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'config' ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <ConfigPanel onSaved={() => { checkConfig(); setTab('fetch'); }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

          {/* 연결 상태 배지 */}
          {configured !== null && (
            <View style={[styles.statusBadge, configured ? styles.badgeOk : styles.badgeWarn]}>
              <Text style={styles.badgeText}>
                {configured ? '✅ API 설정 완료 — 조회 준비됨' : '⚠️ API 설정 필요 — "API 설정" 탭에서 등록하세요'}
              </Text>
            </View>
          )}

          {/* 날짜 입력 */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>시작일 (YYYYMMDD)</Text>
              <TextInput
                style={styles.textInput}
                value={fromDate}
                onChangeText={setFromDate}
                keyboardType="numeric"
                maxLength={8}
                placeholder="20260101"
                placeholderTextColor="#475569"
              />
            </View>
            <Text style={styles.dateSep}>→</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>종료일 (YYYYMMDD)</Text>
              <TextInput
                style={styles.textInput}
                value={toDate}
                onChangeText={setToDate}
                keyboardType="numeric"
                maxLength={8}
                placeholder="20261231"
                placeholderTextColor="#475569"
              />
            </View>
          </View>

          {/* 종목코드 (선택) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>종목코드 (공백=전종목)</Text>
            <TextInput
              style={styles.textInput}
              value={stockCode}
              onChangeText={setStockCode}
              placeholder="예: 005930 (삼성전자)"
              placeholderTextColor="#475569"
              keyboardType="numeric"
            />
          </View>

          {/* 조회 버튼 */}
          <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#0F172A" />
              : <Text style={styles.fetchBtnText}>🔍 LS증권 거래내역 조회</Text>
            }
          </TouchableOpacity>

          {/* 결과 목록 */}
          {trades.length > 0 && (
            <View style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultCount}>{trades.length}건 조회됨</Text>
                <View style={styles.selectAllRow}>
                  <Text style={styles.inputLabel}>전체 선택</Text>
                  <Switch
                    value={selectAll}
                    onValueChange={toggleSelectAll}
                    trackColor={{ true: '#00F2FE', false: '#334155' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {trades.map((trade, idx) => (
                <View key={idx} style={[styles.tradeCard, !trade.selected && styles.tradeCardDim]}>
                  <View style={styles.tradeTop}>
                    <TouchableOpacity onPress={() => toggleTrade(idx)} style={styles.checkbox}>
                      <Text style={styles.checkboxText}>{trade.selected ? '☑' : '☐'}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View style={styles.tradeNameRow}>
                        <TextInput
                          style={styles.tradeNameInput}
                          value={trade.name}
                          onChangeText={text => updateTradeName(idx, text)}
                          placeholder="종목명"
                          placeholderTextColor="#475569"
                        />
                        <Text style={[styles.tradeType, trade.type === '매도' ? styles.sell : styles.buy]}>
                          {trade.type}
                        </Text>
                      </View>
                      <Text style={styles.tradeMeta}>
                        {formatDisplay(trade.date.replace(/-/g, ''))} · {trade.qty.toLocaleString()}주 · {trade.price.toLocaleString()}원
                      </Text>
                      <Text style={styles.tradeAmount}>
                        체결금액: {trade.amount.toLocaleString()}원 · 투자금: {trade.investment}만원
                      </Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.memoInput}
                    value={trade.memo}
                    onChangeText={text => updateMemo(idx, text)}
                    placeholder="메모 (선택)"
                    placeholderTextColor="#475569"
                  />
                </View>
              ))}

              {/* Excel 파일 경로 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>저장할 Excel 파일 (OneDrive 기준 상대경로)</Text>
                <TextInput
                  style={styles.textInput}
                  value={excelFile}
                  onChangeText={setExcelFile}
                  placeholder="예: 주식 체크 리스트_20220328.xlsx"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* 저장 버튼 */}
              <TouchableOpacity style={styles.importBtn} onPress={handleImport} disabled={saving || selectedCount === 0}>
                {saving
                  ? <ActivityIndicator color="#0F172A" />
                  : <Text style={styles.importBtnText}>💾 선택한 {selectedCount}건 매매일지에 저장</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

// ─── 스타일 ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', paddingHorizontal: 20, marginBottom: 16 },

  // 탭
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabBtnActive: { backgroundColor: 'rgba(0,242,254,0.12)', borderColor: '#00F2FE' },
  tabText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#00F2FE', fontWeight: 'bold' },

  // 상태 배지
  statusBadge: { borderRadius: 10, padding: 10, marginBottom: 16 },
  badgeOk: { backgroundColor: 'rgba(6,78,59,0.5)' },
  badgeWarn: { backgroundColor: 'rgba(120,53,15,0.5)' },
  badgeText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },

  // 날짜
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  dateSep: { color: '#64748B', fontSize: 18, paddingBottom: 10 },

  // 입력
  inputGroup: { marginBottom: 12 },
  inputLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: '#E2E8F0', fontSize: 14,
  },

  // 버튼
  fetchBtn: { backgroundColor: '#00F2FE', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 20 },
  fetchBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  saveBtn: { backgroundColor: '#00F2FE', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  importBtn: { backgroundColor: '#D4AF37', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  importBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },

  // 결과
  resultSection: { marginTop: 4 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultCount: { color: '#00F2FE', fontSize: 15, fontWeight: 'bold' },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // 거래 카드
  tradeCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14, marginBottom: 10,
  },
  tradeCardDim: { opacity: 0.45 },
  tradeTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  checkbox: { paddingTop: 2 },
  checkboxText: { fontSize: 20, color: '#00F2FE' },
  tradeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tradeName: { color: '#E2E8F0', fontWeight: 'bold', fontSize: 15 },
  tradeNameInput: { 
    color: '#E2E8F0', fontWeight: 'bold', fontSize: 15, 
    paddingVertical: 2, paddingHorizontal: 4, margin: 0, 
    minWidth: 80, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4
  },
  tradeType: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  buy: { backgroundColor: 'rgba(0,242,254,0.15)', color: '#00F2FE' },
  sell: { backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  tradeMeta: { color: '#94A3B8', fontSize: 12, marginBottom: 2 },
  tradeAmount: { color: '#64748B', fontSize: 11 },
  memoInput: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, color: '#94A3B8', fontSize: 13,
  },

  // 설정 패널
  configCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20,
  },
  configTitle: { color: '#E2E8F0', fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  configHint: { color: '#64748B', fontSize: 12, marginBottom: 20 },
});
