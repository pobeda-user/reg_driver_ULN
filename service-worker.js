// service-worker.js - ОБНОВЛЕННАЯ ВЕРСИЯ

const CACHE_NAME = 'driver-registration-v1.6';
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzt-xQk-DSNfofBV5ewoioKNHJ8p7Idn3GDSu9PY6Dq-MSpl8NpgHiONiQgAcCfGwD0/exec';
const urlsToCache = [
  '/reg_driver_ULN/',
  '/reg_driver_ULN/index.html?v=1.6',
  '/reg_driver_ULN/app.js?v=1.6',
  '/reg_driver_ULN/styles.css?v=1.6',
  '/reg_driver_ULN/manifest.json',
  '/reg_driver_ULN/icons/icon-72x72.png',
  '/reg_driver_ULN/icons/icon-192x192.png',
  '/reg_driver_ULN/icons/icon-512x512.png'
];

// ==================== ОБРАБОТКА УВЕДОМЛЕНИЙ ====================

let currentDriverPhone = null;

// Получаем текущий телефон водителя из приложения
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_DRIVER_ID') {
    currentDriverPhone = event.data.driverId;
    console.log('Service Worker: Сохранен телефон водителя:', currentDriverPhone);
    
    // Запускаем немедленную проверку уведомлений при установке ID
    checkPwaNotifications();
  }
});

// ==================== ПОЛЛИНГ СЕРВЕРА ДЛЯ PWA УВЕДОМЛЕНИЙ ====================

// Функция для периодической проверки PWA уведомлений
async function checkPwaNotifications() {
  try {
    if (!currentDriverPhone) {
      console.log('Service Worker: Нет телефона водителя для проверки уведомлений');
      return;
    }
    
    console.log('Service Worker: Проверяю PWA уведомления для:', currentDriverPhone);
    
    // Получаем последние уведомления с сервера
    const url = `${APP_SCRIPT_URL}?action=get_pwa_notifications&phone=${encodeURIComponent(currentDriverPhone)}&_t=${Date.now()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success && result.notifications && result.notifications.length > 0) {
        console.log('Service Worker: Получены PWA уведомления:', result.notifications.length);
        
        // Показываем уведомления для новых статусов
        result.notifications.forEach(notification => {
          showPwaNotification(notification);
          
          // Помечаем как прочитанное на сервере
          markNotificationAsRead(notification.id);
        });
      } else {
        console.log('Service Worker: Нет новых PWA уведомлений');
      }
    } else {
      console.error('Service Worker: Ошибка HTTP при получении уведомлений:', response.status);
    }
  } catch (error) {
    console.error('Service Worker: Ошибка проверки PWA уведомлений:', error);
  }
}

// Функция показа уведомления из PWA системы
function showPwaNotification(notification) {
  if (!notification || !notification.title || !notification.message) {
    console.error('Service Worker: Неверный формат уведомления:', notification);
    return;
  }
  
  const tag = `pwa-${notification.id || Date.now()}`;
  const driverId = notification.data?.driverId || notification.phone;
  
  // Проверяем, относится ли уведомление к текущему водителю
  if (currentDriverPhone && driverId && driverId !== currentDriverPhone) {
    console.log('Service Worker: Уведомление для другого водителя, игнорируем');
    return;
  }
  
  const options = {
    body: notification.message,
    icon: '/reg_driver_ULN/icons/icon-192x192.png',
    badge: '/reg_driver_ULN/icons/icon-72x72.png',
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: '/reg_driver_ULN/',
      notificationId: notification.id,
      phone: notification.phone,
      type: notification.type,
      data: notification.data,
      timestamp: notification.serverTime || notification.timestamp || Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'Просмотр',
        icon: '/reg_driver_ULN/icons/icon-72x72.png'
      },
      {
        action: 'mark_read',
        title: 'Прочитано',
        icon: '/reg_driver_ULN/icons/icon-72x72.png'
      }
    ]
  };
  
  // Добавляем изображение если есть
  if (notification.data?.image) {
    options.image = notification.data.image;
  }
  
  console.log('Service Worker: Показываю PWA уведомление:', notification.title);
  
  self.registration.showNotification(notification.title, options)
    .then(() => {
      console.log('Service Worker: Уведомление показано успешно');
    })
    .catch(error => {
      console.error('Service Worker: Ошибка показа уведомления:', error);
    });
}

// Функция пометки уведомления как прочитанного на сервере
async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;
  
  try {
    const url = `${APP_SCRIPT_URL}?action=mark_notification_read&notificationId=${encodeURIComponent(notificationId)}&_t=${Date.now()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('Service Worker: Уведомление помечено как прочитанное:', notificationId);
      } else {
        console.warn('Service Worker: Не удалось пометить уведомление как прочитанное:', result);
      }
    }
  } catch (error) {
    console.error('Service Worker: Ошибка пометки уведомления как прочитанного:', error);
  }
}

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Клик по PWA уведомлению', event.notification.data);
  
  const notification = event.notification;
  const action = event.action;
  const notificationData = notification.data;
  
  notification.close();
  
  if (action === 'mark_read') {
    console.log('Service Worker: Пользователь пометил уведомление как прочитанное');
    return;
  }
  
  if (action === 'close') {
    console.log('Service Worker: Пользователь закрыл уведомление');
    return;
  }
  
  // Отправляем сообщение в открытое приложение
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Открываем или фокусируем приложение
      for (let client of windowClients) {
        if (client.url.includes('/reg_driver_ULN/')) {
          client.focus();
          
          // Отправляем данные уведомления в приложение
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            notification: notificationData
          });
          
          return;
        }
      }
      
      // Если приложение не открыто, открываем его
      if (clients.openWindow) {
        return clients.openWindow('/reg_driver_ULN/').then(newClient => {
          // Даем время приложению загрузиться
          setTimeout(() => {
            if (newClient) {
              newClient.postMessage({
                type: 'NOTIFICATION_CLICKED',
                notification: notificationData
              });
            }
          }, 1000);
        });
      }
    })
  );
});

// ==================== СТАНДАРТНЫЕ СЛУЖАЩИЕ ФУНКЦИИ ====================

self.addEventListener('install', event => {
  console.log('Service Worker: Установка v1.6 с PWA уведомлениями');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Кэширование файлов v1.6');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Установка завершена v1.6');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Активация v1.6 с PWA уведомлениями');
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
      
      // Запускаем периодическую проверку PWA уведомлений (каждые 2 минуты)
      setInterval(checkPwaNotifications, 2 * 60 * 1000);
      
      // Также запускаем немедленную проверку при активации
      setTimeout(checkPwaNotifications, 3000);
      
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Не кэшируем запросы к Google Apps Script
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

// Обработка сообщений от приложения
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS_NOW') {
    console.log('Service Worker: Принудительная проверка уведомлений по запросу приложения');
    checkPwaNotifications();
  }
});
