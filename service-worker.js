// service-worker.js - ОБНОВЛЕННАЯ ВЕРСИЯ

// ИЗМЕНИТЕ версию кэша при каждом обновлении
const CACHE_NAME = 'driver-registration-v1.4'; // ← Должно совпадать с HTML
const urlsToCache = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html?v=1.4',
  '/reg_driver_ULN/app.js?v=1.4',
  '/reg_driver_ULN/styles.css?v=1.4',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Установка v1.4'); // ← Добавьте версию в лог
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Кэширование файлов v1.4');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Установка завершена v1.4');
                // Сразу активируем новый SW, не дожидаясь закрытия всех вкладок
                return self.skipWaiting();
            })
    );
});

// Активация - УДАЛЯЕМ СТАРЫЕ КЭШИ
self.addEventListener('activate', event => {
    console.log('Service Worker: Активация v1.4');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем ВСЕ старые кэши
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Удаление старого кэша', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Все старые кэши удалены');
            // Немедленно берем под контроль все клиенты
            return self.clients.claim();
        })
    );
});

// Fetch - ВСЕГДА пробуем сеть сначала
self.addEventListener('fetch', event => {
    // Пропускаем запросы к API
    if (event.request.url.includes('script.google.com')) {
        return fetch(event.request);
    }
    
    // Для HTML страниц - всегда пробуем сеть сначала
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Кэшируем новую версию
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна - используем кэш
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Для остальных файлов - кэш с fallback на сеть
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

