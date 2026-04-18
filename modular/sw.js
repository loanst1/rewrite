const CACHE_NAME = 'rewrite-v13';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './exercises.js',
  './app.js',
  './strings/en.js',
  './strings/es.js',
  './strings/fr.js',
  './strings/de.js',
  './strings/it.js',
  './strings/pt.js',
  './strings/cy.js',
  './strings/ja.js',
  './strings/ko.js',
  './strings/hi.js',
  './strings/ar.js',
  './strings/zh.js',
  './strings/pl.js',
  './strings/es_mx.js',
  './strings/pt_br.js',
  './strings/fr_ca.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Notify clients about the update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
