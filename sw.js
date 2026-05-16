// Navasri Service Worker
// [PHASE2-CB 16พค69] bump v5→v6 เพื่อ force purge cache เก่า + STATIC_CACHE v4→v6
//   activate handler จะลบ navasri-v5 + navasri-static-v4 อัตโนมัติเมื่อ SW ใหม่ activate
const CACHE_VERSION = 'navasri-v6';
const STATIC_CACHE = 'navasri-static-v6';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Supabase API
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return;
  }
  if (event.request.method !== 'GET') return;
  if (!url.origin.startsWith(self.location.origin)) return;

  // Cache-first สำหรับ ICONS เท่านั้น (รูปไม่ค่อยเปลี่ยน)
  if (url.pathname.startsWith('/icons/') ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first สำหรับ CSS/JS/HTML/JSON
  // (CSS เปลี่ยนบ่อย — network-first กัน cache hell)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        throw new Error('Network failed and no cache available');
      });
    })
  );
});
