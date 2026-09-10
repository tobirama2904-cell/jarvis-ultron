const C='jarvis-ultron-v2';
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'])));
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',e=>{
  // HTML — ВСЕГДА сеть-первая, чтобы обновления доехали до телефона (fallback на кэш оффлайн)
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    e.respondWith(
      fetch(e.request).then(r=>{
        try{ const cp=r.clone(); caches.open(C).then(c=>c.put('./index.html',cp)); }catch{}
        return r;
      }).catch(()=>caches.match('./index.html').then(m=>m||caches.match('./')))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
