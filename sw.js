const CACHE_NAME = 'dot-system-v1';
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
