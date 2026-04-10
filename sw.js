const CACHE_NAME = 'dot-system-v2';
const ASSETS = [
    './',
    './index.html',
    './transactions.html',
    './repair-jobs.html',
    './amc-management.html',
    './service-visits.html',
    './calendar.html',
    './employees.html',
    './settings.html',
    './lock.html',
    './dm.html',
    './styles.css',
    './script.js',
    './transactions-script.js',
    './repair-script.js',
    './amc-script.js',
    './service-visits-script.js',
    './employee-script.js',
    './settings-script.js',
    './lock-script.js',
    './dm-script.js',
    './data-controller.js',
    './app-utils.js',
    './theme-system.js',
    './firebase-config.js',
    './global-banner.js',
    './notifications.js',
    './transitions.js',
    './auth-guard.js',
    './manifest.json',
    './app-icon.png'
];

// Install Event: Cache everything
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Network-First for JS, Cache-First for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isScript = url.pathname.endsWith('.js');

    if (isScript) {
        // Network-First for scripts to ensure updates are picked up
        event.respondWith(
            fetch(event.request)
                .then((networkRes) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkRes.clone());
                        return networkRes;
                    });
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-First for other assets
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
