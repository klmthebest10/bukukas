/* BukuKas Pro — Service Worker (offline cache + notifikasi) */
const VERSION = 'bukukas-v1.7.0';
const SHELL = ['./', './index.html', './app.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
/* pustaka dari CDN ikut disimpan sejak awal agar aplikasi bisa dibuka offline */
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all([c.addAll(SHELL), ...CDN.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {}))])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return; // data selalu langsung ke server
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && (req.mode === 'navigate' || /\.(html|js|json)$/.test(url.pathname))) {
    // network-first: selalu dapat versi terbaru, offline pakai cache
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // cache-first untuk CDN, font, ikon
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => hit)));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'BukuKas', { body: d.body || '', tag: d.tag || undefined, icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', data: { page: d.page || 'dashboard' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const page = (e.notification.data && e.notification.data.page) || 'dashboard';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ page }); return c.focus(); } }
    return self.clients.openWindow('./?page=' + page);
  }));
});
