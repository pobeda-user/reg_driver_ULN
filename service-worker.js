// service-worker.js - полная версия с кэшированием иконок
const APP_VERSION = '1.4';
const CACHE_NAME = `driver-registration-v${APP_VERSION}`;
const OFFLINE_URL = '/reg_driver_ULN/offline.html';

// Ресурсы для кэширования при установке
const PRECACHE_RESOURCES = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html',
  '/reg_driver_ULN/styles.css',
  '/reg_driver_ULN/app.js',
  '/reg_driver_ULN/manifest.json',
  
  // Иконки для PWA
  '/reg_driver_ULN/icons/icon-16x16.png',
  '/reg_driver_ULN/icons/icon-32x32.png',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-96x96.png',
  '/reg_driver_ULN/icons/icon-128x128.png',
  '/reg_driver_ULN/icons/icon-144x144.png',
  '/reg_driver_ULN/icons/icon-152x152.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-384x384.png',
  '/reg_driver_ULN/icons/icon-512x512.png',
  
  // Иконки для Windows
  '/reg_driver_ULN/icons/icon-70x70.png',
  '/reg_driver_ULN/icons/icon-150x150.png',
  '/reg_driver_ULN/icons/icon-310x150.png',
  '/reg_driver_ULN/icons/icon-310x310.png',
  
  // Шрифты и другие ресурсы
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log(`🔄 Service Worker ${APP_VERSION} устанавливается`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Открываю кэш:', CACHE_NAME);
        return cache.addAll(PRECACHE_RESOURCES)
          .then(() => {
            console.log('✅ Все ресурсы добавлены в кэш');
            return self.skipWaiting();
          })
          .catch(error => {
            console.error('❌ Ошибка кэширования:', error);
          });
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Service Worker активирован');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые кэши
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Удаляю старый кэш: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log(`✅ Текущий кэш: ${CACHE_NAME}`);
      
      // Удаляем старые записи из IndexedDB
      return clearOldDatabases();
    })
    .then(() => {
      console.log('🎉 Service Worker готов к работе');
      
      // Сообщаем клиентам об обновлении
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION,
            timestamp: new Date().toISOString()
          });
        });
      });
    })
    .then(() => self.clients.claim())
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к API
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('googleapis.com/firestore') ||
      event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Если есть в кэше - возвращаем
        if (cachedResponse) {
          console.log('📦 Из кэша:', event.request.url);
          return cachedResponse;
        }
        
        // Иначе загружаем из сети
        return fetch(event.request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ для кэширования
            const responseToCache = response.clone();
            
            // Кэшируем новые ресурсы
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('📥 Добавлено в кэш:', event.request.url);
              });
            
            return response;
          })
          .catch(error => {
            console.log('🌐 Ошибка сети:', error);
            
            // Для HTML запросов показываем offline страницу
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            
            // Для иконок и стилей пробуем найти в кэше альтернативу
            if (event.request.url.includes('icon') || 
                event.request.url.includes('css') ||
                event.request.url.includes('js')) {
              const iconMatch = event.request.url.match(/icon-(\d+x\d+)\.png/);
              if (iconMatch) {
                const size = iconMatch[1];
                return caches.match(`/reg_driver_ULN/icons/icon-${size}.png`);
              }
            }
            
            return new Response('Нет соединения', {
              status: 408,
              statusText: 'Нет соединения',
              headers: new Headers({
                'Content-Type': 'text/html'
              })
            });
          });
      })
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', event => {
  console.log('📨 Сообщение от клиента:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      console.log('🔄 Получена команда пропустить ожидание');
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      console.log('🧹 Очистка кэша по запросу клиента');
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.open(CACHE_NAME).then(cache => {
        cache.keys().then(keys => {
          event.ports[0].postMessage({
            version: APP_VERSION,
            cacheSize: keys.length,
            resources: keys.map(k => k.url)
          });
        });
      });
      break;
      
    case 'CHECK_VERSION':
      console.log(`📊 Проверка версии: клиент ${event.data.version}, сервис ${APP_VERSION}`);
      if (event.data.version !== APP_VERSION) {
        console.log('⚠️ Версии не совпадают, требуется обновление');
        event.ports[0].postMessage({
          needsUpdate: true,
          currentVersion: APP_VERSION,
          clientVersion: event.data.version
        });
      } else {
        event.ports[0].postMessage({
          needsUpdate: false,
          currentVersion: APP_VERSION
        });
      }
      break;
      
    case 'SYNC_REGISTRATION':
      // Обработка фоновой синхронизации
      console.log('🔄 Синхронизация регистраций');
      syncOfflineRegistrations();
      break;
  }
});

// Фоновая синхронизация
self.addEventListener('sync', event => {
  if (event.tag === 'sync-registrations') {
    console.log('🔄 Запуск фоновой синхронизации');
    event.waitUntil(syncOfflineRegistrations());
  }
});

// Пуш-уведомления
self.addEventListener('push', event => {
  console.log('🔔 Push уведомление получено');
  
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/reg_driver_ULN/icons/icon-192x192.png',
    badge: '/reg_driver_ULN/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Открыть',
        icon: '/reg_driver_ULN/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Закрыть',
        icon: '/reg_driver_ULN/icons/icon-96x96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Регистрация водителей', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('🔔 Нажато уведомление:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/reg_driver_ULN/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/reg_driver_ULN/');
        }
      })
  );
});

// Функция синхронизации оффлайн регистраций
async function syncOfflineRegistrations() {
  try {
    // Здесь будет логика отправки оффлайн данных на сервер
    console.log('🔄 Синхронизация оффлайн данных');
    
    // Временная заглушка - всегда успех
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    return Promise.reject(error);
  }
}

// Функция очистки старых баз данных
async function clearOldDatabases() {
  try {
    const databases = await indexedDB.databases();
    const currentDate = new Date();
    const monthAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    
    for (const dbInfo of databases) {
      if (dbInfo.name && dbInfo.name.includes('old_') || dbInfo.name.includes('temp_')) {
        console.log(`🗑️ Удаляю старую БД: ${dbInfo.name}`);
        indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  } catch (error) {
    console.log('⚠️ Не удалось очистить старые БД:', error);
  }
}

// Обработка ошибок
self.addEventListener('error', event => {
  console.error('❌ Ошибка Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ Необработанное исключение:', event.reason);
});

// Периодическая синхронизация (если поддерживается)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-cache') {
      console.log('🔄 Периодическое обновление кэша');
      event.waitUntil(updateCache());
    }
  });
}

// Функция обновления кэша
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedRequests = await cache.keys();
    
    for (const request of cachedRequests) {
      try {
        const response = await fetch(request);
        if (response.status === 200) {
          await cache.put(request, response);
          console.log(`🔄 Обновлен в кэше: ${request.url}`);
        }
      } catch (error) {
        console.log(`⚠️ Не удалось обновить: ${request.url}`, error);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка обновления кэша:', error);
  }
}
