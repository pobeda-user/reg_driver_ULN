// api.js - API функции и сетевое взаимодействие

import CONFIG from './config.js';
import { logToConsole } from './utils.js';

// ==================== API ФУНКЦИИ ====================

// Универсальная функция API запросов
async function sendAPIRequest(requestData) {
    try {
        logToConsole('INFO', 'Отправляю API запрос (исправленная версия)', {
            action: requestData.action,
            method: 'GET'
        });

        const action = requestData.action || 'unknown';

        // ВСЕ запросы делаем через GET для избежания CORS проблем
        const url = new URL(CONFIG.APP_SCRIPT_URL);

        // Добавляем параметры в URL
        Object.keys(requestData).forEach(key => {
            if (requestData[key] !== undefined && requestData[key] !== null) {
                if (typeof requestData[key] === 'object') {
                    url.searchParams.append(key, JSON.stringify(requestData[key]));
                } else {
                    url.searchParams.append(key, requestData[key]);
                }
            }
        });

        url.searchParams.append('_t', Date.now());

        logToConsole('INFO', 'GET запрос URL', url.toString());

        const startTime = Date.now();

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'omit'
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        logToConsole('INFO', 'GET статус ответа', {
            status: response.status,
            ok: response.ok,
            duration: `${duration}ms`,
            action: action
        });

        if (!response.ok) {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Не удалось прочитать текст ошибки';
            }

            logToConsole('ERROR', 'HTTP ошибка', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200)
            });

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();

        try {
            const result = JSON.parse(text);

            logToConsole('INFO', 'Ответ получен', {
                success: result.success,
                action: action,
                duration: duration
            });

            return result;
        } catch (parseError) {
            logToConsole('ERROR', 'Ошибка парсинга JSON', {
                error: parseError.message,
                rawText: text.substring(0, 200),
                action: action
            });

            if (text.includes('success') || text.includes('suppliers') || text.includes('registrations')) {
                return {
                    success: true,
                    message: 'Запрос обработан (парсинг не удался)',
                    rawResponse: text
                };
            }

            throw new Error('Неверный формат ответа сервера');
        }

    } catch (error) {
        logToConsole('ERROR', 'Ошибка отправки API запроса', {
            error: error.message,
            stack: error.stack,
            action: requestData.action,
            timestamp: new Date().toISOString()
        });

        return {
            success: false,
            message: 'Не удалось отправить запрос: ' + error.message,
            error: error.message
        };
    }
}

// Альтернативный метод отправки (POST)
async function sendViaAlternativeMethod(requestData) {
    try {
        logToConsole('INFO', 'Пробую альтернативный метод');

        const url = CONFIG.APP_SCRIPT_URL;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=${requestData.action}&data=${encodeURIComponent(JSON.stringify(requestData))}`,
            mode: 'no-cors'
        });

        logToConsole('INFO', 'Альтернативный метод статус', {
            status: response.status,
            url: url
        });

        return {
            success: true,
            message: 'Запрос отправлен (no-cors режим)',
            sentInNoCors: true
        };

    } catch (error) {
        logToConsole('ERROR', 'Альтернативный метод также не сработал', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            message: 'Не удалось отправить запрос: ' + error.message
        };
    }
}

// Отправка регистрации на сервер
async function sendRegistrationToServer(data) {
    try {
        // Добавляем уникальный ID регистрации
        const registrationId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        data.registrationId = registrationId;
        data._clientTimestamp = new Date().toISOString();

        logToConsole('INFO', 'Отправляю данные на сервер', {
            url: CONFIG.APP_SCRIPT_URL,
            dataSize: JSON.stringify(data).length,
            registrationId: registrationId,
            clientTime: data._clientTimestamp
        });

        // Используем GET запрос вместо POST для регистрации
        const url = new URL(CONFIG.APP_SCRIPT_URL);
        url.searchParams.append('action', 'register_driver');
        url.searchParams.append('data', JSON.stringify(data));
        url.searchParams.append('_t', Date.now());

        const startTime = Date.now();

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json',
            }
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        logToConsole('INFO', 'Статус ответа регистрации', {
            status: response.status,
            statusText: response.statusText,
            duration: `${duration}ms`,
            url: url.toString(),
            ok: response.ok
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();

        try {
            const result = JSON.parse(text);
            logToConsole('INFO', 'Ответ регистрации получен', {
                success: result.success,
                message: result.message,
                registrationId: result.data?.registrationId,
                responseSize: text.length
            });
            return result;
        } catch (parseError) {
            logToConsole('ERROR', 'Ошибка парсинга JSON регистрации', {
                error: parseError.message,
                rawText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
                url: CONFIG.APP_SCRIPT_URL
            });

            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                logToConsole('ERROR', 'Получен HTML вместо JSON');
                return {
                    success: false,
                    message: 'Сервер вернул HTML вместо JSON. Проверьте URL Google Apps Script.',
                    rawResponse: text.substring(0, 300)
                };
            }

            return {
                success: false,
                message: 'Неверный формат ответа сервера',
                rawResponse: text
            };
        }

    } catch (error) {
        logToConsole('ERROR', 'Ошибка отправки на сервер', {
            error: error.message,
            stack: error.stack,
            url: CONFIG.APP_SCRIPT_URL,
            timestamp: new Date().toISOString(),
            errorType: error.name
        });

        // Пробуем альтернативный метод
        return await sendViaAlternativeMethodForRegistration(data);
    }
}

// Альтернативный метод для регистрации
async function sendViaAlternativeMethodForRegistration(data) {
    try {
        logToConsole('INFO', 'Пробую альтернативный метод регистрации');

        const url = CONFIG.APP_SCRIPT_URL;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=register_driver&data=${encodeURIComponent(JSON.stringify(data))}`,
            mode: 'no-cors'
        });

        logToConsole('INFO', 'Альтернативный метод статус', {
            status: response.status,
            url: url
        });

        return {
            success: true,
            message: 'Данные отправлены (no-cors режим)',
            sentInNoCors: true
        };

    } catch (error) {
        logToConsole('ERROR', 'Альтернативный метод также не сработал', {
            error: error.message,
            stack: error.stack
        });
        return {
            success: false,
            message: 'Не удалось отправить данные: ' + error.message
        };
    }
}

// Получение истории водителя
async function getDriverHistory(phone) {
    try {
        if (!phone) {
            console.log('Нет телефона для получения истории');
            return [];
        }

        const response = await sendAPIRequest({
            action: 'get_driver_history',
            phone: phone
        });

        console.log('Ответ истории:', response);

        if (response && response.success && response.registrations) {
            // Форматируем даты
            const formattedRegistrations = response.registrations.map(reg => ({
                ...reg,
                formattedDate: formatNotificationTime(reg.date + ' ' + reg.time),
                displayDate: reg.date ? `${reg.date} ${reg.time || ''}` : ''
            }));

            // Сохраняем последнюю проверку
            localStorage.setItem('last_history_check_' + phone, Date.now().toString());

            // Сохраняем данные для оффлайн доступа
            try {
                localStorage.setItem('driver_history_cache_' + phone,
                    JSON.stringify({
                        data: formattedRegistrations,
                        timestamp: Date.now(),
                        formattedTimestamp: formatDateTime(new Date())
                    })
                );
            } catch (cacheError) {
                console.log('Не удалось сохранить в кэш:', cacheError);
            }

            return formattedRegistrations;
        }

        // Пробуем получить из кэша
        const cached = localStorage.getItem('driver_history_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                const age = Date.now() - cacheData.timestamp;
                if (age < 24 * 60 * 60 * 1000) { // 24 часа
                    console.log('Использую кэшированную историю');
                    return cacheData.data || [];
                }
            } catch (e) {
                console.log('Ошибка парсинга кэша:', e);
            }
        }

        return [];

    } catch (error) {
        logToConsole('ERROR', 'Ошибка получения истории', error);

        // Пробуем получить из кэша при ошибке
        const cached = localStorage.getItem('driver_history_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                console.log('Использую кэш истории при ошибке');
                return cacheData.data || [];
            } catch (e) {
                console.log('Ошибка парсинга кэша при ошибке:', e);
            }
        }

        return [];
    }
}

// Получение PWA уведомлений
async function getPWANotifications(phone) {
    try {
        if (!phone) {
            console.log('Нет телефона для получения уведомлений');
            return [];
        }

        const lastUpdate = localStorage.getItem('last_notification_update_' + phone);

        const response = await sendAPIRequest({
            action: 'get_pwa_notifications',
            phone: phone,
            lastUpdate: lastUpdate || null
        });

        console.log('Ответ уведомлений:', response);

        if (response && response.success && response.notifications) {
            // Форматируем даты в уведомлениях
            const formattedNotifications = response.notifications.map(notification => ({
                ...notification,
                formattedTimestamp: formatNotificationTime(notification.timestamp),
                displayDate: formatNotificationTime(notification.timestamp)
            }));

            // Сохраняем время последнего обновления в правильном формате
            if (formattedNotifications.length > 0) {
                const latestTimestamp = formattedNotifications[0].timestamp;
                localStorage.setItem('last_notification_update_' + phone, latestTimestamp);
            }

            // Сохраняем уведомления в кэш с отформатированными датами
            try {
                localStorage.setItem('notifications_cache_' + phone,
                    JSON.stringify({
                        data: formattedNotifications,
                        timestamp: Date.now(),
                        formattedTimestamp: formatDateTime(new Date())
                    })
                );
            } catch (cacheError) {
                console.log('Не удалось сохранить уведомления в кэш:', cacheError);
            }

            return formattedNotifications;
        }

        // Пробуем получить из кэша
        const cached = localStorage.getItem('notifications_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                const age = Date.now() - cacheData.timestamp;
                if (age < 2 * 60 * 60 * 1000) { // 2 часа
                    console.log('Использую кэшированные уведомления');
                    return cacheData.data || [];
                }
            } catch (e) {
                console.log('Ошибка парсинга кэша уведомлений:', e);
            }
        }

        return [];

    } catch (error) {
        logToConsole('ERROR', 'Ошибка получения уведомлений', error);

        // Пробуем получить из кэша при ошибке
        const cached = localStorage.getItem('notifications_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                console.log('Использую кэш уведомлений при ошибке');
                return cacheData.data || [];
            } catch (e) {
                console.log('Ошибка парсинга кэша при ошибке:', e);
            }
        }

        return [];
    }
}

// Получение обновлений статуса
async function getDriverStatusUpdates(phone) {
    try {
        if (!phone) {
            console.log('Нет телефона для получения обновлений статуса');
            return [];
        }

        const lastUpdate = localStorage.getItem('last_status_update_' + phone);

        const response = await sendAPIRequest({
            action: 'get_status_updates',
            phone: phone,
            timestamp: lastUpdate || null
        });

        console.log('Ответ обновлений статуса:', response);

        if (response && response.success && response.updates) {
            // Сохраняем время последнего обновления
            if (response.updates.length > 0) {
                const latestUpdate = response.updates[0];
                localStorage.setItem('last_status_update_' + phone,
                    latestUpdate.rowNumber || latestUpdate.timestamp || Date.now().toString());
            }

            // Сохраняем в кэш
            try {
                localStorage.setItem('status_updates_cache_' + phone,
                    JSON.stringify({
                        data: response.updates,
                        timestamp: Date.now()
                    })
                );
            } catch (cacheError) {
                console.log('Не удалось сохранить обновления статуса в кэш:', cacheError);
            }

            return response.updates;
        }

        // Пробуем получить из кэша
        const cached = localStorage.getItem('status_updates_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                const age = Date.now() - cacheData.timestamp;
                if (age < 30 * 60 * 1000) { // 30 минут
                    console.log('Использую кэшированные обновления статуса');
                    return cacheData.data || [];
                }
            } catch (e) {
                console.log('Ошибка парсинга кэша статусов:', e);
            }
        }

        return [];

    } catch (error) {
        logToConsole('ERROR', 'Ошибка получения обновлений статуса', error);

        // Пробуем получить из кэша при ошибке
        const cached = localStorage.getItem('status_updates_cache_' + phone);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                console.log('Использую кэш статусов при ошибке');
                return cacheData.data || [];
            } catch (e) {
                console.log('Ошибка парсинга кэша при ошибке:', e);
            }
        }

        return [];
    }
}

// Получение ТОП-данных
async function loadTopData(forceUpdate = false) {
    const CACHE_KEY = 'top_data';
    const CACHE_TTL = 5 * 60 * 1000; // 5 минут вместо 24 часов

    try {
        logToConsole('INFO', `Загрузка ТОП данных (forceUpdate: ${forceUpdate})`);

        // Если не требуется принудительное обновление, пробуем получить данные из кэша
        if (!forceUpdate) {
            const cachedData = CacheManager.get(CACHE_KEY);
            if (cachedData) {
                // Проверяем, не устарели ли данные (больше 5 минут)
                const cacheAge = Date.now() - (cachedData._timestamp || 0);
                const isStale = cacheAge > CACHE_TTL;

                if (!isStale) {
                    logToConsole('INFO', 'Использую актуальные ТОП данные из кэша', {
                        suppliers: cachedData.suppliers?.length || 0,
                        brands: cachedData.brands?.length || 0,
                        age: Math.round(cacheAge / 1000) + ' сек.'
                    });
                    return cachedData;
                } else {
                    logToConsole('INFO', 'Данные в кэше устарели, загружаем свежие', {
                        age: Math.round(cacheAge / 1000) + ' сек.'
                    });
                }
            }
        } else {
            logToConsole('INFO', 'Принудительное обновление ТОП данных');
        }

        // Загружаем с сервера
        const response = await sendAPIRequest({
            action: 'get_top_data',
            _: forceUpdate ? Date.now() : '' // Добавляем временную метку для предотвращения кэширования
        });

        if (response && response.success) {
            // Добавляем временную метку
            response._timestamp = Date.now();

            // Сохраняем в кэш
            CacheManager.set(CACHE_KEY, response, CACHE_TTL);

            logToConsole('INFO', 'ТОП данные успешно загружены и сохранены в кэш', {
                suppliers: response.suppliers?.length || 0,
                brands: response.brands?.length || 0,
                fromServer: true
            });

            // Оповещаем о новых данных
            EventManager.emit('topDataUpdated', response);

            return response;
        } else {
            throw new Error('Не удалось загрузить ТОП данные с сервера');
        }
    } catch (error) {
        logToConsole('ERROR', 'Ошибка загрузки ТОП данных:', error);

        // Пробуем использовать старый кэш даже если он устарел
        const cached = localStorage.getItem('top_data_cache');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                logToConsole('WARN', 'Использую устаревший кэш ТОП данных');
                return data;
            } catch (e) {
                logToConsole('ERROR', 'Ошибка при разборе устаревшего кэша:', e);
            }
        }

        // Возвращаем пустые данные в случае ошибки
        return {
            success: false,
            suppliers: [],
            brands: []
        };
    }
}

// Тестирование соединения с API
async function testAPIConnection() {
    try {
        logToConsole('INFO', 'Тестирую соединение с API');

        const testUrl = CONFIG.APP_SCRIPT_URL + '?action=ping&test=' + Date.now();

        const response = await fetch(testUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        logToConsole('INFO', 'Статус теста API', {
            status: response.status,
            online: response.ok
        });

        updateConnectionStatus(response.ok);

        if (response.ok) {
            try {
                const data = await response.json();
                logToConsole('INFO', 'API тест успешен', data);
                return true;
            } catch (jsonError) {
                logToConsole('WARN', 'API тест: ответ не JSON', jsonError);
                return true;
            }
        }

        return false;

    } catch (error) {
        logToConsole('ERROR', 'Ошибка тестирования API', error);
        updateConnectionStatus(false);
        return false;
    }
}

// Вспомогательные функции для форматирования (импортируем из utils)
import { formatNotificationTime, formatDateTime } from './utils.js';

// Простая заглушка для CacheManager (нужно реализовать)
const CacheManager = {
    get: (key) => localStorage.getItem('cache_' + key) ? JSON.parse(localStorage.getItem('cache_' + key)) : null,
    set: (key, value, ttl) => {
        const data = { value, expires: ttl ? Date.now() + ttl : null };
        localStorage.setItem('cache_' + key, JSON.stringify(data));
    }
};

// Заглушка для EventManager
const EventManager = {
    emit: (event, data) => {
        console.log('Event emitted:', event, data);
    }
};

// Заглушка для updateConnectionStatus
function updateConnectionStatus(isConnected) {
    console.log('Connection status:', isConnected);
}

export {
    sendAPIRequest,
    sendViaAlternativeMethod,
    sendRegistrationToServer,
    getDriverHistory,
    getPWANotifications,
    getDriverStatusUpdates,
    loadTopData,
    testAPIConnection
};
