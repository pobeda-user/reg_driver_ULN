const CACHE_NAME = 'driver-registration-v1.0';

// Только основные файлы для кэширования
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './styles.css',
    './manifest.json'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Установка');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Кэширование основных файлов');
                // Кэшируем по одному чтобы не было ошибок
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`[Service Worker] Не удалось кэшировать ${url}:`, err);
                        });
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Установка завершена');
                return self.skipWaiting();
            })
    );
});

// Активация
self.addEventListener('activate', event => {
    console.log('[Service Worker] Активация');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    // Пропускаем запросы к Google Apps Script
    if (event.request.url.includes('script.google.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Возвращаем из кэша если есть
                if (response) {
                    return response;
                }
                
                // Иначе загружаем из сети
                return fetch(event.request)
                    .then(response => {
                        // Кэшируем только успешные ответы
                        if (response && response.status === 200 && response.type === 'basic') {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Fallback для главной страницы
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Оффлайн', {
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});
