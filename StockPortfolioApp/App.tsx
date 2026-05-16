import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TradeScreen from './src/screens/TradeScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import InvestigationScreen from './src/screens/InvestigationScreen';
import PerformanceScreen from './src/screens/PerformanceScreen';
import { useDataStore } from './src/store/useDataStore';

const Tab = createBottomTabNavigator();

export default function App() {
  const { fetchData, isLoading, error } = useDataStore();

  // 앱 최초 실행 시 데이터를 가져옴 (핵심 수정!)
  useEffect(() => {
    fetchData();
  }, []);

  // 로딩 중 화면
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
      </View>
    );
  }

  // 에러 화면
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>⚠️ 데이터 로딩 실패</Text>
        <Text style={styles.errorSubText}>{error}</Text>
      </View>
    );
  }

  return (
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorSubText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
