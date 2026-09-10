/* JARVIS SW v14.1: сеть-первая для своих файлов (обновы сразу), кэш для CDN */
const V = 'jarvis-v14-1';
const CORE = ['./', './index.html', './manifest.json', './js/core.js', './js/app.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    // свои файлы: сначала сеть, кэш — запасной
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const c = r.clone();
          caches.open(V).then((cc) => cc.put(e.request, c)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  } else if (/jsdelivr|gstatic|googleapis|cloudflare/.test(u.hostname)) {
    // CDN: сначала кэш, потом сеть
    e.respondWith(
      caches.match(e.request).then(
        (h) =>
          h ||
          fetch(e.request).then((r) => {
            const c = r.clone();
            caches.open(V).then((cc) => cc.put(e.request, c)).catch(() => {});
            return r;
          })
      )
    );
  }
});
