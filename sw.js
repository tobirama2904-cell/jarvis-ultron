/* MARK II service worker */
const CACHE = 'mark3-v18-1';
const FILES = ['index.html', 'css/app.css', 'manifest.json', 'icon-192.png',
  'js/config.js', 'js/store.js', 'js/api.js', 'js/brain.js', 'js/voice.js',
  'js/vision.js', 'js/fx.js', 'js/ui.js', 'js/app.js',
  'js/memory.js', 'js/tasks.js', 'js/agent.js', 'js/files.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) {
    // runtime cache: CDN модели/wasm/шрифты грузятся один раз
    if (/jsdelivr|unpkg|gstatic|googleapis/.test(url.hostname)) {
      e.respondWith(caches.open('mark3-runtime').then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(() => hit))));
    }
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match('index.html'))));
});
