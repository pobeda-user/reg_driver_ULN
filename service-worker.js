const CACHE_NAME = 'driver-registration-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/manifest.json',
    '/icons/icon-72.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
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
        })
    );
});

// Стратегия кэширования: Cache First, fallback to Network
self.addEventListener('fetch', event => {
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
                    .catch(() => {
                        // Fallback для offline
                        if (event.request.url.includes('/api/')) {
                            return new Response(JSON.stringify({
                                message: 'Вы находитесь в оффлайн режиме. Данные будут отправлены при восстановлении соединения.'
                            }), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    });
            })
    );
});

// Синхронизация при восстановлении соединения
self.addEventListener('sync', event => {
    if (event.tag === 'sync-registrations') {
        event.waitUntil(syncRegistrations());
    }
});

// Фоновая синхронизация данных
function syncRegistrations() {
    // Здесь будет логика синхронизации данных
    // которые не были отправлены из-за отсутствия соединения
    return Promise.resolve();
}

// Получение push-уведомлений
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Новое уведомление',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Открыть',
                icon: 'icons/icon-72.png'
            },
            {
                action: 'close',
                title: 'Закрыть',
                icon: 'icons/icon-72.png'
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
    
    if (event.action === 'explore') {
        clients.openWindow('/');
    }
});