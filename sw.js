const CACHE_NAME = 'notes-app-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/midi.html',
    '/audio.html',
    '/css/style.css',
    '/js/notation.js',
    '/js/quotes.js',
    '/js/storage.js',
    '/js/drawing.js',
    '/js/recognition.js',
    '/js/app.js',
    '/manifest.json',
];

// Install - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // For CDN resources (Tesseract, fonts) - network first
    if (!event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // For local assets - cache first, then network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            });
            return cached || fetchPromise;
        })
    );
});
