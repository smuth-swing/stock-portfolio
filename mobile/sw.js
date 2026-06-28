/**
 * sw.js — 주식 포트폴리오 앱 서비스 워커 (PWA 오프라인 지원)
 * - 앱 쉘 및 데이터 JSON 파일을 캐싱하여 오프라인에서도 동작 가능하게 합니다
 * - 캐시 우선(Cache-First) 전략 사용
 */

const CACHE_NAME = 'stock-portfolio-pwa-v13';
const DATA_CACHE_NAME = 'stock-portfolio-data-v13';

// 앱 쉘 파일 목록 (빌드 후 자동 생성되는 파일들 포함)
const APP_SHELL_URLS = [
  '/stock-portfolio/mobile/',
  '/stock-portfolio/mobile/index.html',
];

// 서비스 워커 설치: 앱 쉘 사전 캐싱
self.addEventListener('install', (event) => {
  console.log('[SW] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        // 일부 파일 실패해도 무시 (빌드마다 파일명이 다를 수 있음)
        console.warn('[SW] 일부 파일 사전 캐싱 실패 (무시):', err);
      });
    })
  );
  // 새 SW를 즉시 활성화
  self.skipWaiting();
});

// 서비스 워커 활성화: 오래된 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
          .map((name) => {
            console.log('[SW] 오래된 캐시 삭제:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // 열린 모든 탭에 즉시 적용
  self.clients.claim();
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 데이터 JSON → 네트워크 우선, 실패 시 캐시 (최신 데이터 우선)
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json') && request.method === 'GET') {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((networkResponse) => {
            // 성공 시 캐시에 저장
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // 오프라인이면 캐시에서 꺼냄
            console.log('[SW] 오프라인 - 캐시에서 데이터 제공:', url.pathname);
            return cache.match(request);
          });
      })
    );
    return;
  }

  // 나머지 요청 (앱 쉘) → 캐시 우선, 없으면 네트워크
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // 백그라운드에서 업데이트 (Stale-While-Revalidate)
          fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        // 캐시에 없으면 네트워크에서 가져온 후 캐싱
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        });
      })
    );
  }
});
