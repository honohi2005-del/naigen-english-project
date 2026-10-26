const CACHE = 'naigen-en-project-v22';
const CACHE_PREFIX = 'naigen-en-project-';
const CORE = ['./?v=22', './index.html?v=22', './styles.css?v=14', './app.js?v=21', './data.js?v=22', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...Array.from({ length: 230 }, (_, i) => `./audio/q${String(i + 1).padStart(3, '0')}.mp3`)];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    const fallback = new URL('./index.html?v=22', self.registration.scope).href;
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(fallback, copy)); }
      return response;
    }).catch(() => caches.match(fallback)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  })));
});
