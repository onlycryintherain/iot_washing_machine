const CACHE = 'dorm-laundry-shell-v3';
const NAV_CACHE = 'dorm-laundry-notification-navigation-v1';
const NAV_REQUEST = new URL('/__laundry_notification_target__', self.location.origin).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icons/laundry-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== NAV_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((hit) => hit || caches.match('/'))));
});

self.addEventListener('push', (event) => {
  let data = { title: '기숙사 세탁실', body: '세탁기 상태가 업데이트되었습니다.', url: '/', type: 'UPDATE' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/laundry-192.png',
    badge: '/icons/badge.png',
    tag: `laundry-${data.type}-${data.washerId ?? 'app'}`,
    data: { url: data.url ?? '/' },
    renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let path = '/';
  try {
    const url = new URL(event.notification.data?.url ?? '/', self.location.origin);
    if (url.origin === self.location.origin && /^\/washer\/[^/?#]+$/.test(url.pathname)) path = url.pathname;
  } catch {}
  const target = new URL(path, self.location.origin).href;

  event.waitUntil((async () => {
    // iOS can reopen a Home Screen app at its start URL even when openWindow gets a detail URL.
    if (path !== '/') {
      try {
        const cache = await caches.open(NAV_CACHE);
        await cache.put(NAV_REQUEST, new Response(JSON.stringify({ path, at: Date.now() })));
      } catch {}
    }

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const exact = windows.find((client) => client.url === target);
    if (exact) {
      await exact.focus();
      return;
    }

    const client = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    if (client) {
      try {
        const navigated = await client.navigate(target);
        if (navigated) {
          await navigated.focus();
          navigated.postMessage({ type: 'LAUNDRY_NOTIFICATION_OPEN', path });
          return;
        }
      } catch {}
      await client.focus();
      client.postMessage({ type: 'LAUNDRY_NOTIFICATION_OPEN', path });
      return;
    }

    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
