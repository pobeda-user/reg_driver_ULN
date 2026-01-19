// service-worker.js - исправленная версия
const APP_VERSION = '1.5';
const CACHE_NAME = `driver-reg-v${APP_VERSION}`;

// Основные ресурсы для предварительного кэширования
const PRECACHE_RESOURCES = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html',
  '/reg_driver_ULN/styles.css',
  '/reg_driver_ULN/app.js',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log(`📦 Установка Service Worker версии ${APP_VERSION}`);
  
  event.waitUntil(
    // Пропускаем ожидание и сразу активируем
    self.skipWaiting()
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Активация Service Worker');
  
  event.waitUntil(
    // Очищаем старые кэши
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем только старые версии нашего приложения
          if (cacheName.startsWith('driver-reg-') && cacheName !== CACHE_NAME) {
            console.log(`🗑️ Удаляю старый кэш: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Заявляем контроль над всеми клиентами
      return self.clients.claim();
    })
    .then(() => {
      console.log(`✅ Service Worker ${APP_VERSION} готов к работе`);
    })
  );
});

// Обработка запросов - УПРОЩЕННАЯ СТРАТЕГИЯ
self.addEventListener('fetch', event => {
  const request = event.request;

  try {
    const urlObj = new URL(request.url);
    if (urlObj.pathname === '/reg_driver_ULN/manifest.json') {
      event.respondWith(
        fetch(request, { cache: 'no-store' })
          .then(resp => resp)
          .catch(() => caches.match(request))
      );
      return;
    }
  } catch (e) {
    // ignore
  }
  
  // Пропускаем запросы к API и не-GET запросы
  if (request.url.includes('/api/') || request.method !== 'GET') {
    return fetch(request);
  }
  
  // Для статических файлов - стратегия "Cache First, then Network"
  if (request.url.includes('.css') || 
      request.url.includes('.js') || 
      request.url.includes('.png') || 
      request.url.includes('.json') ||
      request.url === self.location.origin + '/reg_driver_ULN/' ||
      request.url === self.location.origin + '/reg_driver_ULN/index.html') {
    
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          // Если есть в кэше - возвращаем из кэша
          if (cachedResponse) {
            console.log(`📦 Из кэша: ${request.url}`);
            return cachedResponse;
          }
          
          // Если нет в кэше - загружаем из сети
          return fetch(request)
            .then(networkResponse => {
              // Клонируем ответ для кэширования
              const responseToCache = networkResponse.clone();
              
              // Добавляем в кэш для будущего использования
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache);
                  console.log(`📥 Добавлено в кэш: ${request.url}`);
                });
              
              return networkResponse;
            })
            .catch(error => {
              console.log(`🌐 Ошибка загрузки: ${request.url}`, error);

              const accept = request.headers.get('accept') || '';
              if (accept.includes('text/html')) {
                return new Response(
                  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка сети</title></head><body><h1>Нет соединения</h1><p>Проверьте подключение к интернету.</p><button onclick="window.location.reload()">Повторить</button></body></html>',
                  {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                  }
                );
              }

              // Для JSON/картинок/скриптов НЕ подменяем контент HTML-страницей
              return new Response('Нет соединения', { status: 503 });
            });
        })
    );
  } else {
    // Для всех остальных запросов - только сеть
    event.respondWith(fetch(request));
  }
});

// Обработка сообщений от клиента
self.addEventListener('message', event => {
  console.log('📨 Сообщение от клиента:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      console.log('🔄 Пропускаю ожидание по запросу клиента');
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      console.log('🧹 Очистка кэша');
      caches.delete(CACHE_NAME).then(success => {
        if (success) {
          console.log('✅ Кэш очищен');
        }
      });
      break;
      
    case 'UPDATE_CACHE':
      console.log('🔄 Обновление кэша');
      updateCacheResources();
      break;
      
    case 'CHECK_VERSION':
      console.log(`📊 Проверка версии: клиент ${event.data.version}, SW ${APP_VERSION}`);
      
      // Отправляем ответ обратно клиенту
      if (event.source) {
        event.source.postMessage({
          type: 'VERSION_INFO',
          swVersion: APP_VERSION,
          cacheName: CACHE_NAME,
          needsUpdate: event.data.version !== APP_VERSION
        });
      }
      break;
  }
});

// Функция обновления кэшированных ресурсов
async function updateCacheResources() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Обновляем основные ресурсы
    for (const resource of PRECACHE_RESOURCES) {
      try {
        const response = await fetch(resource, { cache: 'reload' });
        if (response.ok) {
          await cache.put(resource, response);
          console.log(`✅ Обновлен: ${resource}`);
        }
      } catch (error) {
        console.log(`⚠️ Не удалось обновить ${resource}:`, error);
      }
    }
    
    console.log('✨ Кэш обновлен');
  } catch (error) {
    console.error('❌ Ошибка обновления кэша:', error);
  }
}
