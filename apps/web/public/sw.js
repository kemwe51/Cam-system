self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('cam-review-v1').then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg'])),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
