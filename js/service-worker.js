// Простой Service Worker для PWA
const CACHE_NAME = 'qr-scanner-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/scanner.html',
  '/css/styles.css',
  '/js/app-state.js',
  '/js/scanner.js', 
  '/js/utils.js',
  '/js/pdf-generator.js',
  '/js/notifications.js',
  '/manifest.json',
  '/ico/icon-192.png',
  '/ico/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});