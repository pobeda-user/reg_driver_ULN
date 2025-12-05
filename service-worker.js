const CACHE_NAME = 'driver-registration-v1.1';
const urlsToCache = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html',
  '/reg_driver_ULN/app.js',
  '/reg_driver_ULN/styles.css',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия кэширования: Cache First, fallback to Network
self.addEventListener('fetch', event => {
    // Пропускаем запросы к Google Apps Script
    if (event.request.url.includes('script.google.com')) {
        return fetch(event.request);
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
                        // Проверяем валидность ответа
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Клонируем ответ
                        const responseToCache = response.clone();
                        
                        // Добавляем в кэш
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.log('Fetch failed; returning offline page instead.', error);
                        // Fallback для offline
                        if (event.request.mode === 'navigate') {
                            return caches.match('/reg_driver_ULN/');
                        }
                    });
            })
    );
});

// Синхронизация при восстановлении соединения
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        console.log('Background sync: sync-data');
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_OFFLINE_DATA',
                message: 'Синхронизация оффлайн данных'
            });
        });
        return Promise.resolve();
    } catch (error) {
        console.error('Sync error:', error);
        return Promise.reject(error);
    }
}

// Получение push-уведомлений
self.addEventListener('push', event => {
    let data = {};
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body || 'Новое уведомление от системы регистрации',
        icon: '/reg_driver_ULN/icons/icon-192x192.png',
        badge: '/reg_driver_ULN/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/reg_driver_ULN/',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: 'Открыть',
                icon: '/reg_driver_ULN/icons/icon-72x72.png'
            },
            {
                action: 'close',
                title: 'Закрыть',
                icon: '/reg_driver_ULN/icons/icon-72x72.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Регистрация водителей', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open' || event.action === '') {
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {
                // Если открыто окно приложения - фокусируем его
                for (const client of clientList) {
                    if (client.url.includes('/reg_driver_ULN/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Иначе открываем новое окно
                if (clients.openWindow) {
                    return clients.openWindow('/reg_driver_ULN/');
                }
            })
        );
    }
});

// Обработка сообщений от клиентов
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => cache.addAll(event.data.urls))
        );
    }
});
