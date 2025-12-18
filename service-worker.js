// service-worker.js - упрощенная версия
const APP_VERSION = '1.4';
const CACHE_NAME = `driver-registration-v${APP_VERSION}`;

// Основные ресурсы для кэширования
const PRECACHE_RESOURCES = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html',
  '/reg_driver_ULN/styles.css',
  '/reg_driver_ULN/app.js',
  '/reg_driver_ULN/manifest.json',
  
  // Основные иконки
  '/reg_driver_ULN/icons/icon-32x32.png',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-96x96.png',
  '/reg_driver_ULN/icons/icon-128x128.png',
  '/reg_driver_ULN/icons/icon-144x144.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png',
];

// Установка
self.addEventListener('install', event => {
  console.log(`✅ Установка Service Worker ${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Кэшируем основные ресурсы
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        // Пропускаем ожидание - сразу активируем
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Ошибка при установке:', error);
      })
  );
});

// Активация
self.addEventListener('activate', event => {
  console.log('🎯 Активация Service Worker');
  
  event.waitUntil(
    // Очищаем старые кэши
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Удаляю старый кэш: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log(`✨ Активный кэш: ${CACHE_NAME}`);
      return self.clients.claim();
    })
  );
});

// Обработка запросов - СТРАТЕГИЯ: СЕТЬ С ПАДЕНИЕМ НА КЭШ
self.addEventListener('fetch', event => {
  // Для API запросов - только сеть
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return fetch(event.request);
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Если успешно получили из сети - кэшируем
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Если сети нет - пробуем из кэша
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Если нет в кэше - для HTML возвращаем главную страницу
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/reg_driver_ULN/index.html');
            }
            
            // Для других ресурсов возвращаем заглушку
            return new Response('Нет соединения', {
              status: 503,
              statusText: 'Service Unavailable'
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
      console.log('🔄 Пропускаю ожидание');
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
      break;
      
    case 'CHECK_VERSION':
      console.log(`📊 Версия клиента: ${event.data.version}, SW: ${APP_VERSION}`);
      
      const response = {
        needsUpdate: event.data.version !== APP_VERSION,
        swVersion: APP_VERSION,
        cacheName: CACHE_NAME
      };
      
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(response);
      }
      break;
  }
});

// Периодическая проверка обновлений (раз в день)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-updates') {
    console.log('🔄 Периодическая проверка обновлений');
    checkForUpdates();
  }
});

// Функция проверки обновлений
async function checkForUpdates() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const urls = PRECACHE_RESOURCES;
    
    for (const url of urls) {
      try {
        const networkResponse = await fetch(url, { cache: 'reload' });
        const cachedResponse = await cache.match(url);
        
        if (!cachedResponse || 
            networkResponse.headers.get('etag') !== cachedResponse.headers.get('etag') ||
            new Date(networkResponse.headers.get('last-modified')) > 
            new Date(cachedResponse.headers.get('last-modified'))) {
          
          console.log(`🔄 Обновляю ресурс: ${url}`);
          await cache.put(url, networkResponse.clone());
          
          // Уведомляем клиентов об обновлении
          notifyClientsAboutUpdate(url);
        }
      } catch (error) {
        console.log(`⚠️ Не удалось проверить ${url}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка проверки обновлений:', error);
  }
}

// Уведомление клиентов об обновлении ресурса
function notifyClientsAboutUpdate(resourceUrl) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'RESOURCE_UPDATED',
        resource: resourceUrl,
        timestamp: new Date().toISOString()
      });
    });
  });
}
