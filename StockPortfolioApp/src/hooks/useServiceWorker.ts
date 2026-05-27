/**
 * useServiceWorker.ts
 * 웹(PWA) 환경에서 서비스 워커를 등록하는 훅
 * 오프라인 캐싱을 위해 사용
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useServiceWorker() {
  useEffect(() => {
    // 웹 환경에서만 동작
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/mobile/sw.js')
        .then(registration => {
          console.log('[PWA] 서비스 워커 등록 성공:', registration.scope);
        })
        .catch(err => {
          console.warn('[PWA] 서비스 워커 등록 실패:', err);
        });
    });
  }, []);
}
