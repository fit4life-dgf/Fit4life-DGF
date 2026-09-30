// Retires the service worker from the earlier version of the app so nobody is served stale files.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.map((x) => caches.delete(x)))).then(() => self.registration.unregister()).then(() => self.clients.claim())
  )
})
