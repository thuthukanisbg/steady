/* Steady service worker: offline shell + notification tap handling. Bump VERSION on each release. */
const VERSION = 'steady-v8';
const SHELL = ['/', '/index.html', '/styles.css', '/data.js', '/core.js', '/ui.js', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  // Fonts: cache-first
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(m => m || fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => m))));
    return;
  }
  if (url.origin !== location.origin) return;
  // App files: network first (so updates arrive), fall back to cache when offline
  e.respondWith(
    fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then(m => m || caches.match('/index.html')))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});

/* Web Push: the push carries no data; ask the server what to show for this device. */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let m = { title: 'Steady', body: 'Open Steady to see an update', tag: 'steady' };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint)))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
        const r = await fetch('/api/push?p=' + h, { cache: 'no-store' });
        if (r.ok) m = Object.assign(m, await r.json());
      }
    } catch (err) {}
    await self.registration.showNotification(m.title, { body: m.body, tag: m.tag || 'steady', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', vibrate: [300, 150, 300, 150, 300], requireInteraction: /sos|crit/.test(m.tag || ''), renotify: true });
  })());
});
