// ==================== АВТОМАТИЧЕСКИЙ СБРОС КЭША ====================
// Сервис-воркер с автоматическим обновлением кэша

// ИЗМЕНИТЕ версию при каждом обновлении
const APP_VERSION = '1.4';
const CACHE_NAME = `driver-registration-cache-v${APP_VERSION}-${Date.now()}`;

// Важные файлы для кэширования (с версиями)
const CORE_ASSETS = [
  // Основные файлы
  '/reg_driver_ULN/',
  `/reg_driver_ULN/index.html?v=${APP_VERSION}`,
  `/reg_driver_ULN/app.js?v=${APP_VERSION}`,
  `/reg_driver_ULN/styles.css?v=${APP_VERSION}`,
  `/reg_driver_ULN/manifest.json?v=${APP_VERSION}`,
  
  // Иконки (с версиями)
  `/reg_driver_ULN/icons/icon-72x72.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-96x96.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-128x128.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-144x144.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-152x152.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-192x192.png?v=${APP_VERSION}`,
  `/reg_driver_ULN/icons/icon-512x512.png?v=${APP_VERSION}`,
  
  // Шрифты и прочее
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'
];

// ==================== УСТАНОВКА ====================
self.addEventListener('install', event => {
  console.log(`📦 Service Worker: Установка версии ${APP_VERSION}`);
  
  event.waitUntil(
    (async () => {
      try {
        // Создаем новый кэш
        const cache = await caches.open(CACHE_NAME);
        console.log(`✅ Кэш создан: ${CACHE_NAME}`);
        
        // Кэшируем основные файлы
        await cache.addAll(CORE_ASSETS);
        console.log('✅ Основные файлы закэшированы');
        
        // Немедленно активируем новый сервис-воркер
        await self.skipWaiting();
        console.log('✅ Service Worker активирован немедленно');
        
      } catch (error) {
        console.error('❌ Ошибка установки Service Worker:', error);
      }
    })()
  );
});

// ==================== АКТИВАЦИЯ ====================
self.addEventListener('activate', event => {
  console.log(`🔄 Service Worker: Активация версии ${APP_VERSION}`);
  
  event.waitUntil(
    (async () => {
      try {
        // Получаем все существующие кэши
        const cacheNames = await caches.keys();
        console.log(`📊 Найдено кэшей: ${cacheNames.length}`);
        
        // Удаляем ВСЕ старые кэши
        const deletePromises = cacheNames.map(cacheName => {
          // Удаляем все кэши, кроме текущего
          if (!cacheName.startsWith('driver-registration-cache-v')) {
            console.log(`🗑️ Удаляю кэш: ${cacheName}`);
            return caches.delete(cacheName);
          }
          
          // Для наших кэшей - удаляем все старые версии
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Удаляю старую версию кэша: ${cacheName}`);
            return caches.delete(cacheName);
          }
          
          return Promise.resolve();
        });
        
        await Promise.all(deletePromises);
        console.log('✅ Все старые кэши удалены');
        
        // Немедленно берем контроль над всеми клиентами
        await self.clients.claim();
        console.log('✅ Service Worker контролирует все вкладки');
        
        // Отправляем сообщение всем клиентам об обновлении
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION,
            cacheName: CACHE_NAME
          });
        });
        
      } catch (error) {
        console.error('❌ Ошибка активации Service Worker:', error);
      }
    })()
  );
});

// ==================== ОБРАБОТКА ЗАПРОСОВ ====================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Пропускаем API запросы и внешние ресурсы
  if (
    request.url.includes('script.google.com') ||
    request.url.includes('fonts.googleapis.com') ||
    request.url.includes('fonts.gstatic.com') ||
    request.method !== 'GET'
  ) {
    return;
  }
  
  // Для навигационных запросов (HTML) - СЕТЬ ПЕРВЫЙ
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Пробуем получить из сети
          const networkResponse = await fetch(request);
          
          // Клонируем для кэширования
          const responseClone = networkResponse.clone();
          
          // Обновляем кэш асинхронно
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          
          return networkResponse;
          
        } catch (error) {
          // Если сеть недоступна - пробуем кэш
          console.log('🌐 Сеть недоступна, использую кэш для:', request.url);
          const cachedResponse = await caches.match(request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Если ничего нет - показываем fallback
          return new Response('Сеть недоступна', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    
    return;
  }
  
  // Для статических ресурсов - КЭШ ПЕРВЫЙ с обновлением
  event.respondWith(
    (async () => {
      try {
        // Сначала проверяем кэш
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
          // Параллельно обновляем кэш
          fetch(request)
            .then(networkResponse => {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            })
            .catch(() => {
              // Игнорируем ошибки обновления кэша
            });
          
          return cachedResponse;
        }
        
        // Если нет в кэше - получаем из сети
        const networkResponse = await fetch(request);
        
        // Кэшируем для будущих запросов
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        
        return networkResponse;
        
      } catch (error) {
        console.error('❌ Ошибка получения:', request.url, error);
        
        // Для CSS/JS файлов возвращаем fallback
        if (request.url.includes('.css')) {
          return new Response('/* Fallback CSS */', {
            headers: { 'Content-Type': 'text/css' }
          });
        }
        
        if (request.url.includes('.js')) {
          return new Response('// Fallback JS', {
            headers: { 'Content-Type': 'application/javascript' }
          });
        }
        
        return new Response('Ресурс недоступен', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// ==================== ОБРАБОТКА СООБЩЕНИЙ ====================
self.addEventListener('message', event => {
  console.log('📨 Service Worker получил сообщение:', event.data);
  
  switch (event.data.action) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        version: APP_VERSION,
        cacheName: CACHE_NAME
      });
      break;
  }
});

// ==================== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ ====================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('🔄 Фоновая синхронизация');
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // Здесь можно добавить синхронизацию оффлайн данных
  return Promise.resolve();
}

// ==================== ФОН ВЫПУСК ПУШ-УВЕДОМЛЕНИЙ ====================
self.addEventListener('push', event => {
  console.log('🔔 Push уведомление получено');
  
  const options = {
    body: event.data?.text() || 'Новое уведомление',
    icon: '/reg_driver_ULN/icons/icon-192x192.png',
    badge: '/reg_driver_ULN/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/reg_driver_ULN/',
      timestamp: Date.now()
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('УЛН Регистрация', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('🔔 Нажатие на уведомление');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow('/reg_driver_ULN/');
      }
    })
  );
});
