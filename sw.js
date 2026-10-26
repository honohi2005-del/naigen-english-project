const CACHE = 'naigen-en-project-v9';
const CACHE_PREFIX = 'naigen-en-project-';
const CORE = ['./?v=9', './index.html?v=9', './styles.css?v=9', './app.js?v=9', './data.js?v=9', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...Array.from({ length: 34 }, (_, i) => `./audio/q${String(i + 1).padStart(3, '0')}.mp3`)];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const cacheKey = event.request.mode === 'navigate' ? new URL('./index.html?v=9', self.registration.scope).href : event.request;
  event.respondWith(caches.match(cacheKey).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match('./index.html?v=9'))));
});
