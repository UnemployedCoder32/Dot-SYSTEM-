const CACHE_NAME = 'dot-system-v1';
const ASSETS = [
    './',
    './index.html',
    './employees.html',
    './repair-jobs.html',
    './amc-management.html',
    './styles.css',
    './script.js',
    './employee-script.js',
    './repair-script.js',
    './amc-script.js',
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
