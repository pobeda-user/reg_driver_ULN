// service-worker.js - ВЕРСИЯ С ВЕБ-ПУШ УВЕДОМЛЕНИЯМИ

const CACHE_NAME = 'driver-registration-v1.5';
const urlsToCache = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html?v=1.5',
  '/reg_driver_ULN/app.js?v=1.5',
  '/reg_driver_ULN/styles.css?v=1.5',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// ==================== ОБРАБОТКА УВЕДОМЛЕНИЙ ====================

// Храним ID текущего водителя для фильтрации уведомлений
let currentDriverId = null;

// Получаем текущий ID водителя из приложения
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_DRIVER_ID') {
    currentDriverId = event.data.driverId;
    console.log('Service Worker: Сохранен ID водителя:', currentDriverId);
  }
});

// ==================== ОБРАБОТКА ВЕБ-ПУШ УВЕДОМЛЕНИЙ ====================

self.addEventListener('push', event => {
  console.log('Service Worker: Получено push-уведомление');
  
  try {
    let data = {};
    if (event.data) {
      data = event.data.json();
    }
    
    const options = {
      body: data.body || 'Уведомление от системы регистрации',
      icon: '/reg_driver_ULN/icons/icon-192x192.png',
      badge: '/reg_driver_ULN/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/reg_driver_ULN/',
        driverId: data.driverId,
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
    
    // Проверяем, относится ли уведомление к текущему водителю
    if (data.driverId && currentDriverId && data.driverId !== currentDriverId) {
      console.log('Service Worker: Уведомление для другого водителя, игнорируем');
      return;
    }
    
    // Добавляем изображение если есть
    if (data.image) {
      options.image = data.image;
    }
    
    // Добавляем теги для группировки
    if (data.tag) {
      options.tag = data.tag;
    }
    
    // Показываем уведомление
    event.waitUntil(
      self.registration.showNotification(data.title || 'Система регистрации', options)
    );
    
  } catch (error) {
    console.error('Service Worker: Ошибка обработки push-уведомления:', error);
    
    // Простое уведомление в случае ошибки
    const options = {
      body: 'Новое уведомление от системы регистрации',
      icon: '/reg_driver_ULN/icons/icon-192x192.png',
      badge: '/reg_driver_ULN/icons/icon-72x72.png'
    };
    
    event.waitUntil(
      self.registration.showNotification('Система регистрации', options)
    );
  }
});

self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Клик по уведомлению');
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data;
  
  if (action === 'close') {
    console.log('Пользователь закрыл уведомление');
    return;
  }
  
  // Открываем приложение
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Проверяем, открыто ли уже приложение
      for (let client of windowClients) {
        if (client.url === notificationData.url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Если приложение не открыто, открываем его
      if (clients.openWindow) {
        return clients.openWindow(notificationData.url);
      }
    })
  );
});

self.addEventListener('notificationclose', event => {
  console.log('Service Worker: Уведомление закрыто пользователем');
});

// ==================== ПОЛЛИНГ СЕРВЕРА ДЛЯ ОБНОВЛЕНИЙ СТАТУСА ====================

// Функция для периодической проверки статуса
async function checkStatusUpdates() {
  try {
    const driverId = currentDriverId;
    if (!driverId) return;
    
    // Получаем последний статус с сервера
    const response = await fetch(`${CONFIG.APP_SCRIPT_URL}?action=get_status_updates&driverId=${driverId}&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      const updates = await response.json();
      
      if (updates.success && updates.updates && updates.updates.length > 0) {
        console.log('Service Worker: Получены обновления статуса:', updates.updates);
        
        // Показываем уведомления для новых статусов
        updates.updates.forEach(update => {
          showStatusNotification(update);
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Ошибка проверки обновлений:', error);
  }
}

// Функция показа уведомления о смене статуса
function showStatusNotification(update) {
  const title = getStatusTitle(update.newStatus);
  const body = getStatusBody(update);
  const tag = `status-${update.registrationId}`;
  
  const options = {
    body: body,
    icon: '/reg_driver_ULN/icons/icon-192x192.png',
    badge: '/reg_driver_ULN/icons/icon-72x72.png',
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: '/reg_driver_ULN/',
      registrationId: update.registrationId,
      driverId: update.driverId,
      timestamp: update.timestamp
    },
    actions: [
      {
        action: 'view',
        title: 'Просмотр',
        icon: '/reg_driver_ULN/icons/icon-72x72.png'
      }
    ]
  };
  
  self.registration.showNotification(title, options);
}

function getStatusTitle(status) {
  const titles = {
    'Назначены ворота': '🚪 Назначены ворота',
    'Документы готовы к выдаче': '📄 Документы готовы',
    'Отказ в приемке': '❌ Отказ в приемке',
    'Нет в графике': '⏰ Вне графика',
    'Проблема с товаром': '⚠️ Проблема с товаром',
    'Проблема с документами': '⚠️ Проблема с документами'
  };
  
  return titles[status] || '📋 Обновление статуса';
}

function getStatusBody(update) {
  let body = `Статус: ${update.newStatus}`;
  
  if (update.assignedGate && update.newStatus === 'Назначены ворота') {
    body = `Вам назначены ворота №${update.assignedGate}`;
  }
  
  if (update.supplier) {
    body += `\nПоставщик: ${update.supplier}`;
  }
  
  if (update.problemType && (update.newStatus === 'Проблема с товаром' || update.newStatus === 'Проблема с документами' || update.newStatus === 'Отказ в приемке')) {
    body += `\nПричина: ${update.problemType}`;
  }
  
  return body;
}

// ==================== СТАНДАРТНЫЕ СЛУЖАЩИЕ ФУНКЦИИ ====================

self.addEventListener('install', event => {
  console.log('Service Worker: Установка v1.5');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Кэширование файлов v1.5');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Установка завершена v1.5');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Активация v1.5');
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
      console.log('Service Worker: Все старые кэши удалены');
      
      // Запускаем периодическую проверку статуса (каждые 5 минут)
      setInterval(checkStatusUpdates, 5 * 60 * 1000);
      
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com')) {
    return fetch(event.request);
  }
  
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
