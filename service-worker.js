const CACHE_NAME = 'driver-registration-v1.3';
const urlsToCache = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html?v=1.3',
  '/reg_driver_ULN/app.js?v=1.3',
  '/reg_driver_ULN/styles.css?v=1.3',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Кэширование файлов');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Установка завершена');
                return self.skipWaiting();
            })
    );
});

// Активация
self.addEventListener('activate', event => {
    console.log('Service Worker: Активация');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Удаление старого кэша', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Клиенты обновлены');
            return self.clients.claim();
        })
    );
});

// Fetch
self.addEventListener('fetch', event => {
    // Пропускаем запросы к API
    if (event.request.url.includes('script.google.com')) {
        console.log('Service Worker: Пропускаем API запрос', event.request.url);
        return fetch(event.request);
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('Service Worker: Используем кэш', event.request.url);
                    return response;
                }
                
                console.log('Service Worker: Загружаем из сети', event.request.url);
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.log('Service Worker: Ошибка загрузки', error);
                        if (event.request.mode === 'navigate') {
                            return caches.match('/reg_driver_ULN/');
                        }
                    });
            })
    );
});
