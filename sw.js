const CACHE = 'naigen-en-project-v48';
const CACHE_PREFIX = 'naigen-en-project-';
const CORE = ['./?v=48', './index.html?v=48', './styles.css?v=21', './app.js?v=37', './data.js?v=35', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './audio/manifest.json'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  const response = await fetch('./audio/manifest.json');
  if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
  const manifest = await response.json();
  await cache.addAll(manifest.assets.map(asset => `./audio/${asset.file}`));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    const fallback = new URL('./index.html?v=48', self.registration.scope).href;
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
