import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TradeScreen from './src/screens/TradeScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import InvestigationScreen from './src/screens/InvestigationScreen';
import PerformanceScreen from './src/screens/PerformanceScreen';
import ImportTradeScreen from './src/screens/ImportTradeScreen';
import { useDataStore } from './src/store/useDataStore';
import { useServiceWorker } from './src/hooks/useServiceWorker';

const Tab = createBottomTabNavigator();

// ─────────────────────────────────────────────
// 오프라인 상태 배너 컴포넌트
// ─────────────────────────────────────────────
function OfflineBanner({
  isOffline,
  isSyncing,
  lastSyncTime,
  onRefresh,
}: {
  isOffline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  onRefresh: () => void;
}) {
  // 마지막 동기화 시간 포맷
  const formatSyncTime = (iso: string | null) => {
    if (!iso) return '없음';
    try {
      const d = new Date(iso);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min}`;
    } catch {
      return '알 수 없음';
    }
  };

  // 동기화 중 배너 (파란 계열)
  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.bannerSyncing]}>
        <ActivityIndicator size="small" color="#60A5FA" style={{ marginRight: 6 }} />
        <Text style={styles.bannerTextSyncing}>서버 동기화 중...</Text>
      </View>
    );
  }

  // 오프라인 배너 (노랑 계열)
  if (isOffline) {
    return (
      <View style={[styles.banner, styles.bannerOffline]}>
        <Text style={styles.bannerTextOffline}>
          📵 오프라인 모드 · 저장 데이터 사용 중
        </Text>
        <View style={styles.bannerRight}>
          <Text style={styles.bannerSubText}>
            마지막 동기화: {formatSyncTime(lastSyncTime)}
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>새로고침</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 온라인 상태에서는 배너 미표시
  return null;
}

// ─────────────────────────────────────────────
// 메인 앱 컴포넌트
// ─────────────────────────────────────────────
export default function App() {
  const {
    fetchData,
    refreshData,
    tradeJournal,
    portfolioMap,
    isLoading,
    isSyncing,
    isOffline,
    error,
    lastSyncTime,
    hasCachedData,
  } = useDataStore();

  // PWA 서비스 워커 등록 (웹 빌드 시 오프라인 지원)
  useServiceWorker();

  // 앱 최초 실행 시 데이터 로드
  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // ── 초기 로딩 화면 (캐시도, 서버도 없는 첫 실행)
  const hasAnyData = tradeJournal || portfolioMap;
  if (isLoading && !hasAnyData) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={styles.splashText}>데이터 로드 중...</Text>
        <Text style={styles.splashSub}>저장된 데이터를 확인하고 있습니다</Text>
      </View>
    );
  }

  // ── 심각 에러 화면 (캐시도 없고 서버도 실패)
  if (error && !hasAnyData && !isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorTitle}>데이터 없음</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <Text style={styles.errorHint}>
          앱을 처음 실행할 때는{'\n'}서버에 한 번 연결이 필요합니다.{'\n'}
          같은 Wi-Fi에서 데이터 서버를 실행 후{'\n'}아래 버튼을 눌러주세요.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#0F172A" />
          ) : (
            <Text style={styles.retryButtonText}>🔄 다시 연결 시도</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── 정상 화면 (캐시 또는 서버 데이터 있음)
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#00F2FE',
            tabBarInactiveTintColor: '#475569',
            headerStyle: {
              backgroundColor: '#0F172A',
              shadowColor: 'transparent',
              elevation: 0,
            },
            headerTitleStyle: { color: '#FFFFFF', fontWeight: 'bold' },
            headerTintColor: '#fff',
            tabBarStyle: {
              backgroundColor: '#0F172A',
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
              paddingBottom: 5,
              paddingTop: 5,
            },
          }}
        >
          <Tab.Screen name="매매일지" component={TradeScreen} />
          <Tab.Screen name="포트폴리오" component={PortfolioScreen} />
          <Tab.Screen name="탐구생활" component={InvestigationScreen} />
          <Tab.Screen name="실적" component={PerformanceScreen} />
          <Tab.Screen name="가져오기" component={ImportTradeScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* 오프라인/동기화 상태 배너 (네비게이션 위에 오버레이) */}
      <OfflineBanner
        isOffline={isOffline}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  // 스플래시/에러 공통
  splashContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  splashText: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
  },
  splashSub: {
    color: '#64748B',
    fontSize: 14,
  },

  // 에러 화면
  errorIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '800',
  },
  errorDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorHint: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },

  // 상단 배너 (절대 위치로 오버레이)
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  bannerSyncing: {
    backgroundColor: 'rgba(30, 58, 138, 0.95)',
  },
  bannerOffline: {
    backgroundColor: 'rgba(120, 53, 15, 0.95)',
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  bannerTextSyncing: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerTextOffline: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  bannerSubText: {
    color: '#D97706',
    fontSize: 11,
  },
  refreshBtn: {
    backgroundColor: 'rgba(253, 211, 77, 0.2)',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '700',
  },
});
