// app.js v2.0 - ПОЛНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ С ТОП-ДАННЫМИ

// Конфигурация
let CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzt-xQk-DSNfofBV5ewoioKNHJ8p7Idn3GDSu9PY6Dq-MSpl8NpgHiONiQgAcCfGwD0/exec',
    APP_VERSION: '2.0'
};

// Константы для кэширования ТОП-данных
const TOP_DATA_CACHE_KEY = 'driver_registration_top_data';
const TOP_DATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

let registrationState = {
    step: 1,
    data: {
        phone: '',
        fio: '',
        supplier: '',
        legalEntity: '',
        productType: '',
        vehicleType: '',
        vehicleNumber: '',
        pallets: 0,
        orderNumber: '',
        etrn: '',
        transit: '',
        gate: '',
        date: '',
        time: '',
        scheduleViolation: 'Нет'
    }
};

function ensureRegistrationState() {
    if (!registrationState || typeof registrationState !== 'object') {
        registrationState = {};
    }

    if (!('step' in registrationState) || typeof registrationState.step !== 'number') {
        registrationState.step = 1;
    }

    if (!registrationState.data || typeof registrationState.data !== 'object') {
        registrationState.data = {};
    }

    const defaults = {
        phone: '',
        fio: '',
        supplier: '',
        legalEntity: '',
        productType: '',
        vehicleType: '',
        vehicleNumber: '',
        pallets: 0,
        orderNumber: '',
        etrn: '',
        transit: '',
        gate: '',
        date: '',
        time: '',
        scheduleViolation: 'Нет'
    };

    for (const [k, v] of Object.entries(defaults)) {
        if (!(k in registrationState.data) || registrationState.data[k] === undefined || registrationState.data[k] === null) {
            registrationState.data[k] = v;
        }
    }
}

function getCabinetIdentity() {
    try {
        ensureRegistrationState();

        // 1) Из текущего состояния (если оно есть)
        let phone = registrationState?.data?.phone || '';
        let name = registrationState?.data?.fio || '';

        // 2) Из сохраненных данных кабинета
        if (!phone) {
            const savedDriverInfo = localStorage.getItem('driver_info_for_cabinet');
            if (savedDriverInfo) {
                try {
                    const driverInfo = JSON.parse(savedDriverInfo);
                    phone = driverInfo.phone || '';
                    name = name || driverInfo.name || '';
                } catch (e) {
                    // ignore
                }
            }
        }

        // 3) Из последнего телефона
        if (!phone) {
            phone = localStorage.getItem('last_driver_phone') || '';
            name = name || (localStorage.getItem('last_driver_name') || '');
        }

        return {
            phone: phone ? normalizePhone(phone) : '',
            name: name || ''
        };
    } catch (e) {
        return { phone: '', name: '' };
    }
}

// ==================== МЕНЕДЖЕР СОБЫТИЙ ====================
const EventManager = {
    events: {},
    
    /**
     * Подписка на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback);
    },
    
    /**
     * Отписка от события
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    },
    
    /**
     * Отправка события
     */
    emit(event, data = null) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Ошибка в обработчике события ${event}:`, error);
            }
        });
    }
};

// ==================== МЕНЕДЖЕР СОСТОЯНИЯ ====================
const StateManager = {
    state: {
        step: 1,
        data: {
            phone: '',
            fio: '',
            supplier: '',
            legalEntity: '',
            productType: '',
            vehicleType: '',
            vehicleNumber: '',
            pallets: 0,
            orderNumber: '',
            etrn: '',
            transit: '',
            gate: '',
            date: '',
            time: '',
            scheduleViolation: 'Нет'
        },
        ui: {
            isLoading: false,
            isOnline: navigator.onLine,
            lastUpdate: null
        }
    },
    
    /**
     * Обновление состояния
     * @param {Object} updates - Обновления состояния
     * @param {boolean} [silent=false] - Без вызова событий
     */
    setState(updates, silent = false) {
        const oldState = { ...this.state };
        
        // Глубокое обновление состояния
        this.state = this._deepMerge(this.state, updates);
        
        // Сохраняем состояние в localStorage
        this._saveState();
        
        // Отправляем событие об изменении состояния
        if (!silent) {
            EventManager.emit('stateChange', {
                newState: this.state,
                oldState,
                updates
            });
        }
    },
    
    /**
     * Получение состояния
     * @param {string} [path] - Путь к свойству (например, 'ui.isLoading')
     * @returns {*} Значение состояния
     */
    getState(path) {
        if (!path) return this.state;
        return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, this.state);
    },
    
    /**
     * Сброс состояния к начальному
     */
    resetState() {
        const initialState = {
            step: 1,
            data: {
                phone: '',
                fio: '',
                supplier: '',
                legalEntity: '',
                productType: '',
                vehicleType: '',
                vehicleNumber: '',
                pallets: 0,
                orderNumber: '',
                etrn: '',
                transit: '',
                gate: '',
                date: '',
                time: '',
                scheduleViolation: 'Нет'
            },
            ui: {
                isLoading: false,
                isOnline: navigator.onLine,
                lastUpdate: null
            }
        };
        
        this.setState(initialState);
    },
    
    /**
     * Сохранение состояния в localStorage
     */
    _saveState() {
        try {
            localStorage.setItem('app_state', JSON.stringify(this.state));
        } catch (error) {
            console.error('Ошибка сохранения состояния:', error);
        }
    },
    
    /**
     * Загрузка состояния из localStorage
     */
    loadState() {
        try {
            const savedState = localStorage.getItem('app_state');
            if (savedState) {
                this.state = JSON.parse(savedState);
                return true;
            }
        } catch (error) {
            console.error('Ошибка загрузки состояния:', error);
        }
        return false;
    },
    
    /**
     * Глубокое слияние объектов
     */
    _deepMerge(target, source) {
        const output = { ...target };
        
        if (this._isObject(target) && this._isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this._isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this._deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    },
    
    /**
     * Проверка, является ли значение объектом
     */
    _isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
};

// Инициализация состояния
StateManager.loadState();

// Глобальный экспорт для отладки
window.appState = StateManager;
window.appEvents = EventManager;

// Проверка версии и очистка старых данных
function checkVersionAndCleanup() {
    const savedVersion = localStorage.getItem('app_version');
    const savedDate = localStorage.getItem('app_last_update');
    
    console.log(`📊 Версия приложения: сохраненная=${savedVersion}, текущая=${CONFIG.APP_VERSION}`);
    
    // Если версия изменилась - очищаем кэши
    if (!savedVersion || savedVersion !== CONFIG.APP_VERSION) {
        console.log(`🔄 Обнаружено обновление версии ${savedVersion || 'нет'} → ${CONFIG.APP_VERSION}`);
        
        // Список кэшей для очистки
        const cacheKeysToRemove = [
            'driver_info_for_cabinet',
            'top_data_cache',
            'supplier_cache',
            'driver_history_cache_',
            'notifications_cache_',
            'status_updates_cache_',
            'last_history_check_',
            'last_notification_update_',
            'last_status_update_',
            'offline_registrations'
        ];
        
        // Очищаем соответствующие ключи localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const shouldRemove = cacheKeysToRemove.some(cacheKey => 
                key.startsWith(cacheKey) || key.includes('cache')
            );
            
            if (shouldRemove) {
                localStorage.removeItem(key);
                console.log(`🗑️ Удален кэш: ${key}`);
            }
        }
        
        // Сохраняем новую версию
        localStorage.setItem('app_version', CONFIG.APP_VERSION);
        localStorage.setItem('app_last_update', new Date().toISOString());
        
        // Показываем уведомление об обновлении
        showNotification(`Приложение обновлено до версии ${CONFIG.APP_VERSION}`, 'success');
    }
    
    // Периодическая проверка обновлений Service Worker
    if ('serviceWorker' in navigator) {
        setInterval(() => {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                    registration.update();
                }
            });
        }, 60 * 60 * 1000); // Каждый час
    }
}


// ==================== ФУНКЦИЯ ДЛЯ ОТКРЫТИЯ ЛИЧНОГО КАБИНЕТА ИЗ ШАГА 1 ====================
function openDriverCabinetFromStep1() {
    try {
        console.log('🔄 Открываю личный кабинет из шага 1...');

        const phoneInput = document.getElementById('phone-input');
        const rawPhone = phoneInput ? phoneInput.value : '';

        // На шаге 1 входим в кабинет ТОЛЬКО по введенному телефону
        if (!rawPhone || rawPhone.replace(/\D/g, '').length < 10) {
            showNotification('Введите номер телефона в поле, чтобы открыть личный кабинет', 'warning');
            if (phoneInput) {
                phoneInput.focus();
            }
            return;
        }

        const normalizedPhone = normalizePhone(rawPhone);
        saveDriverInfoForCabinet(normalizedPhone, '');

        // Показываем загрузчик
        showLoader(true);
        setTimeout(() => {
            openDriverCabinet();
        }, 300);
        
    } catch (error) {
        console.error('❌ Ошибка открытия личного кабинета:', error);
        showLoader(false);
        showNotification('Ошибка открытия личного кабинета: ' + error.message, 'error');
    }
}

// ==================== МЕНЕДЖЕР МОДАЛЬНЫХ ОКОН ====================
const ModalManager = {
    // Кэш для хранения загруженных модальных окон
    modalCache: new Map(),
    
    // Текущее активное модальное окно
    currentModal: null,
    
    // Инициализация менеджера
    init() {
        // Обработка клика вне модального окна
        document.addEventListener('click', (e) => {
            if (this.currentModal && e.target.classList.contains('modal-overlay')) {
                this.closeCurrent();
            }
        });
        
        // Обработка клавиши Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeCurrent();
            }
        });
        
        logToConsole('INFO', 'Менеджер модальных окон инициализирован');
    },
    
    // Открытие модального окна
    async open(modalId, options = {}) {
        // Закрываем текущее модальное окно, если оно есть
        if (this.currentModal) {
            this.closeCurrent();
        }
        
        try {
            // Проверяем кэш
            let modalElement = this.modalCache.get(modalId);
            
            // Если модальное окно не в кэше, загружаем его
            if (!modalElement) {
                modalElement = document.getElementById(modalId);
                
                if (!modalElement) {
                    throw new Error(`Модальное окно с ID "${modalId}" не найдено`);
                }
                
                // Клонируем элемент для кэширования
                const modalClone = modalElement.cloneNode(true);
                this.modalCache.set(modalId, modalClone);
                
                logToConsole('DEBUG', `Модальное окно "${modalId}" загружено в кэш`);
            } else {
                // Используем клонированный элемент из кэша
                modalElement = modalElement.cloneNode(true);
                document.body.appendChild(modalElement);
            }
            
            // Показываем модальное окно
            modalElement.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.currentModal = modalElement;
            
            // Вызываем колбэк после открытия
            if (typeof options.onOpen === 'function') {
                setTimeout(() => options.onOpen(modalElement), 10);
            }
            
            logToConsole('DEBUG', `Открыто модальное окно: ${modalId}`);
            return modalElement;
            
        } catch (error) {
            logToConsole('ERROR', `Ошибка открытия модального окна ${modalId}:`, error);
            showNotification('Ошибка открытия окна', 'error');
            return null;
        }
    },
    
    // Закрытие текущего модального окна
    closeCurrent() {
        if (!this.currentModal) return;
        
        this.currentModal.classList.remove('active');
        
        // Удаляем элемент из DOM после анимации
        setTimeout(() => {
            if (this.currentModal && this.currentModal.parentNode) {
                this.currentModal.parentNode.removeChild(this.currentModal);
            }
            
            document.body.style.overflow = '';
            this.currentModal = null;
        }, 300); // Должно совпадать с длительностью CSS-анимации
        
        logToConsole('DEBUG', 'Текущее модальное окно закрыто');
    },
    
    // Закрытие всех модальных окон
    closeAll() {
        if (this.currentModal) {
            this.closeCurrent();
        }
        
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        });
        
        document.body.style.overflow = '';
        logToConsole('DEBUG', 'Все модальные окна закрыты');
    }
};

// Инициализация менеджера модальных окон при загрузке
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => ModalManager.init());
}

// ==================== КЭШИРОВАНИЕ ДАННЫХ ====================

const CacheManager = {
    // Префикс для ключей кэша
    PREFIX: 'drv_reg_',
    
    // Получение данных из кэша
    get(key, defaultValue = null) {
        try {
            const cached = localStorage.getItem(this.PREFIX + key);
            if (!cached) return defaultValue;
            
            const { value, expires } = JSON.parse(cached);
            
            // Проверяем срок действия кэша
            if (expires && Date.now() > expires) {
                this.delete(key);
                return defaultValue;
            }
            
            return value;
        } catch (error) {
            logToConsole('ERROR', `Ошибка чтения из кэша (${key}):`, error);
            return defaultValue;
        }
    },
    
    // Сохранение данных в кэш
    set(key, value, ttl = null) {
        try {
            const data = {
                value,
                expires: ttl ? Date.now() + ttl : null
            };
            
            localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
            return true;
        } catch (error) {
            logToConsole('ERROR', `Ошибка записи в кэш (${key}):`, error);
            return false;
        }
    },
    
    // Удаление данных из кэша
    delete(key) {
        try {
            localStorage.removeItem(this.PREFIX + key);
            return true;
        } catch (error) {
            logToConsole('ERROR', `Ошибка удаления из кэша (${key}):`, error);
            return false;
        }
    },
    
    // Очистка устаревших записей
    cleanup() {
        try {
            const prefix = this.PREFIX;
            const now = Date.now();
            let cleared = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                if (key.startsWith(prefix)) {
                    try {
                        const { expires } = JSON.parse(localStorage.getItem(key) || '{}');
                        if (expires && expires < now) {
                            localStorage.removeItem(key);
                            cleared++;
                        }
                    } catch (e) {
                        // Пропускаем невалидные записи
                        continue;
                    }
                }
            }
            
            if (cleared > 0) {
                logToConsole('INFO', `Очищено устаревших записей кэша: ${cleared}`);
            }
            
            return cleared;
        } catch (error) {
            logToConsole('ERROR', 'Ошибка очистки кэша:', error);
            return -1;
        }
    }
};

// Периодическая очистка устаревших записей кэша
setInterval(() => CacheManager.cleanup(), 60 * 60 * 1000); // Каждый час

// ==================== ЗАГРУЗКА ТОП-ДАННЫХ ====================

// Загрузка ТОП-данных с возможностью принудительного обновления
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

/**
 * Принудительное обновление ТОП-данных с очисткой кэша
 */
function refreshTopData() {
    logToConsole('INFO', 'Принудительное обновление ТОП данных с очисткой кэша');
    
    // Очищаем кэш перед загрузкой новых данных
    const CACHE_KEY = 'top_data';
    CacheManager.delete(CACHE_KEY);
    
    // Загружаем с принудительным обновлением
    return loadTopData(true)
        .then(data => {
            if (data) {
                showNotification('Данные успешно обновлены', 'success');
                // Обновляем интерфейс, если нужно
                if (typeof updateUIWithNewData === 'function') {
                    updateUIWithNewData(data);
                }
            }
            return data;
        })
        .catch(error => {
            logToConsole('ERROR', 'Ошибка при обновлении данных:', error);
            showNotification('Ошибка при обновлении данных. Проверьте соединение.', 'error');
            throw error; // Пробрасываем ошибку дальше
        });
}

// Связываем функцию с глобальным объектом для доступа из HTML
if (typeof window !== 'undefined') {
    window.refreshTopData = refreshTopData;
}

// ==================== ИСПРАВЛЕННЫЕ ФУНКЦИИ ДАТЫ ====================

// Полный парсинг даты из любого формата
function parseAnyDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    
    try {
        // Убираем лишние пробелы
        dateStr = dateStr.trim();
        
        // Формат 1: "дд.мм.гггг чч:мм"
        if (dateStr.includes('.') && dateStr.includes(':')) {
            const [datePart, timePart] = dateStr.split(' ');
            if (datePart && timePart) {
                const [day, month, year] = datePart.split('.');
                const [hours, minutes] = timePart.split(':');
                
                // Проверяем, есть ли секунды
                const hasSeconds = minutes && minutes.includes('.');
                
                if (hasSeconds) {
                    // Если есть десятичная часть (секунды), берем только минуты
                    const minutesOnly = minutes.split('.')[0];
                    return new Date(
                        parseInt(year, 10),
                        parseInt(month, 10) - 1,
                        parseInt(day, 10),
                        parseInt(hours, 10),
                        parseInt(minutesOnly, 10),
                        0
                    );
                } else {
                    return new Date(
                        parseInt(year, 10),
                        parseInt(month, 10) - 1,
                        parseInt(day, 10),
                        parseInt(hours, 10),
                        parseInt(minutes, 10),
                        0
                    );
                }
            }
        }
        
        // Формат 2: ISO строка
        if (dateStr.includes('T') && dateStr.includes('Z')) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Формат 3: пытаемся распарсить как есть
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        // Если ни один формат не подошел, возвращаем дату по умолчанию
        return new Date(0);
    } catch (error) {
        logToConsole('ERROR', 'Ошибка при разборе даты', { dateStr, error });
        return new Date(0);
    }
}

// Функция для обновления интерфейса при получении новых данных
function updateUIWithNewData(data) {
    // Здесь должна быть логика обновления интерфейса
    // Например, перезагрузка списка поставщиков и марок
    if (data.suppliers && Array.isArray(data.suppliers)) {
        // Обновляем список поставщиков
        updateSuppliersList(data.suppliers);
    }
    
    if (data.brands && Array.isArray(data.brands)) {
        // Обновляем список марок
        updateBrandsList(data.brands);
    }
}

// Обновление списка поставщиков
function updateSuppliersList(suppliers) {
    const suppliersContainer = document.getElementById('suppliers-container');
    if (!suppliersContainer) return;
    
    // Здесь должна быть логика обновления DOM с новыми данными
    // Например:
    // suppliersContainer.innerHTML = suppliers.map(s => `<div>${s.name}</div>`).join('');
}

// Обновление списка марок
function updateBrandsList(brands) {
    const brandsContainer = document.getElementById('brands-container');
    if (!brandsContainer) return;
    
    // Аналогично обновлению списка поставщиков
    // brandsContainer.innerHTML = brands.map(b => `<div>${b.name}</div>`).join('');
}

// ==================== ЛОГИРОВАНИЕ ====================

function logToConsole(level, message, data = null) {
    const timestamp = new Date().toLocaleString('ru-RU');
    
    // Форматируем данные для отображения
    let dataStr = '';
    if (data !== null && data !== undefined) {
        try {
            if (data instanceof Error) {
                dataStr = `\nОшибка: ${data.message}\nСтек: ${data.stack}`;
            } else if (typeof data === 'object') {
                dataStr = '\n' + JSON.stringify(data, null, 2);
            } else {
                dataStr = '\n' + String(data);
            }
        } catch (e) {
            dataStr = '\n[Не удалось преобразовать данные]';
        }
    }
    
    const logEntry = {
        timestamp,
        level,
        message,
        data: data instanceof Error ? { 
            message: data.message, 
            stack: data.stack,
            name: data.name 
        } : data,
        url: window.location.href
    };
    
    // Выводим в консоль
    const consoleMessage = `[${level}] ${timestamp} - ${message}${dataStr}`;
    
    switch(level) {
        case 'ERROR':
            console.error(consoleMessage);
            break;
        case 'WARN':
            console.warn(consoleMessage);
            break;
        default:
            console.log(consoleMessage);
    }
    
    // Сохраняем логи в localStorage
    try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        logs.unshift(logEntry);
        
        // Храним только последние 200 записей
        if (logs.length > 200) {
            logs.pop();
        }
        
        localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (e) {
        console.error('Ошибка сохранения лога:', e);
    }
    
    return logEntry;
}

function isLocalNotificationsEnabled() {
    try {
        return localStorage.getItem('local_notifications_enabled') === 'true';
    } catch (e) {
        return false;
    }
}

function setLocalNotificationsEnabled(enabled) {
    try {
        localStorage.setItem('local_notifications_enabled', enabled ? 'true' : 'false');
    } catch (e) {
        // ignore
    }
}

function updateLocalNotificationsUI() {
    try {
        const buttons = [
            document.getElementById('toggle-local-notifications-btn'),
            document.getElementById('toggle-local-notifications-btn-step1')
        ].filter(Boolean);

        if (buttons.length === 0) return;

        const supported = ("Notification" in window);
        const enabled = isLocalNotificationsEnabled();

        buttons.forEach(btn => {
            if (!supported) {
                btn.disabled = true;
                btn.textContent = '🔕 Уведомления не поддерживаются';
                return;
            }

            if (Notification.permission === 'denied') {
                // Не блокируем: по клику покажем инструкцию
                btn.disabled = false;
                btn.textContent = '🔕 Уведомления запрещены (как включить)';
                return;
            }

            btn.disabled = false;
            btn.textContent = enabled ? '🔔 Уведомления включены (выкл)' : '🔕 Включить уведомления';
        });
    } catch (e) {
        // ignore
    }
}

function updateNotificationsOnlyModalFromCache(driverPhone) {
    try {
        const modal = document.getElementById('notifications-only-modal');
        if (!modal || modal.style.display === 'none') return;

        const cacheKey = 'notifications_cache_' + driverPhone;
        const cached = localStorage.getItem(cacheKey);
        const notifications = cached ? (JSON.parse(cached).data || []) : [];
        const unreadCount = notifications.filter(n => !n.status || n.status !== 'read').length;

        const titleEl = document.getElementById('notifications-only-title');
        if (titleEl) {
            titleEl.textContent = `🔔 Уведомления${unreadCount > 0 ? ` (${unreadCount})` : ''}`;
        }

        const content = document.getElementById('notifications-only-content');
        if (content) {
            content.innerHTML = renderNotificationsTab(notifications);
        }

        updateNotificationBadge(unreadCount);
        updateLocalNotificationsUI();
    } catch (e) {
        // ignore
    }
}

function showNotificationsDeniedHelpModal() {
    try {
        const modalId = 'notifications-denied-help-modal';
        const old = document.getElementById(modalId);
        if (old) old.remove();

        const currentHost = window.location.host || '';

        const html = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target === this) closeModalById('${modalId}')">
                <div class="modal" onclick="event.stopPropagation()" style="max-width: 520px;">
                    <div class="modal-header">
                        <h3 class="modal-title">🔕 Уведомления запрещены</h3>
                        <button class="modal-close" onclick="closeModalById('${modalId}')">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="info-box">
                            <p><strong>Включить уведомления автоматически нельзя</strong> — браузер блокирует повторный запрос, если вы нажали «Запретить».</p>
                            <p>Но вы можете включить их вручную за 20 секунд:</p>
                        </div>

                        <div style="margin-top: 12px; font-size: 14px; line-height: 1.5; color: #333;">
                            <p><strong>Chrome / Opera (Android):</strong></p>
                            <p>1) Нажмите на <strong>замок</strong> слева от адреса</p>
                            <p>2) <strong>Настройки сайта</strong></p>
                            <p>3) <strong>Уведомления</strong> → <strong>Разрешить</strong></p>
                            <p style="margin-top: 10px;"><strong>iPhone Safari:</strong> уведомления зависят от версии iOS и часто работают только если сайт установлен как PWA.</p>
                        </div>

                        <div class="info-box" style="margin-top: 12px;">
                            <p>Сайт: <strong>${currentHost}</strong></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModalById('${modalId}')">Понятно</button>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);
    } catch (e) {
        console.error('Ошибка показа помощи по уведомлениям:', e);
    }
}

async function enableLocalNotifications() {
    try {
        // Toggle OFF
        if (isLocalNotificationsEnabled()) {
            setLocalNotificationsEnabled(false);
            updateLocalNotificationsUI();
            showNotification('🔕 Уведомления выключены', 'info');
            return true;
        }

        if (!("Notification" in window)) {
            showNotification('Браузер не поддерживает уведомления', 'warning');
            return false;
        }

        if (Notification.permission === 'granted') {
            setLocalNotificationsEnabled(true);
            updateLocalNotificationsUI();
            showNotification('🔔 Уведомления включены', 'success');
            return true;
        }

        if (Notification.permission === 'denied') {
            setLocalNotificationsEnabled(false);
            updateLocalNotificationsUI();

            // Нельзя вызвать системный запрос повторно. Показываем понятную инструкцию.
            const want = confirm('Уведомления запрещены в браузере. Показать инструкцию как включить?');
            if (want) {
                showNotificationsDeniedHelpModal();
            }
            return false;
        }

        const permission = await Notification.requestPermission();
        const enabled = permission === 'granted';
        setLocalNotificationsEnabled(enabled);
        updateLocalNotificationsUI();
        showNotification(enabled ? '🔔 Уведомления включены' : 'Уведомления не разрешены', enabled ? 'success' : 'warning');
        return enabled;
    } catch (e) {
        console.error('Ошибка enableLocalNotifications:', e);
        return false;
    }
}

function getShownNotificationIdsKey(phone) {
    return `shown_notification_ids_${phone || 'unknown'}`;
}

function hasShownNotification(phone, notificationId) {
    try {
        if (!phone || !notificationId) return false;
        const key = getShownNotificationIdsKey(phone);
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const ids = JSON.parse(raw);
        return Array.isArray(ids) ? ids.includes(notificationId) : false;
    } catch (e) {
        return false;
    }
}

function markNotificationShown(phone, notificationId) {
    try {
        if (!phone || !notificationId) return;
        const key = getShownNotificationIdsKey(phone);
        const raw = localStorage.getItem(key);
        const ids = raw ? JSON.parse(raw) : [];
        const safeIds = Array.isArray(ids) ? ids : [];

        if (!safeIds.includes(notificationId)) {
            safeIds.unshift(notificationId);
        }

        // Ограничиваем размер, чтобы не раздувать localStorage
        localStorage.setItem(key, JSON.stringify(safeIds.slice(0, 100)));
    } catch (e) {
        // ignore
    }
}

// ==================== PWA УСТАНОВКА ====================

let deferredPrompt; // Хранит событие beforeinstallprompt

function initializePWAInstall() {
    // Обработчик события beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        logToConsole('INFO', 'PWA: Получено событие beforeinstallprompt');
        e.preventDefault(); // Предотвращаем автоматическое показывание баннера
        deferredPrompt = e;

        // Показываем кнопку установки
        showInstallButton();
    });

    // Обработчик успешной установки
    window.addEventListener('appinstalled', (e) => {
        logToConsole('INFO', 'PWA: Приложение установлено');
        deferredPrompt = null;
        hideInstallButton();

        showNotification('✅ Приложение установлено!', 'success');
    });

    // Проверяем, установлено ли уже приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
        logToConsole('INFO', 'PWA: Приложение уже установлено (standalone mode)');
        hideInstallButton();
    }
}

function showInstallButton() {
    const installBtn = document.getElementById('install-pwa-btn');
    const installHint = document.getElementById('install-pwa-hint');

    if (installBtn) {
        installBtn.style.display = 'inline-block';
        installBtn.addEventListener('click', handleInstallClick);
        logToConsole('INFO', 'PWA: Кнопка установки показана');
    }

    if (installHint) {
        installHint.style.display = 'block';
    }
}

function hideInstallButton() {
    const installBtn = document.getElementById('install-pwa-btn');
    const installHint = document.getElementById('install-pwa-hint');

    if (installBtn) {
        installBtn.style.display = 'none';
        installBtn.removeEventListener('click', handleInstallClick);
        logToConsole('INFO', 'PWA: Кнопка установки скрыта');
    }

    if (installHint) {
        installHint.style.display = 'none';
    }
}

async function handleInstallClick() {
    if (!deferredPrompt) {
        logToConsole('WARN', 'PWA: deferredPrompt недоступен');
        showNotification('❌ Установка невозможна', 'error');
        return;
    }

    try {
        logToConsole('INFO', 'PWA: Запуск установки');
        deferredPrompt.prompt(); // Показываем диалог установки

        const { outcome } = await deferredPrompt.userChoice;

        logToConsole('INFO', 'PWA: Результат установки', { outcome });
        deferredPrompt = null;

        if (outcome === 'accepted') {
            logToConsole('INFO', 'PWA: Пользователь принял установку');
            hideInstallButton();
        } else {
            logToConsole('INFO', 'PWA: Пользователь отклонил установку');
            // Кнопка остается видимой для повторной попытки
        }
    } catch (error) {
        logToConsole('ERROR', 'PWA: Ошибка установки', error);
        showNotification('❌ Ошибка установки приложения', 'error');
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

/**
 * Основная функция инициализации приложения
 */
async function initializeApp() {
    try {
        logToConsole('INFO', 'Инициализация приложения', { version: CONFIG.APP_VERSION });
        ensureRegistrationState();

        // 1. Загрузка конфигурации
        await loadConfiguration();

        // 2. Проверка версии и очистка кэша
        checkVersionAndCleanup();

        // 3. Оптимизация для мобильных устройств
        optimizeForMobile();

        // 4. Восстановление состояния
        loadRegistrationState();
        ensureRegistrationState();

        // 5. Настройка обработчиков событий
        setupEventHandlers();

        // 6. Инициализация PWA установки
        initializePWAInstall();

        // 7. Инициализация системы уведомлений
        initializeNotificationSystem();

        // 8. Фоновые задачи
        startBackgroundTasks();

        // 9. Показ интерфейса
        showStep(registrationState.step);
        showOfflineDataCount();

        // Обновляем UI кнопок локальных уведомлений (если уже есть на странице)
        setTimeout(() => updateLocalNotificationsUI(), 0);

        logToConsole('INFO', 'Приложение успешно инициализировано');
    } catch (error) {
        logToConsole('ERROR', 'Критическая ошибка при инициализации', error);
        showNotification('❌ Ошибка инициализации приложения', 'error');
    }
}

/**
 * Загрузка конфигурации приложения
 */
function loadConfiguration() {
    return new Promise((resolve) => {
        try {
            if (window.CONFIG) {
                CONFIG = { ...CONFIG, ...window.CONFIG };
                logToConsole('INFO', 'Конфигурация загружена', { 
                    url: CONFIG.APP_SCRIPT_URL,
                    version: CONFIG.APP_VERSION 
                });
            }
            resolve();
        } catch (error) {
            logToConsole('ERROR', 'Ошибка загрузки конфигурации', error);
            resolve(); // Продолжаем работу с настройками по умолчанию
        }
    });
}

/**
 * Настройка всех обработчиков событий
 */
function setupEventHandlers() {
    // Основные обработчики
    setupPhoneInput();
    setupEventListeners();
    setupMobileTouchHandlers();
    
    // Обработчики изменения состояния сети
    setupNetworkHandlers();
}

/**
 * Настройка обработчиков работы с сетью
 */
function setupNetworkHandlers() {
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOfflineStatusChange);
}

/**
 * Обработчик восстановления соединения
 */
function handleOnlineStatusChange() {
    logToConsole('INFO', 'Соединение восстановлено');
    updateConnectionStatus(true);
    showNotification('🌐 Соединение восстановлено', 'success');
    
    // Пробуем отправить оффлайн данные с задержкой
    setTimeout(() => sendOfflineData(), 2000);
}

/**
 * Обработчик потери соединения
 */
function handleOfflineStatusChange() {
    logToConsole('WARN', 'Соединение потеряно');
    updateConnectionStatus(false);
    showNotification('⚠️ Нет соединения с интернетом', 'warning');
}

/**
 * Запуск фоновых задач
 */
function startBackgroundTasks() {
    // Загрузка ТОП данных с отложенным стартом
    setTimeout(loadTopDataWithRetry, 1000);
    
    // Тестирование соединения с API
    setTimeout(testAPIConnection, 1000);
    
    // Периодическая проверка оффлайн данных
    setInterval(checkConnectionAndSendOffline, 60000);
    
    // Очистка старых логов
    setTimeout(cleanupOldLogs, 5000);
}

/**
 * Загрузка ТОП данных с повторными попытками
 */
async function loadTopDataWithRetry(maxRetries = 3) {
    try {
        await loadTopData();
        logToConsole('INFO', 'Предварительная загрузка ТОП данных завершена');
    } catch (error) {
        logToConsole('ERROR', 'Ошибка загрузки ТОП данных', error);
        
        // Повторная попытка с экспоненциальной задержкой
        if (maxRetries > 0) {
            const delay = Math.pow(2, 4 - maxRetries) * 1000; // 1s, 2s, 4s
            logToConsole('INFO', `Повторная попытка через ${delay}мс...`);
            
            setTimeout(() => loadTopDataWithRetry(maxRetries - 1), delay);
        }
    }
}

/**
 * Очистка старых логов
 */
function cleanupOldLogs() {
    try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        if (logs.length > 200) {
            localStorage.setItem('app_logs', JSON.stringify(logs.slice(0, 200)));
            logToConsole('INFO', 'Очищены старые логи', { removed: logs.length - 200 });
        }
    } catch (error) {
        logToConsole('ERROR', 'Ошибка очистки логов', error);
    }
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', initializeApp);

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

/**
 * Настройка всех обработчиков событий
 */
function setupEventListeners() {
    // Обработка Enter в полях ввода
    document.addEventListener('keypress', handleKeyPress);
    
    // Обработка кликов по документу
    document.addEventListener('click', handleDocumentClick);
    
    // Обработка изменений состояния сети
    setupNetworkHandlers();
}

/**
 * Обработка нажатий клавиш
 */
function handleKeyPress(e) {
    // Enter в полях ввода
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        handleEnterKey(e.target);
    }
    
    // Esc для закрытия модальных окон
    if (e.key === 'Escape') {
        ModalManager.closeCurrent();
    }
}

/**
 * Обработка кликов по документу
 */
function handleDocumentClick(e) {
    // Закрытие модальных окон при клике вне контента
    const modal = e.target.closest('.modal');
    if (!modal && document.querySelector('.modal-overlay:not(.hidden)')) {
        ModalManager.closeCurrent();
    }
    
    // Делегированная обработка кликов по кнопкам
    if (e.target.matches('[data-action]')) {
        handleAction(e.target.dataset.action, e.target);
    }
}

/**
 * Обработка действий
 */
function handleAction(action, element) {
    const actions = {
        'submit-form': () => handleFormSubmit(element.closest('form')),
        'open-modal': () => openModal(element.dataset.target),
        'close-modal': () => closeModalById(element.closest('.modal-overlay').id),
        'go-back': () => goBack(),
        'refresh-data': () => refreshData()
        // Добавьте другие действия по мере необходимости
    };
    
    if (actions[action]) {
        actions[action]();
    } else {
        console.warn(`Неизвестное действие: ${action}`);
    }
}

/**
 * Настройка обработчиков сети
 */
function setupNetworkHandlers() {
    // Обработка изменения состояния сети
    const updateOnlineStatus = () => {
        const isOnline = navigator.onLine;
        StateManager.setState({
            ui: {
                isOnline,
                lastUpdate: new Date().toISOString()
            }
        });
        
        if (isOnline) {
            EventManager.emit('online');
            sendOfflineData();
        } else {
            EventManager.emit('offline');
        }
    };
    
    // Подписка на события изменения состояния сети
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Инициализация начального состояния
    updateOnlineStatus();
}

// ==================== ОБРАБОТКА МОБИЛЬНЫХ КАСАНИЙ ====================
function setupMobileTouchHandlers() {
    console.log('📱 Настройка обработки мобильных касаний...');
    
    // Обработчик для кнопки личного кабинета
    const cabinetBtn = document.querySelector('[onclick*="openDriverCabinetFromStep1"]');
    if (cabinetBtn) {
        if (cabinetBtn.dataset && cabinetBtn.dataset.mobileBound === '1') {
            return;
        }
        if (cabinetBtn.dataset) {
            cabinetBtn.dataset.mobileBound = '1';
        }

        // На мобильных НЕ блокируем событие preventDefault/stopPropagation,
        // иначе разные браузеры (Opera/Chrome) по-разному перестают генерировать click.
        cabinetBtn.addEventListener('pointerdown', function() {
            this.style.transform = 'scale(0.98)';
            this.style.opacity = '0.9';
        }, { passive: true });

        cabinetBtn.addEventListener('pointerup', function() {
            this.style.transform = '';
            this.style.opacity = '';
        }, { passive: true });
    }
    
    // Обработчик для кнопки начала регистрации ("Новая регистрация")
    const regBtn = document.querySelector('[onclick*="handlePhoneSubmit"]');
    if (regBtn) {
        if (regBtn.dataset && regBtn.dataset.mobileBound === '1') {
            return;
        }
        if (regBtn.dataset) {
            regBtn.dataset.mobileBound = '1';
        }

        regBtn.addEventListener('pointerdown', function() {
            this.style.transform = 'scale(0.98)';
            this.style.opacity = '0.9';
        }, { passive: true });

        regBtn.addEventListener('pointerup', function() {
            this.style.transform = '';
            this.style.opacity = '';
        }, { passive: true });
    }
    
    console.log('✅ Обработчики мобильных касаний настроены');
}

// ==================== ОПТИМИЗАЦИЯ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ ====================
function optimizeForMobile() {
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        console.log('📱 Обнаружено мобильное устройство');
        
        // Добавляем viewport meta тег если его нет
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
            document.head.appendChild(meta);
        }
        
        // Добавляем стили для мобильных устройств
        const mobileStyles = `
            /* Оптимизация для мобильных устройств */
            @media (max-width: 768px) {
                body {
                    -webkit-tap-highlight-color: transparent;
                    -webkit-touch-callout: none;
                    touch-action: manipulation;
                }
                
                button, .btn, .option-btn, .compact-brand-btn {
                    min-height: 44px;
                    min-width: 44px;
                    cursor: pointer;
                }
                
                .modal {
                    width: 95% !important;
                    margin: 10px !important;
                    max-height: 85vh !important;
                }
                
                .modal-body {
                    max-height: 60vh;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                input, textarea, select {
                    font-size: 16px !important; /* Предотвращает масштабирование в iOS */
                    min-height: 44px;
                }
                
                /* Предотвращение зума при фокусе на iOS */
                @supports (-webkit-touch-callout: none) {
                    input, textarea, select {
                        font-size: 16px;
                    }
                }
                
                .button-group.double {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .button-group.double .btn {
                    width: 100%;
                }
            }
            
            /* Исправление для iPhone X и выше */
            @supports (padding: max(0px)) {
                .modal-footer {
                    padding-bottom: max(15px, env(safe-area-inset-bottom)) !important;
                }
                
                body {
                    padding-left: env(safe-area-inset-left);
                    padding-right: env(safe-area-inset-right);
                }
            }
            
            /* Предотвращение выделения текста при тапах */
            .no-select {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            
            /* Плавные анимации для мобильных устройств */
            * {
                -webkit-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = mobileStyles;
        document.head.appendChild(style);
    }
}

// ==================== ОБРАБОТКА КЛАВИШИ ENTER ====================

function handleEnterKey(input) {
    const currentStep = registrationState.step;
    
    switch(currentStep) {
        case 1:
            handlePhoneSubmit();
            break;
        case 2:
            handleFioSubmit();
            break;
        case 3:
            // Если это поле для ручного ввода поставщика
            if (input.id === 'supplier-input') {
                handleManualSupplier();
            }
            break;
        case 6:
            // Если это поле для ручного ввода марки авто
            if (input.id === 'brand-input') {
                handleManualBrand();
            }
            break;
        case 7:
            handleVehicleNumberSubmit();
            break;
        case 8:
            handlePalletsSubmit();
            break;
        case 9:
            handleOrderSubmit();
            break;
        case 10:
            handleEtrnSubmit();
            break;
        default:
            // Для других шагов Enter не обрабатываем
            break;
    }
}

// ==================== НАВИГАЦИЯ ====================

function showStep(stepNumber) {
    logToConsole('INFO', `Переход к шагу: ${stepNumber}`);
    
    // Скрыть все шаги
    document.querySelectorAll('.step').forEach(step => {
        step.style.display = 'none';
    });
    
    // Показать нужный шаг
    const stepElement = document.querySelector(`[data-step="${stepNumber}"]`);
    if (stepElement) {
        stepElement.style.display = 'block';
        registrationState.step = stepNumber;
        saveRegistrationState();
        
        // Прокрутка вверх
        window.scrollTo(0, 0);
        
        // Фокус на первом поле ввода
        setTimeout(() => {
            const input = stepElement.querySelector('input');
            if (input) {
                input.focus();
            }
        }, 100);
    }
}

function goBack() {
    if (registrationState.step > 1) {
        showStep(registrationState.step - 1);
    }
}

// ==================== ШАГ 1: ТЕЛЕФОН ====================

function setupPhoneInput() {
    const phoneInput = document.getElementById('phone-input');
    if (!phoneInput) return;
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) value = value.substring(0, 10);
        
        // Форматирование: XXX XXX XX XX
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i === 3 || i === 6 || i === 8) formatted += ' ';
            formatted += value[i];
        }
        
        e.target.value = formatted;
    });
    
    // Фокус при загрузке
    setTimeout(() => phoneInput.focus(), 500);
}

async function handlePhoneSubmit() {
    const phoneInput = document.getElementById('phone-input');
    if (!phoneInput) return;
    
    const phone = phoneInput.value.replace(/\s/g, '');
    
    if (!phone || phone.length < 10) {
        showNotification('Пожалуйста, введите корректный номер телефона (10 цифр)', 'error');
        phoneInput.focus();
        return;
    }
    
    // Нормализуем телефон
    const normalizedPhone = normalizePhone(phone);
    registrationState.data.phone = normalizedPhone;
    logToConsole('INFO', 'Телефон сохранен', { phone: normalizedPhone });
    
    showStep(2);
}

// ==================== ШАГ 2: ФИО ====================

function handleFioSubmit() {
    const fioInput = document.getElementById('fio-input');
    if (!fioInput) return;
    
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО (не менее 5 символов)', 'error');
        fioInput.focus();
        return;
    }
    
    registrationState.data.fio = fio;
    logToConsole('INFO', 'ФИО сохранено', { fio });
    
    // Используем оптимизированный поиск поставщиков
    loadSupplierHistoryOptimized();
    showStep(3);
}

// ==================== ШАГ 3: ПОСТАВЩИКИ (ОПТИМИЗИРОВАННЫЙ) ====================

async function loadSupplierHistoryOptimized() {
  logToConsole('INFO', 'Оптимизированный поиск поставщиков', {
    phone: registrationState.data.phone
  });
  
  const container = document.getElementById('supplier-buttons');
  const infoBox = document.getElementById('supplier-history-info');
  const searchIndicator = document.getElementById('supplier-search-indicator');
  
  if (!container || !infoBox || !searchIndicator) return;
  
  // Показываем индикатор поиска
  searchIndicator.style.display = 'block';
  infoBox.style.display = 'none';
  container.innerHTML = '';
  
  if (!registrationState.data.phone) {
    searchIndicator.style.display = 'none';
    infoBox.style.display = 'block';
    infoBox.innerHTML = '<p>❌ Нет номера телефона для поиска</p>';
    return;
  }
  
  try {
    // 1. Сначала пробуем найти в локальных ТОП данных
    const topData = await loadTopData();
    
    if (topData && topData.phoneSuppliers) {
      const cleanPhone = normalizePhone(registrationState.data.phone);
      const last7Digits = cleanPhone.slice(-7);
      
      let suppliers = [];
      
      // Ищем в локальных данных
      // Прямое совпадение
      if (topData.phoneSuppliers[cleanPhone]) {
        suppliers = topData.phoneSuppliers[cleanPhone];
      }
      
      // Поиск по последним 7 цифрам
      if (suppliers.length === 0) {
        Object.keys(topData.phoneSuppliers).forEach(storedPhone => {
          if (storedPhone.slice(-7) === last7Digits) {
            suppliers = suppliers.concat(topData.phoneSuppliers[storedPhone]);
          }
        });
      }
      
      // Убираем дубликаты
      const uniqueSuppliers = [...new Set(suppliers)];
      
      if (uniqueSuppliers.length > 0) {
        logToConsole('INFO', 'Поставщики найдены в локальных ТОП данных', {
          count: uniqueSuppliers.length,
          source: 'local_cache'
        });
        
        // Скрываем индикатор, показываем результаты
        searchIndicator.style.display = 'none';
        infoBox.style.display = 'block';
        displaySuppliers(uniqueSuppliers, container, infoBox);
        return;
      }
    }
    
    // 2. Если в локальных данных не нашли, запрашиваем с сервера
    logToConsole('INFO', 'Запрашиваю поставщиков с сервера');
    
    const response = await sendAPIRequest({
      action: 'get_suppliers_optimized',
      phone: registrationState.data.phone
    });
    
    if (response && response.success && response.suppliers && response.suppliers.length > 0) {
      logToConsole('INFO', 'Поставщики получены с сервера', {
        count: response.suppliers.length,
        searchMethod: response.searchMethod
      });
      
      // Скрываем индикатор, показываем результаты
      searchIndicator.style.display = 'none';
      infoBox.style.display = 'block';
      displaySuppliers(response.suppliers, container, infoBox);
      
    } else {
      const errorMessage = response?.message || 'История поставщиков не найдена';
      
      // Скрываем индикатор, показываем сообщение
      searchIndicator.style.display = 'none';
      infoBox.style.display = 'block';
      infoBox.innerHTML = `<p>📭 ${errorMessage}</p>`;
      container.innerHTML = '<div class="info-box info">История не найдена. Введите поставщика вручную.</div>';
    }
    
  } catch (error) {
    logToConsole('ERROR', 'Ошибка поиска поставщиков', error);
    
    // Скрываем индикатор, показываем ошибку
    searchIndicator.style.display = 'none';
    infoBox.style.display = 'block';
    infoBox.innerHTML = `
      <p>⚠️ Ошибка загрузки истории</p>
      <p style="font-size: 12px; color: #666;">Вы можете ввести поставщика вручную ниже</p>
    `;
    
    container.innerHTML = `
      <div class="info-box warning">
        <p>Ошибка загрузки истории поставщиков</p>
      </div>
    `;
  }
}

function filterCaseInsensitive(items, searchText) {
  if (!searchText || searchText.trim() === '') {
    return items;
  }
  
  const searchLower = searchText.toLowerCase();
  return items.filter(item => {
    if (!item) return false;
    return item.toLowerCase().includes(searchLower);
  });
}

// Вспомогательная функция для отображения поставщиков
function displaySuppliers(suppliers, container, infoBox) {
  infoBox.innerHTML = `
    <p>✅ Найдено поставщиков: ${suppliers.length}</p>
    <p style="font-size: 12px; color: #666;">Выберите из истории (регистр не учитывается):</p>
  `;
  
  container.innerHTML = '';
  
  // Убираем дубликаты с учетом регистра
  const uniqueSuppliersMap = new Map();
  suppliers.forEach(supplier => {
    if (supplier && supplier.trim() !== '') {
      const supplierLower = supplier.toLowerCase();
      if (!uniqueSuppliersMap.has(supplierLower)) {
        uniqueSuppliersMap.set(supplierLower, supplier); // Сохраняем оригинальный регистр
      }
    }
  });
  
  const uniqueSuppliers = Array.from(uniqueSuppliersMap.values());
  
  uniqueSuppliers.forEach((supplier, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-btn';
    button.innerHTML = `
      <span class="option-number">${index + 1}</span>
      <span class="option-text">${supplier}</span>
    `;
    button.onclick = () => {
      logToConsole('INFO', 'Выбран поставщик из истории', { 
        supplier,
        index: index + 1
      });
      selectSupplier(supplier);
    };
    container.appendChild(button);
  });
}

function selectSupplier(supplier) {
    logToConsole('INFO', 'Выбран поставщик', { supplier });
    registrationState.data.supplier = supplier;
    showStep(4);
}

function handleManualSupplier() {
    const supplierInput = document.getElementById('supplier-input');
    if (!supplierInput) return;
    
    const supplier = supplierInput.value.trim();
    
    if (!supplier) {
        showNotification('Пожалуйста, введите название поставщика', 'error');
        supplierInput.focus();
        return;
    }
    
    registrationState.data.supplier = supplier;
    logToConsole('INFO', 'Поставщик сохранен', { supplier });
    showStep(4);
}

// ==================== ШАГ 4: ЮРЛИЦО ====================

function selectLegalEntity(entity) {
    logToConsole('INFO', 'Выбрано юрлицо', { entity });
    registrationState.data.legalEntity = entity;
    showStep(5);
}

// ==================== ШАГ 5: ТИП ТОВАРА ====================

function selectProductType(type) {
    logToConsole('INFO', 'Выбран тип товара', { type });
    registrationState.data.productType = type;
    
    // ИСПРАВЛЕНИЕ: НЕ сохраняем gate в registrationState
    // Просто вычисляем для информации
    const gateForInfo = assignGateAutomatically(registrationState.data.legalEntity, type);
    logToConsole('INFO', 'Назначены ворота (только для информации)', { gate: gateForInfo });
    
    // НЕ ЗАГРУЖАЕМ марки - они уже в HTML
    showStep(6);
}

// ==================== ШАГ 6: МАРКА АВТО (ОПТИМИЗИРОВАННАЯ) ====================
async function loadPopularBrandsOptimized() {
  logToConsole('INFO', 'Загрузка компактного списка марок авто');
  
  const container = document.getElementById('brand-buttons');
  const infoBox = document.getElementById('brands-info');
  
  if (!container) return;
  
  // Очищаем контейнер
  container.innerHTML = '';
  
  try {
    // Получаем список марок с сервера
    const response = await sendAPIRequest({
      action: 'get_brands_optimized'
    });
    
    if (response && response.success && response.brands && response.brands.length > 0) {
      logToConsole('INFO', 'Марки получены с сервера', {
        count: response.brands.length,
        fixedList: response.fixedList || false
      });
      
      displayCompactBrands(response.brands, container);
      
    } else {
      // Fallback: фиксированный список
      logToConsole('WARN', 'Использую фиксированный список марок');
      showFixedBrands(container);
    }
    
  } catch (error) {
    logToConsole('ERROR', 'Ошибка загрузки марок авто', error);
    
    // В случае ошибки показываем фиксированный список
    showFixedBrands(container);
  }
}

// Обновленная функция отображения марок (только 5)
function displayBrands(brands, container, infoBox) {
  container.innerHTML = '';
  
  // Показываем заголовок с количеством
  if (infoBox) {
    infoBox.innerHTML = `
      <p>🚗 <strong>ТОП-${Math.min(brands.length, 5)} популярных марок авто</strong> (из истории регистраций):</p>
      ${brands.length < 5 ? `<p style="font-size: 12px; color: #666;">Найдено только ${brands.length} уникальных марок</p>` : ''}
    `;
  }
  
  // Ограничиваем до 5 марок
  const top5Brands = brands.slice(0, 5);
  
  top5Brands.forEach((brand, index) => {
    if (!brand || brand.trim() === '') return;
    
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-btn';
    button.innerHTML = `
      <span class="option-number">${index + 1}</span>
      <span class="option-text">${brand}</span>
    `;
    button.onclick = () => {
      logToConsole('INFO', 'Выбрана марка авто', { 
        brand,
        index: index + 1
      });
      selectBrand(brand);
    };
    container.appendChild(button);
  });
  
  logToConsole('SUCCESS', `Отображено ${top5Brands.length} марок авто (ТОП-5)`);
}

// Функция для отображения компактного списка марок (в 3 столбца)
function displayCompactBrands(brands, container) {
  if (!container) return;
  
  // Фильтруем пустые и цифровые марки
  const filteredBrands = brands.filter(brand => 
    brand && brand.trim() !== '' && !/^\d+$/.test(brand.trim())
  );
  
  // Создаем компактную сетку
  const grid = document.createElement('div');
  grid.className = 'brands-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
  grid.style.gap = '10px';
  grid.style.marginBottom = '20px';
  
  filteredBrands.forEach((brand, index) => {
    if (index >= 15) return; // Ограничиваем до 15 марок максимум
    
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compact-brand-btn';
    button.innerHTML = `
      <span class="brand-text">${brand}</span>
    `;
    button.title = brand;
    button.onclick = () => {
      logToConsole('INFO', 'Выбрана марка авто', { 
        brand,
        index: index + 1
      });
      selectBrand(brand);
    };
    
    grid.appendChild(button);
  });
  
  container.innerHTML = '';
  container.appendChild(grid);
  
  logToConsole('SUCCESS', `Отображено ${Math.min(filteredBrands.length, 15)} марок в компактном виде`);
}

// Функция показа фиксированного списка (если сервер не отвечает)
function showFixedBrands(container) {
  if (!container) return;
  
  const fixedBrands = [
    'Газель',
    'Газель NEXT',
    'DAF',
    'Dongfeng',
    'JAC',
    'KAMAZ',
    'MAN',
    'Мерседес',
    'Рено',
    'Ситрак',
    'Скания',
    'Хендай',
    'VOLVO'
  ];
  
  displayCompactBrands(fixedBrands, container);
}

// Обновленная функция показа стандартных марок (только 5)
function showDefaultBrands(container, infoBox) {
  if (!container) return;
  
  const defaultBrands = [
    'Газель',
    'Mercedes',
    'Volvo',
    'Scania',
    'MAN'
  ];
  
  // Показываем заголовок
  if (infoBox) {
    infoBox.innerHTML = '<p>🚗 <strong>ТОП-5 популярных марок авто</strong> (стандартный список):</p>';
  }
  
  container.innerHTML = '';
  
  defaultBrands.slice(0, 5).forEach((brand, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-btn';
    button.innerHTML = `
      <span class="option-number">${index + 1}</span>
      <span class="option-text">${brand}</span>
    `;
    button.onclick = () => {
      logToConsole('INFO', 'Выбрана стандартная марка', { 
        brand,
        index: index + 1
      });
      selectBrand(brand);
    };
    container.appendChild(button);
  });
}

function selectBrand(brand) {
    logToConsole('INFO', 'Выбрана марка авто', { brand });
    registrationState.data.vehicleType = brand;
    showStep(7);
}

function handleManualBrand() {
    const brandInput = document.getElementById('brand-input');
    if (!brandInput) return;
    
    const brand = brandInput.value.trim();
    
    if (!brand) {
        showNotification('Пожалуйста, введите марку авто', 'error');
        brandInput.focus();
        return;
    }
    
    registrationState.data.vehicleType = brand;
    logToConsole('INFO', 'Марка авто сохранена', { brand });
    showStep(7);
}

// ==================== ШАГ 7: НОМЕР ТС ====================

function handleVehicleNumberSubmit() {
    const input = document.getElementById('vehicle-number-input');
    if (!input) return;
    
    const vehicleNumber = input.value.trim().toUpperCase();
    
    if (!vehicleNumber) {
        showNotification('Пожалуйста, введите номер транспортного средства', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.vehicleNumber = vehicleNumber;
    logToConsole('INFO', 'Номер ТС сохранен', { vehicleNumber });
    showStep(8);
}

// ==================== ШАГ 8: ПОДДОНЫ ====================

function handlePalletsSubmit() {
    const input = document.getElementById('pallets-input');
    if (!input) return;
    
    const pallets = parseInt(input.value);
    
    if (isNaN(pallets) || pallets < 0) {
        showNotification('Пожалуйста, введите корректное количество поддонов (0 или больше)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.pallets = pallets;
    logToConsole('INFO', 'Поддоны сохранены', { pallets });
    showStep(9);
}

// ==================== ШАГ 9: НОМЕР ЗАКАЗА ====================

function handleOrderSubmit() {
    const input = document.getElementById('order-input');
    if (!input) return;
    
    const orderNumber = input.value.trim();
    
    if (!orderNumber) {
        showNotification('Пожалуйста, введите номер заказа (0 если неизвестен)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.orderNumber = orderNumber;
    logToConsole('INFO', 'Номер заказа сохранен', { orderNumber });
    showStep(10);
}

function skipOrderNumber() {
    const input = document.getElementById('order-input');
    if (input) {
        input.value = '0';
    }

    registrationState.data.orderNumber = '0';
    logToConsole('INFO', 'Номер заказа пропущен (0)');
    showStep(10);
}

// ==================== ШАГ 10: ЭТРН ====================

function handleEtrnSubmit() {
    const input = document.getElementById('etrn-input');
    if (!input) return;
    
    const etrn = input.value.trim();
    
    if (!etrn) {
        showNotification('Пожалуйста, введите номер ЭТрН (0 если нет)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.etrn = etrn;
    logToConsole('INFO', 'ЭТрН сохранен', { etrn });
    showStep(11);
}

function skipEtrn() {
    const input = document.getElementById('etrn-input');
    if (input) {
        input.value = '0';
    }

    registrationState.data.etrn = '0';
    logToConsole('INFO', 'ЭТрН пропущен (0)');
    showStep(11);
}

// ==================== ШАГ 11: ТРАНЗИТ ====================

function selectTransit(answer) {
    logToConsole('INFO', 'Выбран ответ по транзиту', { answer });
    registrationState.data.transit = answer;
    
    // Обновляем дату и время
    const now = new Date();
    registrationState.data.date = formatDate(now);
    registrationState.data.time = formatTime(now);
    
    // Проверяем нарушение графика (для столбца S)
    registrationState.data.scheduleViolation = checkScheduleViolation() ? 'Да' : 'Нет';
    
    // НЕ добавляем поле problemTypes - столбец Q должен быть пустым
    // Удаляем поле если оно было создано ранее
    delete registrationState.data.problemTypes;
    
    logToConsole('INFO', 'Нарушение графика', { 
        violation: registrationState.data.scheduleViolation,
        time: now.toLocaleTimeString(),
        productType: registrationState.data.productType
    });
    
    // Показываем подтверждение
    showConfirmation();
    showStep(12);
}

// ==================== ШАГ 12: ПОДТВЕРЖДЕНИЕ ====================
function showConfirmation() {
    logToConsole('INFO', 'Показываю подтверждение');
    
    const container = document.getElementById('data-review');
    if (!container) return;
    
    const data = registrationState.data;
    
    // ИСПРАВЛЕНИЕ: Вычисляем ворота для отображения, но НЕ сохраняем
    const gateForDisplay = assignGateAutomatically(data.legalEntity, data.productType) || 'Не назначены';
    
    let html = `
        <div class="data-item">
            <span class="data-label">📱 Телефон:</span>
            <span class="data-value">${formatPhoneDisplay(data.phone)}</span>
        </div>
        <div class="data-item">
            <span class="data-label">👤 ФИО:</span>
            <span class="data-value">${data.fio || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🏢 Поставщик:</span>
            <span class="data-value">${data.supplier || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🏛️ Юрлицо:</span>
            <span class="data-value">${data.legalEntity || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📦 Тип товара:</span>
            <span class="data-value">${data.productType || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🚗 Марка авто:</span>
            <span class="data-value">${data.vehicleType || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🔢 Номер ТС:</span>
            <span class="data-value">${data.vehicleNumber || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📦 Поддоны:</span>
            <span class="data-value">${data.pallets || 0}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📋 Номер заказа:</span>
            <span class="data-value">${data.orderNumber || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📱 ЭТрН:</span>
            <span class="data-value">${data.etrn || ''}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🔄 Транзит:</span>
            <span class="data-value">${data.transit || ''}</span>
        </div>
        <div class="data-item highlight">
            <span class="data-label">🚪 Ваши ворота:</span>
            <span class="data-value">${gateForDisplay}</span>
        </div>
        <div class="data-item">
            <span class="data-label">⏰ Опоздание по графику:</span>
            <span class="data-value">${data.scheduleViolation || 'Нет'}</span>
        </div>
    `;
    
    container.innerHTML = html;
}

// ==================== ШАГ 13: ОТПРАВКА ====================
// ==================== ПОЛНАЯ ФУНКЦИЯ SUBMITREGISTRATION ====================
async function submitRegistration() {
    logToConsole('INFO', 'Начинаю отправку регистрации', {
        data: registrationState.data,
        connectionStatus: navigator.onLine ? 'online' : 'offline'
    });

    try {
        if (("Notification" in window) && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    } catch (e) {
        // ignore
    }
    
    // СОХРАНЯЕМ ТЕЛЕФОН ПЕРЕД ОЧИСТКОЙ
    const driverPhone = registrationState.data.phone;
    const driverName = registrationState.data.fio;
    
    // ДЕБАГ: Выводим данные перед отправкой
    console.log('=== ДАННЫЕ ПЕРЕД ОТПРАВКОЙ ===');
    console.log('Оригинальный телефон:', registrationState.data.phone);
    console.log('Тип телефона:', typeof registrationState.data.phone);
    console.log('Поле gate:', registrationState.data.gate);
    
    // ИСПРАВЛЕНИЕ 1: Принудительная нормализация телефона
    registrationState.data.phone = normalizePhone(registrationState.data.phone);
    console.log('Нормализованный телефон:', registrationState.data.phone);
    
    // ИСПРАВЛЕНИЕ 2: Удаляем поле gate
    if (registrationState.data.gate) {
        console.log('⚠️ Удаляю поле gate:', registrationState.data.gate);
        delete registrationState.data.gate;
    }
    
    // Проверяем заполненность обязательных полей
    const requiredFields = ['phone', 'fio', 'supplier', 'legalEntity', 'productType', 'vehicleNumber'];
    const missingFields = requiredFields.filter(field => !registrationState.data[field]);
    
    if (missingFields.length > 0) {
        showNotification(`Заполните обязательные поля: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // ИСПРАВЛЕНИЕ 3: Копируем данные и удаляем лишние поля
    const dataToSend = {...registrationState.data};
    
    // Убедимся, что удалили все лишние поля
    delete dataToSend.gate;
    delete dataToSend.problemTypes;
    
    console.log('=== ДАННЫЕ ДЛЯ ОТПРАВКИ (после очистки) ===');
    console.log(JSON.stringify(dataToSend, null, 2));
    console.log('Поле gate в dataToSend:', dataToSend.gate);
    
    // Проверяем соединение
    if (!navigator.onLine) {
        logToConsole('WARN', 'Нет соединения с интернетом');
        showNotification('⚠️ Нет соединения с интернетом. Данные будут сохранены локально.', 'warning');
        
        // Удаляем gate из оффлайн данных
        delete registrationState.data.gate;
        
        const saved = saveRegistrationOffline();
        if (saved) {
            // СОХРАНЯЕМ ДАННЫЕ ДЛЯ ЛИЧНОГО КАБИНЕТА ДАЖЕ В ОФФЛАЙН РЕЖИМЕ
            saveDriverRegistrationData();
            
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
        }
        return;
    }
    
    showLoader(true);
    
    try {
        // Добавляем временную метку
        dataToSend._timestamp = Date.now();
        dataToSend._localId = `local_${dataToSend._timestamp}_${Math.random().toString(36).substr(2, 6)}`;
        dataToSend._attempt = 1;
        dataToSend._sentFrom = 'online_submit';
        
        const response = await sendRegistrationToServer(dataToSend);
        
        if (response && response.success) {
            logToConsole('SUCCESS', 'Регистрация успешна на сервере!');
            
            // Удаляем gate из локального состояния
            delete registrationState.data.gate;
            
            // ВАЖНО: СОХРАНЯЕМ ДАННЫЕ ДЛЯ ЛИЧНОГО КАБИНЕТА
            saveDriverRegistrationData();
            
            // СОХРАНЯЕМ ТЕЛЕФОН И ФИО ДЛЯ ЛИЧНОГО КАБИНЕТА
            saveDriverInfoForCabinet(driverPhone, driverName);
            
            showSuccessMessage(response.data);
            resetRegistrationState();
            showStep(13);
            showNotification('✅ Регистрация успешно завершена!', 'success');
        } else {
            logToConsole('ERROR', 'Ошибка от сервера', response);
            
            // Удаляем gate при сохранении оффлайн
            delete registrationState.data.gate;
            
            const saved = saveRegistrationOffline();
            if (saved) {
                // СОХРАНЯЕМ ДАННЫЕ ДЛЯ ЛИЧНОГО КАБИНЕТА ДАЖЕ ПРИ ОШИБКЕ
                saveDriverRegistrationData();
                
                // СОХРАНЯЕМ ТЕЛЕФОН И ФИО ДЛЯ ЛИЧНОГО КАБИНЕТА
                saveDriverInfoForCabinet(driverPhone, driverName);
                
                showSuccessMessage();
                resetRegistrationState();
                showStep(13);
                showNotification('📱 Данные сохранены локально для повторной отправки.', 'warning');
            }
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Критическая ошибка отправки', error);
        
        // Удаляем gate при сохранении оффлайн
        delete registrationState.data.gate;
        
        const saved = saveRegistrationOffline();
        if (saved) {
            logToConsole('INFO', 'Данные сохранены оффлайн');
            
            // СОХРАНЯЕМ ДАННЫЕ ДЛЯ ЛИЧНОГО КАБИНЕТА ДАЖЕ ПРИ ОШИБКЕ
            saveDriverRegistrationData();
            
            // СОХРАНЯЕМ ТЕЛЕФОН И ФИО ДЛЯ ЛИЧНОГО КАБИНЕТА
            saveDriverInfoForCabinet(driverPhone, driverName);
            
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            showNotification('📱 Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        }
    } finally {
        showLoader(false);
    }
}

// ==================== СОХРАНЕНИЕ ДАННЫХ ДЛЯ ЛИЧНОГО КАБИНЕТА ====================
function saveDriverInfoForCabinet(phone, name) {
    try {
        if (!phone) return;
        
        const driverInfo = {
            phone: normalizePhone(phone),
            name: name || '',
            lastAccess: Date.now(),
            lastRegistration: new Date().toISOString()
        };
        
        // Сохраняем в localStorage
        localStorage.setItem('driver_info_for_cabinet', JSON.stringify(driverInfo));
        
        // Также сохраняем отдельно для быстрого доступа
        localStorage.setItem('last_driver_phone', phone);
        if (name) {
            localStorage.setItem('last_driver_name', name);
        }
        
        logToConsole('INFO', 'Данные для личного кабинета сохранены', driverInfo);
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка сохранения данных для кабинета', error);
    }
}

// ==================== ФУНКЦИЯ ОТПРАВКИ НА СЕРВЕР ====================

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

// ==================== АЛЬТЕРНАТИВНЫЙ МЕТОД ОТПРАВКИ ====================

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

// ==================== API ФУНКЦИИ ====================

// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ API ====================
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

// ==================== ОФФЛАЙН СОХРАНЕНИЕ ====================

function saveRegistrationOffline() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        const offlineId = 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const offlineRecord = {
            id: offlineId,
            data: registrationState.data,
            timestamp: new Date().toISOString(),
            attempts: 0,
            status: 'pending',
            lastError: null
        };
        
        offlineRegistrations.push(offlineRecord);
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        logToConsole('INFO', 'Данные сохранены оффлайн', { 
            id: offlineId, 
            total: offlineRegistrations.length 
        });
        
        showOfflineDataCount();
        
        return true;
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка сохранения оффлайн', error);
        return false;
    }
}

// ==================== ОТПРАВКА ОФФЛАЙН ДАННЫХ ====================

async function sendOfflineData(resetAttempts = false) {
    if (!navigator.onLine) {
        logToConsole('WARN', 'Нет соединения, пропускаю отправку оффлайн данных');
        return;
    }
    
    try {
        logToConsole('INFO', 'Начинаю отправку оффлайн данных', { resetAttempts });
        
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        if (resetAttempts) {
            offlineRegistrations.forEach(record => {
                if (record.status === 'pending') {
                    record.attempts = 0;
                    record.lastError = null;
                    logToConsole('INFO', `Сброшены попытки для записи ${record.id}`);
                }
            });
            localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
            showNotification('✅ Счетчики попыток сброшены', 'success');
        }
        
        const pendingRecords = offlineRegistrations.filter(r => r.status === 'pending');
        
        if (pendingRecords.length === 0) {
            logToConsole('INFO', 'Нет записей для отправки');
            showNotification('📭 Нет записей для отправки', 'info');
            return;
        }
        
        logToConsole('INFO', `Найдено ${pendingRecords.length} записей для отправки`);
        
        const successful = [];
        const failed = [];
        
        for (const record of pendingRecords) {
            if (record.attempts >= 5 && !resetAttempts) {
                logToConsole('WARN', `Запись ${record.id} превысила лимит попыток`, { 
                    attempts: record.attempts,
                    lastError: record.lastError 
                });
                continue;
            }
            
            record.data._offlineId = record.id;
            record.data._offlineAttempt = (record.attempts || 0) + 1;
            record.data._sentFrom = 'offline_retry';
            
            try {
                logToConsole('INFO', `Отправляю запись ${record.id}`, { 
                    attempt: record.attempts + 1,
                    offlineId: record.id,
                    phone: record.data.phone
                });
                
                const response = await sendRegistrationToServer(record.data);
                
                logToConsole('INFO', `Ответ для записи ${record.id}`, {
                    success: response.success,
                    message: response.message,
                    serverId: response.data?.registrationId
                });
                
                if (response && response.success) {
                    if (response.message && response.message.includes('уже зарегистрирован')) {
                        record.status = 'duplicate';
                        record.duplicateAt = new Date().toISOString();
                        record.response = response;
                        successful.push({id: record.id, type: 'duplicate'});
                        logToConsole('WARN', `Запись ${record.id} - дубликат`);
                    } else {
                        record.status = 'sent';
                        record.sentAt = new Date().toISOString();
                        record.response = response;
                        successful.push(record.id);
                        logToConsole('SUCCESS', `Запись ${record.id} отправлена успешно`);
                    }
                } else {
                    record.attempts = (record.attempts || 0) + 1;
                    record.lastError = response?.message || 'Неизвестная ошибка сервера';
                    record.lastAttempt = new Date().toISOString();
                    failed.push(record.id);
                    logToConsole('ERROR', `Ошибка отправки записи ${record.id}`, {
                        error: record.lastError,
                        attempts: record.attempts,
                        response: response
                    });
                }
                
            } catch (error) {
                record.attempts = (record.attempts || 0) + 1;
                record.lastError = error.message;
                record.lastAttempt = new Date().toISOString();
                failed.push(record.id);
                logToConsole('ERROR', `Ошибка отправки записи ${record.id}`, {
                    error: error.message,
                    stack: error.stack,
                    attempts: record.attempts
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        }
        
        cleanupOldOfflineRecords();
        
        showOfflineDataCount();
        
        if (successful.length > 0) {
            const sentCount = successful.filter(s => typeof s === 'string').length;
            const duplicateCount = successful.filter(s => typeof s === 'object' && s.type === 'duplicate').length;
            
            let message = '';
            if (sentCount > 0) {
                message += `✅ ${sentCount} оффлайн записей отправлено`;
            }
            if (duplicateCount > 0) {
                if (message) message += '\n';
                message += `⚠️ ${duplicateCount} записей уже были в системе (дубликаты)`;
            }
            
            showNotification(message, 'success');
        }
        
        if (failed.length > 0) {
            showNotification(`⚠️ ${failed.length} записей не удалось отправить. Попыток: ${pendingRecords[0]?.attempts || 0}/5`, 'warning');
        }
        
        if (successful.length === 0 && failed.length === 0) {
            showNotification('📭 Все записи превысили лимит попыток. Нажмите "Сбросить попытки" для повторной отправки.', 'info');
        }
        
        logToConsole('INFO', 'Итог отправки оффлайн данных', { 
            successful: successful.length, 
            failed: failed.length,
            total: pendingRecords.length 
        });
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка отправки оффлайн данных', error);
        showNotification('❌ Ошибка при отправке оффлайн данных', 'error');
    }
}

// ==================== ФУНКЦИЯ СБРОСА ПОПЫТОК ====================

function resetOfflineAttempts() {
    if (confirm('Сбросить счетчики попыток для всех оффлайн записей?\n\nЭто позволит повторно отправить записи, которые превысили лимит попыток.')) {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        let resetCount = 0;
        
        offlineRegistrations.forEach(record => {
            if (record.status === 'pending' && record.attempts >= 5) {
                record.attempts = 0;
                record.lastError = null;
                record.lastAttempt = null;
                resetCount++;
            }
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        showNotification(`✅ Сброшены попытки для ${resetCount} записей`, 'success');
        logToConsole('INFO', 'Сброшены счетчики попыток', { resetCount });
        
        closeModalById('offline-data-modal');
        
        showOfflineDataCount();
        
        setTimeout(() => sendOfflineData(true), 1000);
    }
}

// ==================== ПОКАЗ ОФФЛАЙН ДАННЫХ ====================

function getOfflineDataCount() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        const pendingRecords = offlineRegistrations.filter(r => r.status === 'pending');
        return pendingRecords.length;
    } catch (error) {
        logToConsole('ERROR', 'Ошибка получения количества оффлайн данных', error);
        return 0;
    }
}

function showOfflineDataCount() {
    const count = getOfflineDataCount();
    const indicator = document.getElementById('offline-data-indicator');
    
    if (indicator) {
        if (count > 0) {
            indicator.innerHTML = `<span style="color: #ff9800; font-weight: bold;">📱 ${count} оффлайн записей</span>`;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }
}

function showOfflineDataModal() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        const pendingRecords = offlineRegistrations.filter(r => r.status === 'pending');
        const sentRecords = offlineRegistrations.filter(r => r.status === 'sent');
        
        const exceededRecords = pendingRecords.filter(r => r.attempts >= 5);
        
        let html = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">📱 Оффлайн данные</h3>
                        <button class="modal-close" onclick="closeModal(event)">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="stats-grid" style="margin-bottom: 20px;">
                            <div class="stat-card">
                                <div class="stat-value">${pendingRecords.length}</div>
                                <div class="stat-label">Ожидают отправки</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${sentRecords.length}</div>
                                <div class="stat-label">Уже отправлены</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${exceededRecords.length}</div>
                                <div class="stat-label">Превышен лимит</div>
                            </div>
                        </div>
        `;
        
        if (exceededRecords.length > 0) {
            html += `
                <div class="warning-box" style="margin-bottom: 20px;">
                    <p>⚠️ <strong>ВНИМАНИЕ!</strong> У ${exceededRecords.length} записей превышен лимит попыток отправки (5).</p>
                    <p>Нажмите "Сбросить попытки" чтобы попробовать отправить их снова.</p>
                </div>
            `;
        }
        
        if (pendingRecords.length > 0) {
            html += `
                <h4>Записи ожидающие отправки:</h4>
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
            `;
            
            pendingRecords.forEach((record, index) => {
                const isExceeded = record.attempts >= 5;
                const badgeClass = isExceeded ? 'badge-error' : 'badge-warning';
                const badgeText = isExceeded ? 'Превышен лимит' : 'Ожидает';
                
                html += `
                    <div class="card" style="margin-bottom: 10px; border-left: 4px solid ${isExceeded ? '#f44336' : '#ff9800'};">
                        <div class="card-header">
                            <div class="card-title">Запись ${index + 1} - ${record.data.fio || 'Без ФИО'}</div>
                            <div class="badge ${badgeClass}">${badgeText}</div>
                        </div>
                        <div class="card-body">
                            <p><strong>ФИО:</strong> ${record.data.fio || 'Нет'}</p>
                            <p><strong>Телефон:</strong> ${formatPhoneDisplay(record.data.phone || '')}</p>
                            <p><strong>Поставщик:</strong> ${record.data.supplier || 'Нет'}</p>
                            <p><strong>Дата создания:</strong> ${new Date(record.timestamp).toLocaleString('ru-RU')}</p>
                            <p><strong>Попыток отправки:</strong> ${record.attempts || 0}/5</p>
                            ${record.lastAttempt ? `<p><strong>Последняя попытка:</strong> ${new Date(record.lastAttempt).toLocaleString('ru-RU')}</p>` : ''}
                            ${record.lastError ? `<p style="color: #f44336;"><strong>Последняя ошибка:</strong> ${record.lastError}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        if (sentRecords.length > 0) {
            html += `
                <h4>Успешно отправленные записи:</h4>
                <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
            `;
            
            sentRecords.slice(0, 5).forEach((record, index) => {
                html += `
                    <div class="card" style="margin-bottom: 10px;">
                        <div class="card-header">
                            <div class="card-title">Запись ${index + 1}</div>
                            <div class="badge badge-success">Отправлено</div>
                        </div>
                        <div class="card-body">
                            <p><strong>ФИО:</strong> ${record.data.fio || 'Нет'}</p>
                            <p><strong>Дата отправки:</strong> ${new Date(record.sentAt || record.timestamp).toLocaleString('ru-RU')}</p>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        html += `
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal(event)">Закрыть</button>
                        <button class="btn btn-primary" onclick="forceSendOfflineData()">Отправить сейчас</button>
                        ${exceededRecords.length > 0 ? '<button class="btn btn-warning" onclick="resetOfflineAttempts()">Сбросить попытки</button>' : ''}
                        <button class="btn btn-danger" onclick="clearOfflineData()">Очистить всё</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка показа оффлайн данных', error);
        alert('Ошибка загрузки оффлайн данных: ' + error.message);
    }
}

function showDriverCabinetModal(history, notifications, driverPhone, driverName) {
    const formattedPhone = formatPhoneDisplay(driverPhone);
    
    // Получаем имя из истории
    let actualDriverName = driverName;
    if ((!actualDriverName || actualDriverName === 'Не указано') && history.length > 0) {
        const registrationWithName = history.find(reg => reg.fio && reg.fio.trim() !== '');
        if (registrationWithName) {
            actualDriverName = registrationWithName.fio;
        }
    }
    
    if ((!actualDriverName || actualDriverName === 'Не указано') && registrationState.data.fio) {
        actualDriverName = registrationState.data.fio;
    }
    
    // РАССЧИТЫВАЕМ непрочитанные уведомления ПРАВИЛЬНО
    const unreadNotificationsCount = notifications.filter(n => !n.status || n.status !== 'read').length;
    
    const modalHtml = `
        <div class="modal-overlay" id="driver-cabinet-modal" onclick="if(event.target === this) closeModalById('driver-cabinet-modal')">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3 class="modal-title">👤 Личный кабинет водителя</h3>
                    <button class="modal-close" onclick="closeModalById('driver-cabinet-modal')">✕</button>
                </div>
                
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 0 20px;">
                    <div class="info-box" style="margin: 0 0 20px 0;">
                        <p><strong>👤 Водитель:</strong> ${actualDriverName || 'Не указано'}</p>
                        <p><strong>📱 Телефон:</strong> ${formattedPhone}</p>
                        <p><strong>📊 Всего регистраций:</strong> ${history.length}</p>
                        <p><strong>🔔 Непрочитанных уведомлений:</strong> ${unreadNotificationsCount}</p>
                        <p><strong>⏰ Часовой пояс:</strong> UTC+3 (время отображается корректно)</p>
                    </div>
                    
                    <div class="tabs" style="margin-bottom: 20px; display: flex; gap: 5px; border-bottom: 1px solid #e0e0e0;">
                        <button class="tab-btn active" onclick="switchCabinetTab('history')" 
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid #4285f4; color: #4285f4;">
                            📋 История (${history.length})
                        </button>
                        <button class="tab-btn" onclick="switchCabinetTab('notifications')"
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #666;">
                            🔔 Уведомления (${unreadNotificationsCount})
                        </button>
                        <button class="tab-btn" onclick="switchCabinetTab('status')"
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #666;">
                            📊 Статус
                        </button>
                    </div>
                    
                    <div id="cabinet-history-tab" class="cabinet-tab-content" style="display: block;">
                        ${renderHistoryTab(history)}
                    </div>
                    
                    <div id="cabinet-notifications-tab" class="cabinet-tab-content" style="display: none;">
                        ${renderNotificationsTab(notifications)}
                    </div>
                    
                    <div id="cabinet-status-tab" class="cabinet-tab-content" style="display: none;">
                        ${renderStatusTab(history)}
                    </div>
                </div>
                
                <!-- ЗАКРЕПЛЕННАЯ КНОПКА ВНИЗУ -->
                <div class="modal-footer" style="position: sticky; bottom: 0; background: white; border-top: 1px solid #f0f0f0; padding: 15px 20px; margin-top: auto;">
                    <button class="btn btn-secondary" onclick="closeModalById('driver-cabinet-modal')">
                        Закрыть
                    </button>
                    <button class="btn btn-primary" onclick="refreshCabinetInModal('${driverPhone}')" style="margin-left: 10px;">
                        🔄 Обновить данные
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старый модальный окно если есть
    const oldModal = document.getElementById('driver-cabinet-modal');
    if (oldModal) oldModal.remove();
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Устанавливаем активное модальное окно
    currentActiveModal = 'driver-cabinet-modal';
}

async function forceSendOfflineData() {
    showLoader(true);
    await sendOfflineData();
    showLoader(false);
    closeModalById('offline-data-modal');
    closeModalById('offline-data-modal');
}

function clearOfflineData() {
    if (confirm('Удалить все оффлайн данные? Это действие нельзя отменить.')) {
        localStorage.removeItem('offline_registrations');
        showOfflineDataCount();
        closeModalById('offline-data-modal');
        showNotification('Оффлайн данные очищены', 'info');
    }
}

// Функция обновления внутри модального окна
// ==================== ФУНКЦИЯ ОБНОВЛЕНИЯ В МОДАЛЬНОМ ОКНЕ ====================
async function refreshCabinetInModal(phone) {
    try {
        // Находим модальное окно
        const modal = document.getElementById('driver-cabinet-modal');
        if (!modal) return;
        
        // Показываем индикатор загрузки
        const refreshIndicator = document.createElement('div');
        refreshIndicator.innerHTML = `
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000;">
                <div class="loader" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4285f4; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="margin-top: 15px; font-weight: 600; color: #333;">Обновление данных...</div>
                <div style="margin-top: 5px; font-size: 13px; color: #666;">Пожалуйста, подождите</div>
            </div>
        `;
        refreshIndicator.id = 'refresh-indicator';
        modal.querySelector('.modal').appendChild(refreshIndicator);
        
        // Обновляем данные
        const [history, notifications] = await Promise.all([
            getDriverHistory(phone),
            getPWANotifications(phone)
        ]);
        
        // Получаем имя
        let actualDriverName = '';
        if (history.length > 0) {
            const registrationWithName = history.find(reg => reg.fio && reg.fio.trim() !== '');
            if (registrationWithName) {
                actualDriverName = registrationWithName.fio;
            }
        }
        
        if (!actualDriverName && registrationState.data.fio) {
            actualDriverName = registrationState.data.fio;
        }
        
        // РАССЧИТЫВАЕМ количество непрочитанных уведомлений ПРАВИЛЬНО
        const unreadNotificationsCount = notifications.filter(n => !n.status || n.status !== 'read').length;
        
        // Обновляем вкладки
        const historyTab = modal.querySelector('#cabinet-history-tab');
        const notificationsTab = modal.querySelector('#cabinet-notifications-tab');
        const statusTab = modal.querySelector('#cabinet-status-tab');
        
        if (historyTab) historyTab.innerHTML = renderHistoryTab(history);
        if (notificationsTab) notificationsTab.innerHTML = renderNotificationsTab(notifications);
        if (statusTab) statusTab.innerHTML = renderStatusTab(history);
        
        // Обновляем заголовок и информацию
        const infoBox = modal.querySelector('.info-box');
        if (infoBox) {
            infoBox.innerHTML = `
                <p><strong>👤 Водитель:</strong> ${actualDriverName || 'Не указано'}</p>
                <p><strong>📱 Телефон:</strong> ${formatPhoneDisplay(phone)}</p>
                <p><strong>📊 Всего регистраций:</strong> ${history.length}</p>
                <p><strong>🔔 Непрочитанных уведомлений:</strong> ${unreadNotificationsCount}</p>
                <p><strong>⏰ Часовой пояс:</strong> UTC+3 (время отображается корректно)</p>
                <p style="color: #4caf50; font-weight: 600; margin-top: 10px;">✅ Данные обновлены: ${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</p>
            `;
        }
        
        // Обновляем кнопки вкладок
        const historyBtn = modal.querySelector('.tab-btn:nth-child(1)');
        const notificationsBtn = modal.querySelector('.tab-btn:nth-child(2)');
        
        if (historyBtn) {
            historyBtn.innerHTML = `📋 История (${history.length})`;
        }
        if (notificationsBtn) {
            notificationsBtn.innerHTML = `🔔 Уведомления (${unreadNotificationsCount})`;
        }
        
        // Убираем индикатор загрузки
        setTimeout(() => {
            const indicator = modal.querySelector('#refresh-indicator');
            if (indicator) indicator.remove();
            
            // Показываем уведомление
            showNotification('✅ Данные обновлены', 'success');
        }, 500);
        
    } catch (error) {
        console.error('Ошибка обновления кабинета:', error);
        
        // Убираем индикатор загрузки при ошибке
        const modal = document.getElementById('driver-cabinet-modal');
        if (modal) {
            const indicator = modal.querySelector('#refresh-indicator');
            if (indicator) indicator.remove();
        }
        
        showNotification('❌ Ошибка обновления данных: ' + error.message, 'error');
    }
}

// ==================== ОТКРЫТИЕ ЛИЧНОГО КАБИНЕТА ====================

// ==================== ОТКРЫТИЕ ЛИЧНОГО КАБИНЕТА ====================
async function openDriverCabinet() {
    try {
        console.log('Открываю личный кабинет...');
        
        // Пробуем получить телефон из текущей сессии
        let driverPhone = '';
        let driverName = '';
        
        if (registrationState && registrationState.data) {
            driverPhone = registrationState.data.phone || '';
            driverName = registrationState.data.fio || '';
        }
        
        // Если телефон не найден, пробуем из сохраненных данных
        if (!driverPhone) {
            const savedDriverInfo = localStorage.getItem('driver_info_for_cabinet');
            if (savedDriverInfo) {
                try {
                    const driverInfo = JSON.parse(savedDriverInfo);
                    driverPhone = driverInfo.phone || '';
                    driverName = driverInfo.name || '';
                } catch (e) {
                    console.log('Ошибка парсинга сохраненных данных:', e);
                }
            }
        }
        
        // Если телефон не найден, пробуем из последней регистрации
        if (!driverPhone) {
            driverPhone = localStorage.getItem('last_driver_phone') || '';
            driverName = localStorage.getItem('last_driver_name') || '';
        }
        
        // Если телефон все еще не найден, показываем ввод
        if (!driverPhone) {
            showNotification('Введите номер телефона для доступа к личному кабинету', 'warning');
            // Показываем модальное окно для ввода телефона
            showPhoneInputModal();
            return;
        }
        
        // Показываем загрузчик
        showLoader(true);
        
        try {
            // Получаем данные с сервера
            const [history, notifications] = await Promise.all([
                getDriverHistory(driverPhone),
                getPWANotifications(driverPhone)
            ]);
            
            console.log('Данные получены:', {
                historyCount: history.length,
                notificationsCount: notifications.length
            });
            
            // Показываем личный кабинет
            showDriverCabinetModal(history, notifications, driverPhone, driverName);
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            showNotification('Не удалось загрузить данные', 'error');
            showSimpleDriverCabinet(driverPhone, driverName);
        } finally {
            showLoader(false);
        }
        
    } catch (error) {
        console.error('Ошибка открытия личного кабинета:', error);
        showNotification('Ошибка: ' + error.message, 'error');
        showLoader(false);
    }
}

// Функция для открытия детального просмотра регистрации
function openRegistrationDetails(registration, index) {
    // Безопасное форматирование данных
    const safeRegistration = {
        ...registration,
        fio: registration.fio || 'Не указано',
        phone: registration.phone || '',
        supplier: registration.supplier || 'Не указан',
        legalEntity: registration.legalEntity || 'Не указано',
        productType: registration.productType || 'Не указан',
        vehicleType: registration.vehicleType || 'Не указана',
        vehicleNumber: registration.vehicleNumber || 'Не указан',
        pallets: registration.pallets || 0,
        orderNumber: registration.orderNumber || 'Не указан',
        etrn: registration.etrn || 'Не указан',
        transit: registration.transit || 'Нет',
        assignedGate: registration.assignedGate || '',
        defaultGate: registration.defaultGate || 'Не назначены',
        status: registration.status || 'Зарегистрирован',
        problemType: registration.problemType || '',
        scheduleViolation: registration.scheduleViolation || 'Нет',
        date: registration.date || '',
        time: registration.time || ''
    };
    
    const formattedDate = formatNotificationTime(safeRegistration.displayDate || safeRegistration.date || '');
    const statusBadge = getStatusBadge(safeRegistration.status);
    const formattedPhone = formatPhoneDisplay(safeRegistration.phone);
    
    const modalId = `registration-details-${Date.now()}`;
    
    // Сохраняем предыдущее окно (личный кабинет)
    const previousModalId = currentActiveModal;
    
    const modalHtml = `
        <div class="modal-overlay" id="${modalId}" onclick="if(event.target === this) closeModalById('${modalId}'); restorePreviousModal('${previousModalId}')">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 750px; max-height: 85vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 24px; color: #4285f4;">📋</div>
                        <div>
                            <h3 class="modal-title" style="margin: 0; font-size: 18px;">Детали регистрации #${index}</h3>
                            <div style="font-size: 13px; color: #666; margin-top: 3px;">
                                ${formattedDate || 'Дата не указана'}
                            </div>
                        </div>
                    </div>
                    <button class="modal-close" onclick="closeDetailsAndRestore('${modalId}', '${previousModalId}')" style="font-size: 20px; padding: 5px 10px;">✕</button>
                </div>
                
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                    <!-- Статус -->
                    <div style="margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between;">
                        <div class="badge" style="background: ${statusBadge.bgColor}; color: ${statusBadge.textColor}; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; border: 2px solid ${statusBadge.bgColor}40;">
                            ${statusBadge.text}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="font-size: 24px;">${getStatusIcon(safeRegistration.status)}</div>
                        </div>
                    </div>
                    
                    <!-- Основная информация в 2 колонки -->
                    <div class="details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 25px;">
                        <!-- Левая колонка -->
                        <div>
                            <!-- Водитель -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">👤</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Водитель</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.fio)}
                                </div>
                            </div>
                            
                            <!-- Телефон -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">📱</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Телефон</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333; font-family: monospace;">
                                    ${formattedPhone}
                                </div>
                            </div>
                            
                            <!-- Поставщик -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">🏢</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Поставщик</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.supplier)}
                                </div>
                            </div>
                            
                            <!-- Юрлицо -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">🏛️</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Юрлицо</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.legalEntity)}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Правая колонка -->
                        <div>
                            <!-- Тип товара -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">📦</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Тип товара</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.productType)}
                                </div>
                            </div>
                            
                            <!-- Транспорт -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">🚗</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Транспорт</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.vehicleType)}
                                    ${safeRegistration.vehicleNumber && safeRegistration.vehicleNumber !== 'Не указан' ? 
                                        `<div style="font-size: 14px; margin-top: 5px; font-family: monospace; background: #e9ecef; padding: 4px 8px; border-radius: 6px; display: inline-block;">${escapeHTML(safeRegistration.vehicleNumber)}</div>` : 
                                        ''
                                    }
                                </div>
                            </div>
                            
                            <!-- Поддоны -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">📦</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Поддоны</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${safeRegistration.pallets} шт.
                                </div>
                            </div>
                            
                            <!-- Транзит -->
                            <div class="detail-card" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="font-size: 18px; color: #4285f4;">🔄</div>
                                    <div style="font-size: 13px; color: #666; font-weight: 500;">Транзит</div>
                                </div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${escapeHTML(safeRegistration.transit)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ворота (широкая карточка) -->
                    <div class="detail-section" style="margin-bottom: 20px;">
                        <div style="font-size: 15px; color: #666; margin-bottom: 10px; font-weight: 500; display: flex; align-items: center; gap: 10px;">
                            <div style="font-size: 20px;">🚪</div>
                            <div>Ворота</div>
                        </div>
                        <div style="background: ${safeRegistration.status === 'Назначены ворота' ? '#e8f5e9' : '#f8f9fa'}; padding: 20px; border-radius: 12px; border-left: 5px solid ${safeRegistration.status === 'Назначены ворота' ? '#4caf50' : '#666'};">
                            <div style="font-weight: 600; font-size: 17px; color: #333; line-height: 1.4;">
                                ${escapeHTML(safeRegistration.assignedGate || safeRegistration.defaultGate)}
                            </div>
                            ${safeRegistration.assignedGate ? 
                                `<div style="font-size: 13px; color: #4caf50; margin-top: 8px; font-weight: 500;">✅ Назначенные ворота</div>` : 
                                `<div style="font-size: 13px; color: #666; margin-top: 8px;">Ворота по умолчанию</div>`
                            }
                        </div>
                    </div>
                    
                    <!-- Документы (если есть) -->
                    ${(safeRegistration.orderNumber && safeRegistration.orderNumber !== 'Не указан') || (safeRegistration.etrn && safeRegistration.etrn !== 'Не указан') ? `
                        <div class="detail-section" style="margin-bottom: 20px;">
                            <div style="font-size: 15px; color: #666; margin-bottom: 10px; font-weight: 500; display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 20px;">📋</div>
                                <div>Документы</div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                ${safeRegistration.orderNumber && safeRegistration.orderNumber !== 'Не указан' ? `
                                    <div style="background: #fff3e0; padding: 15px; border-radius: 10px; border-left: 4px solid #ff9800;">
                                        <div style="font-size: 13px; color: #e65100; margin-bottom: 5px; font-weight: 500;">Номер заказа</div>
                                        <div style="font-weight: 600; font-size: 16px; color: #333; font-family: monospace;">
                                            ${escapeHTML(safeRegistration.orderNumber)}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${safeRegistration.etrn && safeRegistration.etrn !== 'Не указан' ? `
                                    <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; border-left: 4px solid #2196f3;">
                                        <div style="font-size: 13px; color: #1565c0; margin-bottom: 5px; font-weight: 500;">ЭТрН</div>
                                        <div style="font-weight: 600; font-size: 16px; color: #333; font-family: monospace;">
                                            ${escapeHTML(safeRegistration.etrn)}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Проблемы и предупреждения -->
                    ${safeRegistration.problemType || safeRegistration.scheduleViolation === 'Да' ? `
                        <div class="detail-section" style="margin-bottom: 20px;">
                            <div style="font-size: 15px; color: #666; margin-bottom: 10px; font-weight: 500; display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 20px;">⚠️</div>
                                <div>Внимание</div>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${safeRegistration.problemType ? `
                                    <div style="background: #ffebee; padding: 15px; border-radius: 10px; border-left: 5px solid #f44336;">
                                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                                            <div style="font-size: 20px; color: #f44336; margin-top: 2px;">❌</div>
                                            <div style="flex: 1;">
                                                <div style="font-weight: 600; font-size: 15px; color: #c62828; margin-bottom: 5px;">Тип проблемы</div>
                                                <div style="font-size: 14px; color: #c62828; line-height: 1.4;">
                                                    ${escapeHTML(safeRegistration.problemType)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${safeRegistration.scheduleViolation === 'Да' ? `
                                    <div style="background: #fff3e0; padding: 15px; border-radius: 10px; border-left: 5px solid #ff9800;">
                                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                                            <div style="font-size: 20px; color: #ff9800; margin-top: 2px;">⏰</div>
                                            <div style="flex: 1;">
                                                <div style="font-weight: 600; font-size: 15px; color: #e65100; margin-bottom: 5px;">Нарушение графика</div>
                                                <div style="font-size: 14px; color: #e65100; line-height: 1.4;">
                                                    Водитель приехал вне установленного графика для данного типа товара
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Статистика -->
                    <div class="detail-section" style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                        <div style="font-size: 13px; color: #666; display: flex; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 500; margin-bottom: 3px;">ID регистрации</div>
                                <div style="font-family: monospace; font-size: 12px; color: #333; background: #f5f5f5; padding: 4px 8px; border-radius: 6px; display: inline-block;">
                                    ${safeRegistration.rowNumber || 'N/A'}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 500; margin-bottom: 3px;">Обновлено</div>
                                <div style="font-size: 12px; color: #666;">
                                    ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Закрепленная панель кнопок -->
                <div class="modal-footer" style="position: sticky; bottom: 0; background: white; border-top: 1px solid #f0f0f0; padding: 15px 20px; margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn btn-secondary" onclick="closeDetailsAndRestore('${modalId}', '${previousModalId}')" style="padding: 10px 20px; font-size: 14px;">
                        ← Назад к истории
                    </button>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-info" onclick="copyRegistrationDetails(${JSON.stringify(safeRegistration).replace(/"/g, '&quot;')})" 
                                style="padding: 10px 20px; font-size: 14px; background: #17a2b8;">
                            📋 Копировать
                        </button>
                        ${safeRegistration.phone ? `
                            <button class="btn btn-primary" onclick="shareRegistration(${JSON.stringify(safeRegistration).replace(/"/g, '&quot;')})"
                                    style="padding: 10px 20px; font-size: 14px;">
                                📤 Поделиться
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Скрываем предыдущее модальное окно (личный кабинет)
    if (previousModalId) {
        const prevModal = document.getElementById(previousModalId);
        if (prevModal) {
            prevModal.style.display = 'none';
        }
    }
    
    // Создаем новое модальное окно
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Устанавливаем текущее активное окно
    currentActiveModal = modalId;
}

// ==================== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ МОДАЛЬНЫМИ ОКНАМИ ====================

// Универсальная функция открытия модального окна по id
function openModal(modalId) {
    // Закрываем предыдущее модальное окно
    if (currentActiveModal && currentActiveModal !== modalId) {
        const prevModal = document.getElementById(currentActiveModal);
        if (prevModal) {
            prevModal.style.display = 'none';
        }
    }
    
    // Открываем новое
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        currentActiveModal = modalId;
    }
}

// Функция для закрытия деталей и восстановления предыдущего окна
function closeDetailsAndRestore(currentModalId, previousModalId) {
    // Закрываем текущее окно с деталями
    closeModalById(currentModalId);
    
    // Восстанавливаем предыдущее окно (личный кабинет)
    if (previousModalId && previousModalId !== 'null' && previousModalId !== 'undefined') {
        const prevModal = document.getElementById(previousModalId);
        if (prevModal) {
            prevModal.style.display = 'flex';
            currentActiveModal = previousModalId;
        }
    }
}

// Функция для восстановления предыдущего модального окна
function restorePreviousModal(previousModalId) {
    if (previousModalId && previousModalId !== 'null' && previousModalId !== 'undefined') {
        const prevModal = document.getElementById(previousModalId);
        if (prevModal) {
            prevModal.style.display = 'flex';
            currentActiveModal = previousModalId;
        }
    }
}

// Функция для получения иконки статуса
function getStatusIcon(status) {
    const iconMap = {
        'Зарегистрирован': '📝',
        'Назначены ворота': '🚪',
        'Документы готовы к выдаче': '📄',
        'Отказ в приемке': '❌',
        'Нет в графике': '⏰',
        'Проблема с товаром': '⚠️',
        'Проблема с документами': '📋',
        'Отправлено': '✅',
        'Ожидает': '⏳',
        'Превышен лимит': '⛔',
        'Дубликат': '🔄'
    };
    
    return iconMap[status] || '📋';
}

// Улучшенная функция закрытия модального окна
function closeModalById(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeModal(event) {
    try {
        if (event) {
            event.preventDefault?.();
            event.stopPropagation?.();

            const target = event.target;
            const overlay = (target && target.closest) ? target.closest('.modal-overlay') : null;
            if (overlay) {
                overlay.remove();
                return;
            }
        }

        // Если событие не передали — закрываем все модалки
        const overlays = document.querySelectorAll('.modal-overlay');
        overlays.forEach(o => o.remove());
    } catch (e) {
        console.error('Ошибка closeModal:', e);
    }
}

function closeAllModals() {
    try {
        const overlays = document.querySelectorAll('.modal-overlay');
        overlays.forEach(o => o.remove());

        if (typeof currentActiveModal !== 'undefined') {
            currentActiveModal = null;
        }
    } catch (e) {
        console.error('Ошибка closeAllModals:', e);
    }
}

// Fallback функция для копирования
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('✅ Данные скопированы в буфер обмена', 'success');
        } else {
            throw new Error('Не удалось выполнить команду копирования');
        }
    } catch (err) {
        console.error('Ошибка fallback копирования:', err);
        showNotification('❌ Не удалось скопировать данные. Попробуйте выделить текст вручную.', 'error');
    } finally {
        document.body.removeChild(textArea);
    }
}

// Функция для шаринга (опционально)
function shareRegistration(registration) {
    try {
        const safePhone = registration.phone ? formatPhoneDisplay(registration.phone) : 'Не указан';
        const shareText = `Регистрация водителя: ${registration.fio || 'Не указано'}, тел: ${safePhone}, статус: ${registration.status}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Детали регистрации водителя',
                text: shareText,
                url: window.location.href
            }).then(() => {
                showNotification('✅ Информация отправлена', 'success');
            }).catch(err => {
                console.log('Отмена шаринга:', err);
            });
        } else {
            // Fallback - копируем в буфер
            copyRegistrationDetails(registration);
        }
    } catch (error) {
        console.error('Ошибка шаринга:', error);
        showNotification('❌ Ошибка отправки данных', 'error');
    }
}

// Функция для копирования данных регистрации
// Безопасная функция для копирования данных
function copyRegistrationDetails(registration) {
    try {
        const safePhone = registration.phone ? formatPhoneDisplay(registration.phone) : 'Не указан';
        
        const textToCopy = `
📋 Детали регистрации:
👤 Водитель: ${registration.fio || 'Не указано'}
📱 Телефон: ${safePhone}
🏢 Поставщик: ${registration.supplier || 'Не указан'}
🏛️ Юрлицо: ${registration.legalEntity || 'Не указано'}
📦 Тип товара: ${registration.productType || 'Не указан'}
🚗 Марка авто: ${registration.vehicleType || 'Не указана'}
🔢 Номер ТС: ${registration.vehicleNumber || 'Не указан'}
📦 Поддоны: ${registration.pallets || 0}
📋 Номер заказа: ${registration.orderNumber || 'Не указан'}
📱 ЭТрН: ${registration.etrn || 'Не указан'}
🔄 Транзит: ${registration.transit || 'Нет'}
🚪 Ворота: ${registration.assignedGate || registration.defaultGate || 'Не назначены'}
📊 Статус: ${registration.status || 'Зарегистрирован'}
${registration.problemType ? `⚠️ Проблема: ${registration.problemType}` : ''}
${registration.scheduleViolation === 'Да' ? '⏰ Нарушение графика: Да' : ''}
        `.trim();
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showNotification('✅ Данные скопированы в буфер обмена', 'success');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('✅ Данные скопированы', 'success');
        });
    } catch (error) {
        console.error('Ошибка копирования:', error);
        showNotification('❌ Ошибка копирования данных', 'error');
    }
}
// ==================== ПОКАЗ ЛИЧНОГО КАБИНЕТА ====================
function showPhoneInputModal() {
    const modalHtml = `
        <div class="modal-overlay" id="phone-input-modal" onclick="if(event.target === this) closeModalById('phone-input-modal')">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">📱 Введите номер телефона</h3>
                    <button class="modal-close" onclick="closeModalById('phone-input-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <p>Для доступа к личному кабинету введите номер телефона:</p>
                    <div class="phone-input-container" style="margin: 20px 0;">
                        <div class="phone-prefix">+7</div>
                        <input type="tel" id="cabinet-phone-input" 
                               placeholder="999 123 45 67" class="form-input" 
                               style="border: none; padding: 16px 10px;">
                    </div>
                    <div class="info-box">
                        <p>Используйте номер телефона, который вы указывали при регистрации</p>
                        <p style="margin-top: 10px; color: #666; font-size: 13px;">
                            Телефон сохраняется и будет доступен после завершения регистрации
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModalById('phone-input-modal')">Отмена</button>
                    <button class="btn btn-primary" onclick="enterCabinetWithPhone()">Войти в личный кабинет</button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'phone-input-modal';
    document.body.appendChild(modalContainer);
    
    // Фокус на поле ввода
    setTimeout(() => {
        const phoneInput = document.getElementById('cabinet-phone-input');
        if (phoneInput) {
            phoneInput.focus();
            // Автозаполнение сохраненного телефона если есть
            const savedPhone = localStorage.getItem('last_driver_phone');
            if (savedPhone) {
                phoneInput.value = formatPhoneDisplay(savedPhone);
            }
        }
    }, 300);
}

function enterCabinetWithPhone() {
    const phoneInput = document.getElementById('cabinet-phone-input');
    if (!phoneInput) return;
    
    const phone = phoneInput.value.replace(/\s/g, '');
    
    if (!phone || phone.length < 10) {
        showNotification('Пожалуйста, введите корректный номер телефона', 'error');
        phoneInput.focus();
        return;
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    // Сохраняем телефон для кабинета
    saveDriverInfoForCabinet(normalizedPhone, '');
    
    // Закрываем модальное окно
    closeModalById('phone-input-modal');
    
    // Обновляем registrationState
    if (registrationState && registrationState.data) {
        registrationState.data.phone = normalizedPhone;
        saveRegistrationState();
    }
    
    // Показываем личный кабинет
    openDriverCabinet();
}

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


// ==================== ФУНКЦИЯ ПОЛУЧЕНИЯ УВЕДОМЛЕНИЙ (С ИСПРАВЛЕННЫМИ ДАТАМИ) ====================
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
// ==================== ПОЛУЧЕНИЕ ОБНОВЛЕНИЙ СТАТУСА ====================
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

function showSimpleDriverCabinet(driverPhone, driverName) {
    const formattedPhone = formatPhoneDisplay(driverPhone);
    
    const modalHtml = `
        <div class="modal-overlay" onclick="closeDriverCabinet()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 90vh;">
                <div class="modal-header">
                    <h3 class="modal-title">👤 Личный кабинет водителя</h3>
                    <button class="modal-close" onclick="closeDriverCabinet()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="info-box" style="margin-bottom: 20px;">
                        <p><strong>👤 Водитель:</strong> ${driverName || 'Не указано'}</p>
                        <p><strong>📱 Телефон:</strong> ${formattedPhone}</p>
                        <p><strong>🕐 Время входа:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                    </div>
                    
                    <div class="tabs" style="margin-bottom: 20px; display: flex; gap: 5px; border-bottom: 1px solid #e0e0e0;">
                        <button class="tab-btn active" onclick="switchCabinetTab('info')" 
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid #4285f4; color: #4285f4;">
                            📋 Основная информация
                        </button>
                        <button class="tab-btn" onclick="switchCabinetTab('history')"
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #666;">
                            📜 История регистраций
                        </button>
                        <button class="tab-btn" onclick="switchCabinetTab('notifications')"
                                style="padding: 10px 15px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #666;">
                            🔔 Уведомления
                        </button>
                    </div>
                    
                    <div id="cabinet-info-tab" class="cabinet-tab-content" style="display: block;">
                        <div class="card" style="margin-bottom: 15px;">
                            <div class="card-header">
                                <div class="card-title">Текущий статус</div>
                            </div>
                            <div class="card-body">
                                <p>✅ <strong>Статус:</strong> Доступ к личному кабинету открыт</p>
                                <p>📅 <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
                                <p>⏰ <strong>Время:</strong> ${new Date().toLocaleTimeString('ru-RU')}</p>
                            </div>
                        </div>
                        
                        <div class="warning-box">
                            <p>⚠️ <strong>Важная информация:</strong></p>
                            <p>Полная функциональность личного кабинета находится в разработке.</p>
                            <p>В ближайшее время будет доступно:</p>
                            <ul style="margin-left: 20px; margin-top: 10px;">
                                <li>История всех ваших регистраций</li>
                                <li>Текущий статус заездов в реальном времени</li>
                                <li>Push-уведомления о назначении ворот</li>
                                <li>Информация о проблемах и их решении</li>
                                <li>График заездов и статус очереди</li>
                            </ul>
                        </div>
                        
                        <div class="info-box" style="margin-top: 15px;">
                            <p>📞 Для получения информации о текущем статусе заезда обратитесь к диспетчеру.</p>
                            <p>🚪 Ворота будут назначены согласно графику и типу товара.</p>
                        </div>
                    </div>
                    
                    <div id="cabinet-history-tab" class="cabinet-tab-content" style="display: none;">
                        <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #999;">
                            <div style="font-size: 40px; margin-bottom: 15px;">📭</div>
                            <p>История регистраций временно недоступна</p>
                            <p style="font-size: 14px; margin-top: 10px;">Функция находится в разработке</p>
                        </div>
                    </div>
                    
                    <div id="cabinet-notifications-tab" class="cabinet-tab-content" style="display: none;">
                        <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #999;">
                            <div style="font-size: 40px; margin-bottom: 15px;">🔕</div>
                            <p>Нет новых уведомлений</p>
                            <p style="font-size: 14px; margin-top: 10px;">Уведомления появятся здесь при изменении статуса</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeDriverCabinet()">Закрыть</button>
                    <button class="btn btn-primary" onclick="refreshCabinet('${driverPhone}')">🔄 Обновить</button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старый модальный окно если есть
    const oldModal = document.getElementById('driver-cabinet-modal');
    if (oldModal) oldModal.remove();
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'driver-cabinet-modal';
    document.body.appendChild(modalContainer);
}

// Функция переключения вкладок
// Функция переключения вкладок
function switchCabinetTab(tabName) {
    const modal = document.getElementById('driver-cabinet-modal');
    if (!modal) return;
    
    // Скрыть все вкладки
    modal.querySelectorAll('.cabinet-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Убрать активный класс со всех кнопок
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = '#666';
    });
    
    // Показать выбранную вкладку
    const tabElement = modal.querySelector(`#cabinet-${tabName}-tab`);
    if (tabElement) {
        tabElement.style.display = 'block';
    }
    
    // Активировать кнопку
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`switchCabinetTab('${tabName}'`) || onclick.includes(`switchCabinetTab(\"${tabName}\"`)) {
            btn.style.borderBottomColor = '#4285f4';
            btn.style.color = '#4285f4';
        }
    });
}

// Функция для получения отображаемого имени вкладки кабинета
function getCabinetTabName(tabName) {
    const map = {
        'history': 'История регистраций',
        'notifications': 'Уведомления',
        'status': 'Текущий статус'
    };
    return map[tabName] || tabName;
}

function refreshCabinet(phone) {
    try {
        // Находим текущее модальное окно
        const modal = document.getElementById('driver-cabinet-modal');
        if (!modal) return;
        
        // Создаем индикатор обновления внутри модального окна
        const refreshIndicator = document.createElement('div');
        refreshIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: rgba(255, 255, 255, 0.95); padding: 20px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); text-align: center;">
                <div class="loader" style="width: 40px; height: 40px; margin: 0 auto 15px;"></div>
                <div style="font-weight: 600; color: #333; margin-bottom: 5px;">Обновление информации</div>
                <div style="font-size: 13px; color: #666;">Пожалуйста, подождите...</div>
            </div>
        `;
        refreshIndicator.id = 'refresh-indicator';
        modal.appendChild(refreshIndicator);
        
        // Закрываем модальное окно и открываем новое
        setTimeout(() => {
            closeModalById('driver-cabinet-modal');
            setTimeout(() => {
                openDriverCabinet();
            }, 300);
        }, 1000);
        
    } catch (error) {
        console.error('Ошибка обновления кабинета:', error);
        showNotification('❌ Ошибка обновления данных', 'error');
    }
}



function closeDriverCabinet() {
    const modal = document.getElementById('driver-cabinet-modal');
    if (modal) {
        modal.remove();
    }
}

function showDriverCabinet(history, notifications, statusUpdates, driverPhone, driverName) {
    logToConsole('INFO', 'Показываю личный кабинет', {
        historyCount: history.length,
        notificationsCount: notifications.length,
        updatesCount: statusUpdates.length,
        driverPhone: driverPhone
    });
    
    // Создаем модальное окно личного кабинета
    const modalHtml = `
        <div class="modal-overlay" onclick="closeDriverCabinet()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px; max-height: 90vh;">
                <div class="modal-header">
                    <h3 class="modal-title">👤 Личный кабинет водителя</h3>
                    <button class="modal-close" onclick="closeDriverCabinet()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="info-box" style="margin-bottom: 20px;">
                        <p><strong>👤 Водитель:</strong> ${driverName || 'Не указано'}</p>
                        <p><strong>📱 Телефон:</strong> ${formatPhoneDisplay(driverPhone)}</p>
                        <p><strong>📊 Всего регистраций:</strong> ${history.length}</p>
                        <p><strong>🔔 Непрочитанных уведомлений:</strong> ${notifications.filter(n => !n.status || n.status !== 'read').length}</p>
                    </div>
                    
                    <div class="tabs" style="margin-bottom: 20px;">
                        <button class="tab-btn active" onclick="switchTab('history')">📋 История (${history.length})</button>
                        <button class="tab-btn" onclick="switchTab('notifications')">🔔 Уведомления (${notifications.filter(n => !n.status || n.status !== 'read').length})</button>
                        <button class="tab-btn" onclick="switchTab('status')">📊 Текущий статус (${statusUpdates.length > 0 ? 'Есть обновления' : 'Нет'})</button>
                    </div>
                    
                    <div id="history-tab" class="tab-content active">
                        ${renderHistoryTab(history)}
                    </div>
                    
                    <div id="notifications-tab" class="tab-content">
                        ${renderNotificationsTab(notifications)}
                    </div>
                    
                    <div id="status-tab" class="tab-content">
                        ${renderStatusTab(statusUpdates)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeDriverCabinet()">Закрыть</button>
                    <button class="btn btn-primary" onclick="refreshDriverCabinet()">🔄 Обновить</button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старый модальный окно если есть
    const oldModal = document.getElementById('driver-cabinet-modal');
    if (oldModal) {
        oldModal.remove();
    }
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'driver-cabinet-modal';
    document.body.appendChild(modalContainer);
    
    // Сохраняем данные для обновления
    modalContainer._cabinetData = {
        driverPhone,
        driverName,
        history,
        notifications,
        statusUpdates
    };
}

// Функция для рендеринга вкладки истории
function renderHistoryTab(history) {
    if (history.length === 0) {
        return `
            <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #999;">
                <div style="font-size: 40px; margin-bottom: 15px;">📭</div>
                <p>История регистраций отсутствует</p>
                <p style="font-size: 14px; margin-top: 10px;">Вы еще не проходили регистрацию через это приложение</p>
            </div>
        `;
    }
    
    let html = `<div style="max-height: 400px; overflow-y: auto;">`;
    
    history.forEach((item, index) => {
        const statusBadge = getStatusBadge(item.status);
        const formattedDate = formatNotificationTime(item.displayDate || item.date || '');
        
        // Создаем безопасный объект для передачи
        const safeItem = {
            ...item,
            fio: item.fio || 'Не указано',
            phone: item.phone || '',
            supplier: item.supplier || 'Не указан',
            legalEntity: item.legalEntity || 'Не указано',
            productType: item.productType || 'Не указан',
            vehicleType: item.vehicleType || 'Не указана',
            vehicleNumber: item.vehicleNumber || 'Не указан',
            pallets: item.pallets || 0,
            orderNumber: item.orderNumber || 'Не указан',
            etrn: item.etrn || 'Не указан',
            transit: item.transit || 'Нет',
            assignedGate: item.assignedGate || '',
            defaultGate: item.defaultGate || 'Не назначены',
            status: item.status || 'Зарегистрирован',
            problemType: item.problemType || '',
            scheduleViolation: item.scheduleViolation || 'Нет',
            displayDate: formattedDate
        };
        
        // Безопасная сериализация
        const itemData = JSON.stringify(safeItem);
        const safeItemData = escapeHTML(itemData);
        
        html += `
            <div class="card" style="margin-bottom: 10px; border-left: 4px solid ${statusBadge.color}; cursor: pointer; transition: all 0.2s;" 
                 onclick="openRegistrationDetails(${safeItemData}, ${index + 1})"
                 onmouseover="this.style.transform='translateX(5px)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)';"
                 onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none';">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <div class="card-title" style="font-weight: 600; font-size: 14px;">
                        Регистрация #${index + 1}
                        <span style="font-size: 11px; font-weight: normal; color: #888; margin-left: 10px;">
                            ${formattedDate || ''}
                        </span>
                    </div>
                    <div class="badge" style="background: ${statusBadge.bgColor}; color: ${statusBadge.textColor}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; border: 1px solid ${statusBadge.color}20;">
                        ${statusBadge.text}
                    </div>
                </div>
                <div class="card-body" style="font-size: 13px; padding: 10px 0;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 3px;">🏢 Поставщик</div>
                            <div style="font-weight: 500; color: #333; word-break: break-word;">${escapeHTML(safeItem.supplier)}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 3px;">📦 Тип товара</div>
                            <div style="font-weight: 500; color: #333;">${escapeHTML(safeItem.productType)}</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 3px;">🏛️ Юрлицо</div>
                            <div style="font-weight: 500; color: #333;">${escapeHTML(safeItem.legalEntity)}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 3px;">🚪 Ворота</div>
                            <div style="font-weight: 500; color: #333;">${escapeHTML(safeItem.assignedGate || safeItem.defaultGate)}</div>
                        </div>
                    </div>
                    
                    ${safeItem.vehicleNumber !== 'Не указан' ? `
                        <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
                            <div style="font-size: 11px; color: #666; min-width: 70px;">🚗 Номер ТС</div>
                            <div style="font-weight: 500; color: #333; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">
                                ${escapeHTML(safeItem.vehicleNumber)}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${safeItem.problemType ? `
                        <div style="margin: 8px 0; padding: 8px; background: #ffebee; border-radius: 6px; border-left: 3px solid #f44336;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="color: #f44336; font-size: 14px;">⚠️</div>
                                <div>
                                    <div style="font-size: 11px; color: #c62828; font-weight: 600;">Проблема</div>
                                    <div style="font-size: 12px; color: #c62828;">${escapeHTML(safeItem.problemType)}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div>👆 Нажмите для подробной информации</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 6px; height: 6px; border-radius: 50%; background: #4285f4;"></div>
                            <div>Подробнее</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Добавляем статистику внизу
    html += `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f0f0f0;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
                <div>Всего регистраций: <strong>${history.length}</strong></div>
                <div>${new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
        </div>
    `;
    
    return html;
}


// Функция для рендеринга вкладки уведомлений
function renderNotificationsTab(notifications) {
    const allNotifications = Array.isArray(notifications) ? notifications : [];
    const unreadCount = allNotifications.filter(n => !n.status || n.status !== 'read').length;

    if (allNotifications.length === 0) {
        return `
            <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #999;">
                <div style="font-size: 40px; margin-bottom: 15px;">🔕</div>
                <p>Нет уведомлений</p>
                <p style="font-size: 14px; margin-top: 10px;">Уведомления появятся здесь при изменении статуса</p>
            </div>
        `;
    }

    let html = `
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 12px;">
            <button class="btn btn-secondary" onclick="markAllNotificationsAsRead()" style="padding: 8px 12px; font-size: 13px;">
                ✅ Отметить всё прочитанным${unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
    `;

    allNotifications.forEach((notification) => {
        const isUnread = !notification.status || notification.status !== 'read';
        const icon = getNotificationIcon(notification.type);
        const color = getNotificationColor(notification.type);
        const formattedDate = formatNotificationTime(notification.timestamp || notification.formattedTimestamp || '');

        html += `
            <div class="notification-item" style="
                background: ${isUnread ? color.background : '#f6f7f9'};
                border-left: 6px solid ${isUnread ? color.border : '#cfd4da'};
                padding: 12px 15px;
                margin-bottom: 10px;
                border-radius: 10px;
                color: #222;
                ${isUnread ? 'box-shadow: 0 6px 18px rgba(0,0,0,0.06);' : ''}
            ">
                <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                    <div style="font-size: 20px; margin-right: 10px; margin-top: 2px;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 5px; font-size: 15px; color: #111;">
                            ${isUnread ? '● ' : ''}${notification.title || 'Уведомление'}
                        </div>
                        <div style="font-size: 13px; color: #666; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span>${formattedDate}</span>
                            ${notification.type ? `<span style="background: ${isUnread ? (color.border + '22') : '#e9ecef'}; padding: 2px 8px; border-radius: 999px; font-size: 11px; color: ${isUnread ? '#333' : '#666'};">${notification.type}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="font-size: 14px; line-height: 1.4; margin-top: 8px; color: #222;">
                    ${notification.message || ''}
                </div>
                ${notification.data && notification.data.gate ? `
                    <div style="margin-top: 10px; padding: 8px; background: rgba(66, 133, 244, 0.1); border-radius: 8px; font-size: 13px; color: #222;">
                        <strong>🚪 Ворота:</strong> ${notification.data.gate}
                    </div>
                ` : ''}

                ${isUnread ? `
                    <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-primary" onclick="markNotificationAsRead('${notification.id}', ${notification.rowNumber || 0})" style="padding: 8px 12px; font-size: 13px;">
                            ✔ Отметить прочитанным
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

// Функция для рендеринга вкладки статуса
function renderStatusTab(history) {
    if (history.length === 0) {
        return `
            <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #999;">
                <div style="font-size: 40px; margin-bottom: 15px;">📭</div>
                <p>Нет данных о текущем статусе</p>
                <p style="font-size: 14px; margin-top: 10px;">Пройдите регистрацию для получения статуса</p>
            </div>
        `;
    }
    
    // Берем последнюю регистрацию
    const latestRegistration = history[0];
    const statusBadge = getStatusBadge(latestRegistration.status);
    const formattedDate = formatNotificationTime(latestRegistration.displayDate || latestRegistration.date || '');
    
    return `
        <div class="status-overview" style="margin-bottom: 20px;">
            <div class="info-box" style="background: ${statusBadge.bgColor + '20'}; border-left: 4px solid ${statusBadge.color};">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div class="badge" style="background: ${statusBadge.bgColor}; color: ${statusBadge.color}; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">
                        ${statusBadge.text}
                    </div>
                    <div style="margin-left: auto; font-size: 12px; color: #666;">
                        ${formattedDate}
                    </div>
                </div>
                
                <p style="margin: 8px 0;">
                    <strong>🏢 Поставщик:</strong> ${latestRegistration.supplier || 'Не указан'}
                </p>
                <p style="margin: 8px 0;">
                    <strong>📦 Тип товара:</strong> ${latestRegistration.productType || 'Не указан'}
                </p>
                <p style="margin: 8px 0;">
                    <strong>🚪 Ворота:</strong> ${latestRegistration.assignedGate || latestRegistration.defaultGate || 'Не назначены'}
                </p>
                ${latestRegistration.vehicleNumber ? `
                    <p style="margin: 8px 0;">
                        <strong>🚗 Номер ТС:</strong> ${latestRegistration.vehicleNumber}
                    </p>
                ` : ''}
                ${latestRegistration.problemType ? `
                    <p style="margin: 8px 0; color: #f44336;">
                        <strong>⚠️ Проблема:</strong> ${latestRegistration.problemType}
                    </p>
                ` : ''}
            </div>
        </div>
        
        <h4 style="margin-bottom: 15px; font-size: 16px;">Рекомендации:</h4>
        ${getStatusRecommendations(latestRegistration.status)}
    `;
}

// Вспомогательные функции
function getStatusBadge(status) {
    const statusMap = {
        'Зарегистрирован': { 
            text: 'Зарегистрирован', 
            color: '#ffffff', // БЕЛЫЙ текст
            bgColor: '#2196f3', // Голубой фон
            textColor: '#ffffff' // Белый текст
        },
        'Назначены ворота': { 
            text: 'Назначены ворота', 
            color: '#ffffff', 
            bgColor: '#4caf50',
            textColor: '#ffffff'
        },
        'Документы готовы к выдаче': { 
            text: 'Документы готовы', 
            color: '#ffffff', 
            bgColor: '#4caf50',
            textColor: '#ffffff'
        },
        'Отказ в приемке': { 
            text: 'Отказ в приемке', 
            color: '#ffffff', 
            bgColor: '#f44336',
            textColor: '#ffffff'
        },
        'Нет в графике': { 
            text: 'Нет в графике', 
            color: '#ffffff', 
            bgColor: '#ff9800',
            textColor: '#333333' // Темный текст на оранжевом
        },
        'Проблема с товаром': { 
            text: 'Проблема с товаром', 
            color: '#ffffff', 
            bgColor: '#ff9800',
            textColor: '#333333'
        },
        'Проблема с документами': { 
            text: 'Проблема с документами', 
            color: '#ffffff', 
            bgColor: '#ff9800',
            textColor: '#333333'
        }
    };
    
    return statusMap[status] || { 
        text: status || 'Неизвестно', 
        color: '#ffffff', 
        bgColor: '#666666',
        textColor: '#ffffff'
    };
}

function getNotificationIcon(type) {
    const iconMap = {
        'gate_assigned': '🚪',
        'documents_ready': '📄',
        'rejection': '❌',
        'rejection_detail': '❌',
        'out_of_schedule': '⏰',
        'problem_initial': '⚠️',
        'problem_detail': '⚠️',
        'status_change': '📋'
    };
    
    return iconMap[type] || '🔔';
}

// Функция для возврата к предыдущему модальному окну
function returnToPreviousModal() {
    if (window.previousActiveModal) {
        ModalManager.closeCurrent(); // Закрываем текущее окно
        
        // Восстанавливаем предыдущее
        const prevModal = document.getElementById(window.previousActiveModal);
        if (prevModal) {
            prevModal.style.display = 'flex';
            currentActiveModal = window.previousActiveModal;
        }
        
        delete window.previousActiveModal;
    }
}

function getNotificationColor(type) {
    const colorMap = {
        'gate_assigned': { background: '#e8f5e9', border: '#4caf50' },
        'documents_ready': { background: '#e8f5e9', border: '#4caf50' },
        'rejection': { background: '#ffebee', border: '#f44336' },
        'rejection_detail': { background: '#ffebee', border: '#f44336' },
        'out_of_schedule': { background: '#fff3e0', border: '#ff9800' },
        'problem_initial': { background: '#fff3e0', border: '#ff9800' },
        'problem_detail': { background: '#fff3e0', border: '#ff9800' },
        'status_change': { background: '#e3f2fd', border: '#2196f3' }
    };
    
    return colorMap[type] || { background: '#f5f5f5', border: '#666' };
}

function getStatusRecommendations(status) {
    const recommendations = {
        'Зарегистрирован': `
            <div class="info-box" style="margin-bottom: 10px;">
                <p>⏳ Ожидайте назначения ворот...</p>
                <p>📱 Вам придет уведомление, когда ворота будут назначены</p>
            </div>
        `,
        'Назначены ворота': `
            <div class="info-box" style="margin-bottom: 10px;">
                <p>✅ Ворота назначены!</p>
                <p>📍 Проследуйте к указанным воротам</p>
                <p>⏰ Если ворота заняты - ожидайте очереди</p>
            </div>
        `,
        'Документы готовы к выдаче': `
            <div class="info-box" style="margin-bottom: 10px;">
                <p>✅ Документы готовы!</p>
                <p>📄 Подойдите к диспетчеру для получения документов</p>
            </div>
        `,
        'Отказ в приемке': `
            <div class="warning-box" style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 15px; margin-bottom: 10px;">
                <p>❌ Отказ в приемке!</p>
                <p>📞 Свяжитесь с вашим поставщиком для уточнения деталей</p>
            </div>
        `,
        'Нет в графике': `
            <div class="warning-box" style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 15px; margin-bottom: 10px;">
                <p>⏰ Вы приехали вне графика!</p>
                <p>📞 Свяжитесь с вашим поставщиком для согласования</p>
            </div>
        `
    };
    
    return recommendations[status] || `
        <div class="info-box">
            <p>📱 Для получения информации обратитесь к диспетчеру</p>
        </div>
    `;
}


function getNotificationBorderColor(type) {
    const colorMap = {
        'gate_assigned': '#4caf50',
        'documents_ready': '#4caf50',
        'rejection': '#f44336',
        'rejection_detail': '#f44336',
        'out_of_schedule': '#ff9800',
        'problem_initial': '#ff9800',
        'problem_detail': '#ff9800',
        'status_change': '#2196f3'
    };
    
    return colorMap[type] || '#666';
}

function getStatusBoxClass(status) {
    const classMap = {
        'Назначены ворота': '',
        'Документы готовы к выдаче': '',
        'Проблема с товаром': 'warning',
        'Проблема с документами': 'warning',
        'Отказ в приемке': 'warning',
        'Нет в графике': 'warning'
    };
    
    return classMap[status] || '';
}

// Исправленная функция для отображения времени уведомлений
function formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        // Если уже в формате "дд.мм.гггг чч:мм", возвращаем как есть
        if (typeof timestamp === 'string' && 
            timestamp.includes('.') && 
            timestamp.includes(':') &&
            timestamp.includes(' ')) {
            
            const [datePart, timePart] = timestamp.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hours, minutes] = timePart.split(':');
            
            // Проверяем корректность
            if (day && month && year && hours && minutes) {
                // ВАЖНО: НЕ прибавляем 3 часа - время уже правильное
                return `${day}.${month}.${year} ${hours}:${minutes}`;
            }
            
            return timestamp;
        }
        
        // Если это ISO строка или Date объект
        let date;
        if (typeof timestamp === 'string') {
            // Пробуем разные форматы
            if (timestamp.includes('T')) {
                // ISO формат - парсим как есть
                date = new Date(timestamp);
            } else if (timestamp.includes('.')) {
                // Формат "дд.мм.гггг"
                const [day, month, year] = timestamp.split('.');
                date = new Date(year, month - 1, day);
            }
        } else if (timestamp instanceof Date) {
            date = timestamp;
        }
        
        if (!date || isNaN(date.getTime())) {
            return timestamp;
        }
        
        // ВАЖНО: НЕ добавляем 3 часа - оставляем время как есть
        // Google Sheets уже хранит время в правильном часовом поясе
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}`;
        
    } catch (e) {
        console.error('Ошибка форматирования времени:', e);
        return timestamp;
    }
}

// Исправленная функция для сравнения дат
function compareDates(dateStr1, dateStr2) {
    const date1 = parseAnyDate(dateStr1);
    const date2 = parseAnyDate(dateStr2);
    return date1 - date2;
}

// Проверка нужно ли включать уведомление
function shouldIncludeNotification(timestamp, lastUpdate) {
    try {
        const notificationDate = parseAnyDate(timestamp);
        const lastUpdateDate = parseAnyDate(lastUpdate);
        return notificationDate > lastUpdateDate;
    } catch (e) {
        return true;
    }
}

function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    
    // Убрать активный класс со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    const tabElement = document.getElementById(`${tabName}-tab`);
    if (tabElement) {
        tabElement.classList.add('active');
        tabElement.style.display = 'block';
    }
    
    // Активировать кнопку
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.includes(getTabDisplayName(tabName))) {
            btn.classList.add('active');
        }
    });
}

function getTabDisplayName(tabName) {
    const map = {
        'history': 'История регистраций',
        'notifications': 'Уведомления',
        'status': 'Текущий статус'
    };
    return map[tabName] || tabName;
}

async function refreshDriverCabinet() {
    const modal = document.getElementById('driver-cabinet-modal');
    if (modal) {
        showLoader(true);
        
        try {
            const data = modal._cabinetData;
            if (!data || !data.driverPhone) {
                showNotification('Ошибка обновления данных', 'error');
                return;
            }
            
            // Обновляем данные
            const [history, notifications, statusUpdates] = await Promise.all([
                getDriverHistory(data.driverPhone),
                getPWANotifications(data.driverPhone),
                getDriverStatusUpdates(data.driverPhone)
            ]);
            
            // Обновляем отображение
            document.getElementById('history-tab').innerHTML = renderHistoryTab(history);
            document.getElementById('notifications-tab').innerHTML = renderNotificationsTab(notifications);
            document.getElementById('status-tab').innerHTML = renderStatusTab(statusUpdates);
            
            // Обновляем счетчик уведомлений
            const notificationBtn = document.querySelector('.tab-btn[onclick*="notifications"]');
            if (notificationBtn) {
                const unreadCount = notifications.filter(n => !n.status || n.status !== 'read').length;
                notificationBtn.innerHTML = `🔔 Уведомления (${unreadCount})`;
            }
            
            showNotification('✅ Данные обновлены', 'success');
            
        } catch (error) {
            logToConsole('ERROR', 'Ошибка обновления личного кабинета', error);
            showNotification('❌ Ошибка обновления данных', 'error');
        } finally {
            showLoader(false);
        }
    }
}

function saveDriverRegistrationData() {
    try {
        if (registrationState.data && registrationState.data.phone) {
            const dataToSave = {
                phone: registrationState.data.phone,
                fio: registrationState.data.fio,
                supplier: registrationState.data.supplier,
                legalEntity: registrationState.data.legalEntity,
                vehicleNumber: registrationState.data.vehicleNumber,
                timestamp: Date.now(),
                date: new Date().toLocaleString('ru-RU')
            };
            
            // Сохраняем в localStorage
            localStorage.setItem('driver_last_registration', JSON.stringify(dataToSave));
            
            // Также сохраняем в историю
            const history = JSON.parse(localStorage.getItem('driver_registration_history') || '[]');
            history.unshift(dataToSave);
            
            // Ограничиваем историю последними 20 записями
            if (history.length > 20) {
                history.pop();
            }
            
            localStorage.setItem('driver_registration_history', JSON.stringify(history));
            
            console.log('Данные регистрации сохранены:', dataToSave);
        }
    } catch (error) {
        console.error('Ошибка сохранения данных регистрации:', error);
    }
}

// ==================== ЗАПУСК ПРОВЕРКИ УВЕДОМЛЕНИЙ ====================
let notificationCheckInterval = null;

function startNotificationChecker() {
    console.log('Запускаю проверку уведомлений...');
    
    // Останавливаем предыдущий интервал если есть
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    
    // Проверяем каждые 30 секунд
    notificationCheckInterval = setInterval(async () => {
        await checkForNewNotifications();
    }, 30000); // 30 секунд
    
    // Запускаем первую проверку сразу
    setTimeout(() => {
        checkForNewNotifications();
    }, 5000); // Через 5 секунд после загрузки
    
    console.log('Проверка уведомлений запущена');
}

// ==================== ПРОВЕРКА НОВЫХ УВЕДОМЛЕНИЙ ====================
async function checkForNewNotifications() {
    try {
        ensureRegistrationState();
        // Проверяем есть ли интернет
        if (!navigator.onLine) {
            // console.log('Нет интернета, пропускаю проверку уведомлений');
            return;
        }
        
        // Получаем текущий телефон
        let driverPhone = '';
        
        if (registrationState && registrationState.data && registrationState.data.phone) {
            driverPhone = registrationState.data.phone;
        } else {
            // Пробуем получить из localStorage
            const lastReg = localStorage.getItem('driver_last_registration');
            if (lastReg) {
                try {
                    const data = JSON.parse(lastReg);
                    driverPhone = data.phone || '';
                } catch (e) {
                    console.log('Ошибка парсинга последней регистрации:', e);
                }
            }
        }
        
        if (!driverPhone) {
            // console.log('Нет телефона для проверки уведомлений');
            return;
        }
        
        // Проверяем когда была последняя проверка
        const lastCheckKey = 'last_notification_check_' + driverPhone;
        const lastCheck = localStorage.getItem(lastCheckKey);
        const now = Date.now();
        
        // Не проверяем чаще чем раз в 20 секунд
        if (lastCheck && (now - parseInt(lastCheck)) < 20000) {
            // console.log('Слишком частая проверка, пропускаю');
            return;
        }
        
        // Обновляем время последней проверки
        localStorage.setItem(lastCheckKey, now.toString());
        
        // Получаем новые уведомления
        const notifications = await getPWANotifications(driverPhone);
        
        if (notifications && notifications.length > 0) {
            console.log('Найдено новых уведомлений:', notifications.length);
            
            // Считаем непрочитанные
            const unreadCount = notifications.filter(n => !n.status || n.status !== 'read').length;
            
            if (unreadCount > 0) {
                // Обновляем иконку/баджик в заголовке
                updateNotificationBadge(unreadCount);

                // Локальные уведомления (Notification API): показываем только новые непрочитанные
                if (isLocalNotificationsEnabled() && ("Notification" in window) && Notification.permission === 'granted') {
                    const unread = notifications.filter(n => !n.status || n.status !== 'read');
                    // ограничим всплывашки, чтобы не было шквала
                    unread.slice(0, 3).forEach(n => {
                        if (n && n.id && !hasShownNotification(driverPhone, n.id)) {
                            createBrowserNotification(n);
                            markNotificationShown(driverPhone, n.id);
                        }
                    });
                }
                
                // Если открыт модальный кабинет и вкладка уведомлений, обновляем её содержимое
                // Обновляем UI кабинета/модалок из кэша (getPWANotifications уже обновляет localStorage cache)
                updateNotificationsUIFromCache(driverPhone);
                updateNotificationsOnlyModalFromCache(driverPhone);

                // Совместимость со старым id вкладки
                const notificationsTab = document.getElementById('cabinet-notifications-tab') || document.getElementById('notifications-tab');
                if (notificationsTab) {
                    notificationsTab.innerHTML = renderNotificationsTab(notifications);
                }
                
                // Показываем всплывающее уведомление если приложение активно
                if (document.hasFocus()) {
                    if (unreadCount === 1) {
                        const latest = notifications[0];
                        showNotification(`🔔 ${latest.title}`, 'info');
                    } else {
                        showNotification(`🔔 ${unreadCount} новых уведомлений`, 'info');
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Ошибка при проверке уведомлений:', error);
    }
}

// ==================== ОБНОВЛЕНИЕ БЭЙДЖА УВЕДОМЛЕНИЙ ====================
function updateNotificationBadge(count) {
    try {
        if (count > 0) {
            // Обновляем заголовок страницы
            document.title = `(${count}) УЛН. Регистрация водителей`;
            
            // Обновляем favicon (если есть)
            const favicon = document.querySelector('link[rel="icon"]');
            if (favicon) {
                // Можно добавить красную точку на иконку
                // Это более сложная реализация, требующая Canvas
            }
            
            // Обновляем кнопку личного кабинета если она видна
            const cabinetBtn = document.querySelector('button[onclick*="openDriverCabinet"]');
            if (cabinetBtn) {
                // Ищем существующий бэйдж
                let badge = cabinetBtn.querySelector('.notification-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.style.cssText = `
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #f44336;
                        color: white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                    `;
                    cabinetBtn.style.position = 'relative';
                    cabinetBtn.appendChild(badge);
                }
                badge.textContent = count > 9 ? '9+' : count.toString();
                badge.style.display = 'block';
            }

            // Обновляем бейджи на кнопках "Уведомления" (шаг 1 / успех)
            const staticBadges = document.querySelectorAll('.notification-badge-static');
            staticBadges.forEach(b => {
                b.textContent = count > 9 ? '9+' : count.toString();
                b.style.display = 'inline-block';
            });
        } else {
            // Сбрасываем заголовок
            document.title = 'УЛН. Регистрация водителей';
            
            // Скрываем бэйдж
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                badge.style.display = 'none';
            }

            // Скрываем статические бейджи
            const staticBadges = document.querySelectorAll('.notification-badge-static');
            staticBadges.forEach(b => {
                b.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('Ошибка обновления бэйджей:', error);
    }
}

function openNotificationsCenter() {
    try {
        showNotificationsOnlyModal();
    } catch (e) {
        console.error('Ошибка открытия центра уведомлений:', e);
    }
}

async function openAdminPanel() {
    try {
        const password = prompt('Введите пароль администратора');
        if (password === null) {
            return;
        }
        if (password !== 'adm123') {
            showNotification('Неверный пароль', 'error');
            return;
        }

        showLoader(true);
        const url = new URL(CONFIG.APP_SCRIPT_URL);
        url.searchParams.append('action', 'get_admin_report');
        url.searchParams.append('_t', Date.now());

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
        });

        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error('Неверный формат ответа отчета');
        }

        showLoader(false);

        if (!result || !result.success) {
            showNotification(result?.message || 'Не удалось получить отчет', 'error');
            return;
        }

        showAdminReportModal(result.reportText || '');

    } catch (e) {
        showLoader(false);
        console.error('Ошибка админ-панели:', e);
        showNotification('Ошибка получения отчета', 'error');
    }
}

function showAdminReportModal(reportText) {
    const modalId = 'admin-report-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const safeText = (reportText || '').toString();
    const html = `
        <div class="modal-overlay" id="${modalId}" onclick="if(event.target === this) closeAdminReportModal()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3 class="modal-title">🛠️ Администрирование</h3>
                    <button class="modal-close" onclick="closeAdminReportModal()">✕</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow-y: auto;">
                    <div class="info-box" style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                        ${escapeHTML(safeText)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeAdminReportModal()">Закрыть</button>
                    <button class="btn btn-info" onclick="copyAdminReportText(${JSON.stringify(safeText).replace(/"/g, '&quot;')})" style="margin-left: 10px;">📋 Копировать</button>
                    <button class="btn btn-primary" onclick="openAdminPanel()" style="margin-left: 10px;">🔄 Обновить</button>
                </div>
            </div>
        </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
}

function closeAdminReportModal() {
    closeModalById('admin-report-modal');
}

function copyAdminReportText(reportText) {
    try {
        const textToCopy = (reportText || '').toString();
        if (!textToCopy) {
            showNotification('Нет текста для копирования', 'warning');
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showNotification('✅ Отчет скопирован в буфер обмена', 'success');
            }).catch(() => {
                fallbackCopyTextToClipboard(textToCopy);
            });
        } else {
            fallbackCopyTextToClipboard(textToCopy);
        }
    } catch (e) {
        console.error('Ошибка копирования отчета:', e);
        showNotification('Ошибка копирования', 'error');
    }
}

async function showNotificationsOnlyModal() {
    try {
        const { phone } = getCabinetIdentity();
        if (!phone) {
            showNotification('Введите номер телефона для просмотра уведомлений', 'warning');
            return;
        }

        showLoader(true);
        const notifications = await getPWANotifications(phone);
        showLoader(false);

        const modalId = 'notifications-only-modal';
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const unreadCount = (notifications || []).filter(n => !n.status || n.status !== 'read').length;

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target === this) closeNotificationsOnlyModal()">
                <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="notifications-only-title">🔔 Уведомления ${unreadCount > 0 ? `(${unreadCount})` : ''}</h3>
                        <button class="modal-close" onclick="closeNotificationsOnlyModal()">✕</button>
                    </div>

                    <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 0 20px;">
                        <div style="display: flex; justify-content: flex-end; padding: 12px 0;">
                            <button class="btn btn-secondary" id="toggle-local-notifications-btn" onclick="enableLocalNotifications()" style="padding: 8px 12px; font-size: 13px;">
                                🔕 Включить уведомления
                            </button>
                        </div>
                        <div id="notifications-only-content">
                            ${renderNotificationsTab(notifications || [])}
                        </div>
                    </div>

                    <div class="modal-footer" style="position: sticky; bottom: 0; background: white; border-top: 1px solid #f0f0f0; padding: 15px 20px; margin-top: auto;">
                        <button class="btn btn-secondary" onclick="closeNotificationsOnlyModal()">Закрыть</button>
                        <button class="btn btn-primary" onclick="refreshNotificationsOnlyModal(true)" style="margin-left: 10px;">🔄 Обновить</button>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

        // Обновляем текст/статус кнопки локальных уведомлений
        updateLocalNotificationsUI();

        // Запускаем автообновление раз в минуту, пока окно открыто
        if (typeof window !== 'undefined') {
            if (window.notificationsOnlyAutoRefreshInterval) {
                clearInterval(window.notificationsOnlyAutoRefreshInterval);
            }
            window.notificationsOnlyAutoRefreshInterval = setInterval(() => {
                refreshNotificationsOnlyModal(false);
            }, 60000);
        }

    } catch (e) {
        showLoader(false);
        console.error('Ошибка открытия окна уведомлений:', e);
        showNotification('Ошибка открытия уведомлений', 'error');
    }
}

async function refreshNotificationsOnlyModal(manual = false) {
    try {
        const modal = document.getElementById('notifications-only-modal');
        if (!modal || modal.style.display === 'none') {
            return;
        }

        const { phone } = getCabinetIdentity();
        if (!phone) {
            return;
        }

        if (manual) {
            showLoader(true);
        }

        const notifications = await getPWANotifications(phone);
        const unreadCount = (notifications || []).filter(n => !n.status || n.status !== 'read').length;

        const titleEl = document.getElementById('notifications-only-title');
        if (titleEl) {
            titleEl.textContent = `🔔 Уведомления${unreadCount > 0 ? ` (${unreadCount})` : ''}`;
        }

        const content = document.getElementById('notifications-only-content');
        if (content) {
            content.innerHTML = renderNotificationsTab(notifications || []);
        }

        updateNotificationBadge(unreadCount);

        if (manual) {
            showLoader(false);
        }
    } catch (e) {
        if (manual) {
            showLoader(false);
        }
        console.error('Ошибка обновления уведомлений:', e);
    }
}

function closeNotificationsOnlyModal() {
    try {
        if (typeof window !== 'undefined' && window.notificationsOnlyAutoRefreshInterval) {
            clearInterval(window.notificationsOnlyAutoRefreshInterval);
            window.notificationsOnlyAutoRefreshInterval = null;
        }
        closeModalById('notifications-only-modal');
    } catch (e) {
        console.error('Ошибка закрытия окна уведомлений:', e);
    }
}

// ==================== ПОКАЗ PUSH УВЕДОМЛЕНИЙ ====================
function showPushNotification(notification) {
    // Проверяем поддержку браузерных уведомлений
    if (!("Notification" in window)) {
        console.log('Браузер не поддерживает уведомления');
        return;
    }
    
    // Проверяем разрешение
    if (Notification.permission === "granted") {
        createBrowserNotification(notification);
    } else if (Notification.permission !== "denied") {
        // Запрашиваем разрешение при первом уведомлении
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                createBrowserNotification(notification);
            }
        });
    }
}

// ==================== СОЗДАНИЕ БРАУЗЕРНОГО УВЕДОМЛЕНИЯ ====================
function createBrowserNotification(notification) {
    try {
        const options = {
            body: notification.message || '',
            icon: '/reg_driver_ULN/icons/icon-192x192.png',
            badge: '/reg_driver_ULN/icons/icon-72x72.png',
            tag: notification.id || 'driver_notification',
            requireInteraction: true,
            data: notification.data || {},
            silent: false
        };
        
        const n = new Notification(notification.title || 'Уведомление для водителя', options);
        
        // Обработчик клика на уведомление
        n.onclick = function(event) {
            event.preventDefault();
            window.focus();
            
            // Показываем личный кабинет
            openDriverCabinet();
            
            // Помечаем уведомление как прочитанное
            if (notification.id) {
                markNotificationAsRead(notification.id);
            }
            
            n.close();
        };
        
        // Автоматически закрыть через 15 секунд
        setTimeout(() => {
            n.close();
        }, 15000);
        
        console.log('Push уведомление показано:', notification.title);
        
    } catch (error) {
        console.error('Ошибка создания push уведомления:', error);
    }
}

// ==================== ПОМЕТКА УВЕДОМЛЕНИЯ КАК ПРОЧИТАННОГО ====================
async function markNotificationAsRead(notificationId) {
    try {
        ensureRegistrationState();
        const rowNumberArg = arguments.length > 1 ? arguments[1] : 0;
        const readAt = formatDateTime(new Date());
        
        // Получаем текущий телефон
        const { phone: driverPhone } = getCabinetIdentity();
        
        if (!driverPhone) return;

        // Определяем строку (rowNumber) в листе PWA_Notifications
        let rowNumber = Number(rowNumberArg) || 0;

        // Если rowNumber не передали, попробуем найти по notificationId в кэше
        if (!rowNumber && notificationId) {
            const cacheKey = 'notifications_cache_' + driverPhone;
            const cachedLookup = localStorage.getItem(cacheKey);
            if (cachedLookup) {
                try {
                    const cacheData = JSON.parse(cachedLookup);
                    if (cacheData.data && Array.isArray(cacheData.data)) {
                        const found = cacheData.data.find(n => n.id === notificationId);
                        if (found && found.rowNumber) {
                            rowNumber = Number(found.rowNumber) || 0;
                        }
                    }
                } catch (e) {
                    // игнор
                }
            }
        }

        // Отмечаем на сервере (Status=read, ReadAt=...)
        if (rowNumber) {
            const resp = await sendAPIRequest({
                action: 'mark_pwa_notification_read',
                phone: driverPhone,
                rowNumber: rowNumber
            });
            if (!resp || !resp.success) {
                throw new Error(resp?.message || 'Не удалось отметить уведомление как прочитанное');
            }
        }
        
        // Обновляем кэш уведомлений
        const cacheKey = 'notifications_cache_' + driverPhone;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                if (cacheData.data && Array.isArray(cacheData.data)) {
                    // Помечаем уведомление как прочитанное
                    cacheData.data = cacheData.data.map(n => {
                        if ((notificationId && n.id === notificationId) || (rowNumber && Number(n.rowNumber) === Number(rowNumber))) {
                            return { ...n, status: 'read', readAt };
                        }
                        return n;
                    });
                    
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                }
            } catch (e) {
                console.log('Ошибка обновления кэша уведомлений:', e);
            }
        }

        // Обновляем UI (вкладка + бэйдж)
        updateNotificationsUIFromCache(driverPhone);
        updateNotificationsOnlyModalFromCache(driverPhone);
        showNotification('✅ Уведомление отмечено как прочитанное', 'success');
        
    } catch (error) {
        console.error('Ошибка пометки уведомления как прочитанного:', error);
        showNotification('❌ Ошибка: не удалось отметить прочитанным', 'error');
    }
}

async function markAllNotificationsAsRead() {
    try {
        ensureRegistrationState();
        const { phone: driverPhone } = getCabinetIdentity();
        if (!driverPhone) {
            showNotification('Нет телефона для отметки уведомлений', 'warning');
            return;
        }

        const resp = await sendAPIRequest({
            action: 'mark_all_pwa_notifications_read',
            phone: driverPhone
        });

        if (!resp || !resp.success) {
            throw new Error(resp?.message || 'Не удалось отметить все уведомления');
        }

        const readAt = formatDateTime(new Date());
        const cacheKey = 'notifications_cache_' + driverPhone;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                if (cacheData.data && Array.isArray(cacheData.data)) {
                    cacheData.data = cacheData.data.map(n => ({
                        ...n,
                        status: 'read',
                        readAt
                    }));
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                }
            } catch (e) {
                // игнор
            }
        }

        updateNotificationsUIFromCache(driverPhone);
        updateNotificationsOnlyModalFromCache(driverPhone);
        showNotification('✅ Все уведомления отмечены прочитанными', 'success');
    } catch (error) {
        console.error('Ошибка отметки всех уведомлений:', error);
        showNotification('❌ Ошибка: не удалось отметить все уведомления', 'error');
    }
}

function updateNotificationsUIFromCache(driverPhone) {
    try {
        const cacheKey = 'notifications_cache_' + driverPhone;
        const cached = localStorage.getItem(cacheKey);
        const notifications = cached ? (JSON.parse(cached).data || []) : [];
        const unreadCount = notifications.filter(n => !n.status || n.status !== 'read').length;

        updateNotificationBadge(unreadCount);

        const tab = document.getElementById('cabinet-notifications-tab') || document.getElementById('notifications-tab');
        if (tab) {
            tab.innerHTML = renderNotificationsTab(notifications);
        }

        // Обновляем подпись на кнопке вкладки (если она есть)
        const modal = document.getElementById('driver-cabinet-modal');
        if (modal) {
            const notificationsBtn = modal.querySelector('.tab-btn:nth-child(2)');
            if (notificationsBtn) {
                notificationsBtn.innerHTML = `🔔 Уведомления (${unreadCount})`;
            }

            const infoBox = modal.querySelector('.info-box');
            if (infoBox) {
                // Только обновим счетчик непрочитанных, не трогая остальной текст
                const pTags = infoBox.querySelectorAll('p');
                pTags.forEach(p => {
                    if (p.textContent && p.textContent.includes('Непрочитанных уведомлений')) {
                        p.innerHTML = `<strong>🔔 Непрочитанных уведомлений:</strong> ${unreadCount}`;
                    }
                });
            }
        }
    } catch (e) {
        console.error('Ошибка обновления UI уведомлений:', e);
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ УВЕДОМЛЕНИЙ ====================
function initializeNotificationSystem() {
    console.log('Инициализация системы уведомлений...');
    
    // Проверяем разрешение на уведомления при загрузке
    if ("Notification" in window && Notification.permission === "default") {
        // Можно показать кнопку для запроса разрешения
        console.log('Push уведомления доступны, разрешение не запрошено');
    }
    
    // Запускаем проверку уведомлений
    startNotificationChecker();
    
    // Обработчик когда приложение становится активным
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Приложение стало активным - проверяем уведомления
            setTimeout(() => {
                checkForNewNotifications();
            }, 1000);
        }
    });
    
    // Проверяем при фокусе на окне
    window.addEventListener('focus', function() {
        setTimeout(() => {
            checkForNewNotifications();
        }, 500);
    });
}

// ==================== ОЧИСТКА СТАРЫХ ОФФЛАЙН ЗАПИСЕЙ ====================

function cleanupOldOfflineRecords() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        
        const filtered = offlineRegistrations.filter(record => {
            if (record.status === 'sent') {
                const sentDate = new Date(record.sentAt || record.timestamp);
                return sentDate > sevenDaysAgo;
            }
            return true;
        });
        
        if (filtered.length !== offlineRegistrations.length) {
            localStorage.setItem('offline_registrations', JSON.stringify(filtered));
            logToConsole('INFO', 'Очищены старые оффлайн записи', {
                before: offlineRegistrations.length,
                after: filtered.length
            });
        }
    } catch (error) {
        logToConsole('ERROR', 'Ошибка очистки старых записей', error);
    }
}

// ==================== СБРОС РЕГИСТРАЦИИ ====================

function resetRegistration() {
    if (confirm('Начать новую регистрацию? Все введенные данные будут потеряны.')) {
        resetRegistrationState();
        clearFormFields();

        // Сбрасываем сохраненный телефон для кабинета, чтобы на шаге 1 требовался ввод
        localStorage.removeItem('driver_info_for_cabinet');
        localStorage.removeItem('last_driver_phone');
        localStorage.removeItem('last_driver_name');

        showStep(1);
        showNotification('Регистрация сброшена', 'info');
    }
}

function resetRegistrationState() {
    registrationState = {
        step: 1,
        data: {
            phone: '',
            fio: '',
            supplier: '',
            legalEntity: '',
            productType: '',
            vehicleType: '',
            vehicleNumber: '',
            pallets: 0,
            orderNumber: '',
            etrn: '',
            transit: '',
            gate: '',
            date: '',
            time: '',
            scheduleViolation: 'Нет'
        }
    };
    
    localStorage.removeItem('driver_registration_state');
}

function clearFormFields() {
    const fields = [
        'phone-input', 'fio-input', 'supplier-input', 'brand-input',
        'vehicle-number-input', 'pallets-input', 'order-input', 'etrn-input'
    ];
    
    fields.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
}

// ==================== СОХРАНЕНИЕ СОСТОЯНИЯ ====================

function saveRegistrationState() {
    try {
        localStorage.setItem('driver_registration_state', JSON.stringify(registrationState));
    } catch (error) {
        logToConsole('ERROR', 'Ошибка сохранения состояния', error);
    }
}

function loadRegistrationState() {
    try {
        ensureRegistrationState();
        const saved = localStorage.getItem('driver_registration_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            registrationState = parsed;
            ensureRegistrationState();
            
            const phoneInput = document.getElementById('phone-input');
            const fioInput = document.getElementById('fio-input');
            
            if (phoneInput && registrationState.data.phone) {
                phoneInput.value = formatPhoneDisplay(registrationState.data.phone);
            }
            
            if (fioInput && registrationState.data.fio) {
                fioInput.value = registrationState.data.fio;
            }
        }
    } catch (error) {
        logToConsole('ERROR', 'Ошибка загрузки состояния', error);
    }
}

// ==================== ПОКАЗ ЛОГОВ ====================

function showLogsModal() {
    try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        
        let html = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">📊 Логи приложения</h3>
                        <button class="modal-close" onclick="closeModal(event)">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <button class="btn btn-secondary" onclick="exportLogs()">Экспорт логов</button>
                                                        <button class="btn btn-danger" onclick="clearLogs()">Очистить логи</button>
                        </div>
                        <div style="max-height: 400px; overflow-y: auto;">
        `;
        
        if (logs.length === 0) {
            html += '<p>Логи отсутствуют</p>';
        } else {
            logs.forEach((log, index) => {
                const time = new Date(log.timestamp).toLocaleString('ru-RU');
                const levelClass = {
                    'INFO': 'badge-info',
                    'WARN': 'badge-warning',
                    'ERROR': 'badge-danger',
                    'SUCCESS': 'badge-success'
                }[log.level] || 'badge-info';
                
                html += `
                    <div class="card" style="margin-bottom: 10px; font-size: 12px;">
                        <div class="card-header">
                            <div class="badge ${levelClass}">${log.level}</div>
                            <div style="color: #666; font-size: 11px;">${time}</div>
                        </div>
                        <div class="card-body">
                            <p style="margin: 0 0 5px 0; font-weight: 600;">${log.message}</p>
                            ${log.data ? `<pre style="background: #f5f5f5; padding: 5px; border-radius: 4px; margin: 0; font-size: 11px; overflow-x: auto;">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal(event)">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка показа логов', error);
        alert('Ошибка загрузки логов: ' + error.message);
    }
}

function exportLogs() {
    try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        const logsText = logs.map(log => 
            `[${log.level}] ${new Date(log.timestamp).toLocaleString('ru-RU')} - ${log.message}` + 
            (log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '')
        ).join('\n\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Логи экспортированы', 'success');
    } catch (error) {
        logToConsole('ERROR', 'Ошибка экспорта логов', error);
        showNotification('Ошибка экспорта логов', 'error');
    }
}

function clearLogs() {
    if (confirm('Очистить все логи?')) {
        localStorage.removeItem('app_logs');
        closeModalById('logs-modal');
        showNotification('Логи очищены', 'info');
    }
}

// ==================== ТЕСТИРОВАНИЕ API ====================

async function testAPIConnectionDetailed() {
    try {
        logToConsole('INFO', 'Тестирую соединение с API (детально)');
        
        const tests = [
            { name: 'GET ping', url: CONFIG.APP_SCRIPT_URL + '?action=ping&test=' + Date.now() },
            { name: 'POST test', url: CONFIG.APP_SCRIPT_URL, method: 'POST' }
        ];
        
        const results = [];
        
        for (const test of tests) {
            try {
                const startTime = Date.now();
                const response = await fetch(test.url, {
                    method: test.method || 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                let result = {
                    test: test.name,
                    status: response.status,
                    ok: response.ok,
                    duration: duration,
                    url: test.url
                };
                
                if (response.ok) {
                    try {
                        const text = await response.text();
                        result.response = text.substring(0, 200);
                        result.success = true;
                    } catch (e) {
                        result.success = false;
                        result.error = 'Не удалось прочитать ответ';
                    }
                } else {
                    result.success = false;
                    result.error = `HTTP ${response.status}`;
                }
                
                results.push(result);
                
            } catch (error) {
                results.push({
                    test: test.name,
                    success: false,
                    error: error.message,
                    url: test.url
                });
            }
        }
        
        logToConsole('INFO', 'Результаты теста API', results);
        return results;
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка тестирования API', error);
        return [];
    }
}

// ==================== СЕТЕВЫЕ ЛОГИ ====================

function showNetworkLogs() {
    try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        const networkLogs = logs.filter(log => 
            log.message.includes('API') || 
            log.message.includes('отправк') || 
            log.message.includes('HTTP') ||
            log.message.includes('ошибк')
        );
        
        let html = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">🌐 Сетевые логи</h3>
                        <button class="modal-close" onclick="closeModal(event)">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <button class="btn btn-secondary" onclick="clearNetworkLogs()">Очистить сетевые логи</button>
                            <button class="btn btn-primary" onclick="retryFailedRequests()">Повторить неудачные запросы</button>
                        </div>
                        <div style="max-height: 500px; overflow-y: auto;">
        `;
        
        if (networkLogs.length === 0) {
            html += '<p>Сетевые логи отсутствуют</p>';
        } else {
            networkLogs.forEach((log, index) => {
                const time = new Date(log.timestamp).toLocaleString('ru-RU');
                const levelClass = {
                    'INFO': 'badge-info',
                    'WARN': 'badge-warning',
                    'ERROR': 'badge-danger',
                    'SUCCESS': 'badge-success'
                }[log.level] || 'badge-info';
                
                html += `
                    <div class="modal-card" style="margin-bottom: 10px; border-left: 4px solid ${
                        log.level === 'ERROR' ? '#f44336' : 
                        log.level === 'WARN' ? '#ff9800' : 
                        log.level === 'SUCCESS' ? '#4caf50' : '#2196f3'
                    };">
                        <div class="modal-card-header">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="modal-card-badge ${levelClass}">${log.level}</div>
                                <div style="color: #666; font-size: 11px;">${time}</div>
                            </div>
                        </div>
                        <div class="modal-card-content">
                            <p style="margin: 0 0 5px 0; font-weight: 600;">${log.message}</p>
                            ${log.data ? `<pre style="background: #f5f5f5; padding: 5px; border-radius: 4px; margin: 0; font-size: 11px; overflow-x: auto; max-height: 150px; overflow-y: auto;">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal(event)">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка показа сетевых логов', error);
        alert('Ошибка загрузки сетевых логов: ' + error.message);
    }
}

function clearNetworkLogs() {
    if (confirm('Очистить сетевые логи?')) {
        try {
            const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
            const filteredLogs = logs.filter(log => 
                !log.message.includes('API') && 
                !log.message.includes('отправк') && 
                !log.message.includes('HTTP')
            );
            localStorage.setItem('app_logs', JSON.stringify(filteredLogs));
            closeModalById('network-logs-modal');
            showNotification('Сетевые логи очищены', 'info');
        } catch (error) {
            showNotification('Ошибка очистки логов', 'error');
        }
    }
}

async function retryFailedRequests() {
    showLoader(true);
    try {
        await sendOfflineData();
        showNotification('Попытка отправки выполнена', 'info');
    } catch (error) {
        showNotification('Ошибка при повторной отправке', 'error');
    } finally {
        showLoader(false);
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function escapeHTML(str) {
    if (!str) return '';
    try {
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    } catch (e) {
        return '';
    }
}

// Безопасный парсинг JSON
function safeJSONParse(str, defaultValue = {}) {
    try {
        return JSON.parse(str);
    } catch (error) {
        console.error('Ошибка парсинга JSON:', error);
        return defaultValue;
    }
}

// Безопасная строка для вставки в HTML атрибуты
function safeAttribute(str) {
    if (!str) return '';
    
    try {
        return String(str)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    } catch (error) {
        console.error('Ошибка экранирования атрибута:', error);
        return '';
    }
}

function normalizePhone(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('8') && cleaned.length === 11) {
        cleaned = '7' + cleaned.substring(1);
    }
    
    if (cleaned.length === 10) {
        cleaned = '7' + cleaned;
    }
    
    if (cleaned.startsWith('7') && cleaned.length === 11) {
        cleaned = '+' + cleaned;
    }
    
    return cleaned;
}

function formatPhoneDisplay(phone) {
    if (!phone) return '';
    
    try {
        const cleaned = phone.toString().replace(/\D/g, '');
        
        if (cleaned.length === 11) {
            const part1 = cleaned.substring(1, 4);
            const part2 = cleaned.substring(4, 7);
            const part3 = cleaned.substring(7, 9);
            const part4 = cleaned.substring(9, 11);
            
            return `${part1} ${part2} ${part3} ${part4}`;
        }
        
        if (cleaned.length === 10) {
            const part1 = cleaned.substring(0, 3);
            const part2 = cleaned.substring(3, 6);
            const part3 = cleaned.substring(6, 8);
            const part4 = cleaned.substring(8, 10);
            
            return `${part1} ${part2} ${part3} ${part4}`;
        }
        
        // Если нестандартный формат, возвращаем как есть
        return phone.toString();
        
    } catch (error) {
        console.error('Ошибка форматирования телефона:', error, phone);
        return phone ? phone.toString() : '';
    }
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Добавьте новую функцию для комбинированного формата
// Форматирование даты в "дд.мм.гггг чч:мм"
function formatDateTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '';
    }
    
    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch (e) {
        console.log('Ошибка форматирования даты:', e);
        return '';
    }
}

// Форматирование даты из любой строки в "дд.мм.гггг чч:мм"
function formatAnyDate(dateStr) {
    if (!dateStr) return '';
    
    const date = parseAnyDate(dateStr);
    return formatDateTime(date);
}

function checkScheduleViolation() {
    const productType = registrationState.data.productType;
    if (!productType) return false;
    
    const schedules = {
        'Сухой': { end: 16, endMinutes: 30 },
        'ФРЕШ': { end: 14, endMinutes: 0 },
        'ФРОВ': { end: 14, endMinutes: 0 },
        'Акциз': { end: 13, endMinutes: 0 }
    };
    
    const schedule = schedules[productType];
    if (!schedule) return false;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    return hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes);
}

function assignGateAutomatically(legalEntity, productType) {
  // Эта функция теперь используется только для показа пользователю
  // В таблицу записывается getDefaultGate из Google Apps Script
  
  if (productType === 'Сухой') {
    if (legalEntity === 'Гулливер') {
      return 'с 31 по 36 (бакалея соль, мука, вода, консервы) и с 38 по 39 (кондитерка, уголь, пакеты)';
    }
    if (legalEntity === 'ТК Лето') {
      return 'с 26 по 30, с 20 по 22 (для кондитерки)';
    }
  }
  
  if (productType === 'ФРЕШ') {
    if (legalEntity === 'Гулливер') {
      return 'с 45 по 51, с 5 по 8 (мясо, куры, колбасы, сыры)';
    }
    if (legalEntity === 'ТК Лето') {
      return 'с 45 по 51 (мясная продукция)';
    }
  }
  
  if (productType === 'ФРОВ') {
    return 'с 9 по 11 (фрукты, овощи)';
  }
  
  if (productType === 'Акциз') {
    return 'с 40 по 41 (крепкий алкоголь)';
  }
  
  return 'Не назначены (проверьте тип товара и юрлицо)';
}

// ==================== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ ДАТЫ ====================

function formatDateUniversal(dateInput) {
    if (!dateInput) return '';
    
    try {
        let date;
        
        // Если это строка
        if (typeof dateInput === 'string') {
            // Убираем лишние пробелы
            dateInput = dateInput.trim();
            
            // Формат "дд.мм.гггг чч:мм"
            if (dateInput.includes('.') && dateInput.includes(':')) {
                const [datePart, timePart] = dateInput.split(' ');
                if (datePart && timePart) {
                    const [day, month, year] = datePart.split('.');
                    const [hours, minutes] = timePart.split(':');
                    
                    // Если есть секунды, убираем их
                    const cleanMinutes = minutes.split('.')[0];
                    
                    date = new Date(
                        parseInt(year, 10),
                        parseInt(month, 10) - 1,
                        parseInt(day, 10),
                        parseInt(hours, 10),
                        parseInt(cleanMinutes, 10),
                        0
                    );
                }
            } else if (dateInput.includes('T')) {
                // ISO формат
                date = new Date(dateInput);
            }
        } else if (dateInput instanceof Date) {
            date = dateInput;
        }
        
        if (!date || isNaN(date.getTime())) {
            return dateInput;
        }
        
        // Форматируем в "дд.мм.гггг чч:мм"
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}`;
        
    } catch (error) {
        console.error('Ошибка форматирования даты:', error, dateInput);
        return dateInput;
    }
}
// ==================== UI ФУНКЦИИ ====================

function showNotification(message, type = 'info') {
    logToConsole('INFO', `Уведомление: ${message}`, { type });
    
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function updateConnectionStatus(isConnected) {
    logToConsole('INFO', `Статус соединения: ${isConnected ? 'онлайн' : 'оффлайн'}`);
    
    const indicator = document.getElementById('connection-indicator');
    const statusElement = document.getElementById('connection-status');
    
    if (indicator) {
        indicator.className = isConnected ? 'online' : 'offline';
        indicator.title = isConnected ? 'Онлайн' : 'Оффлайн';
    }
    
    if (statusElement) {
        statusElement.style.display = isConnected ? 'none' : 'block';
    }
}

function checkConnectionAndSendOffline() {
    if (navigator.onLine) {
        logToConsole('INFO', 'Периодическая проверка: онлайн, отправляю оффлайн данные');
        sendOfflineData();
    } else {
        logToConsole('INFO', 'Периодическая проверка: оффлайн');
    }
}

function showSuccessMessage(serverData = null) {
    logToConsole('INFO', 'Показываю сообщение об успехе');
    
    const container = document.getElementById('success-message');
    if (!container) return;
    
    const data = registrationState.data;
    const defaultGate = serverData?.defaultGate || '';
    const gate = defaultGate || serverData?.assignedGate || data.gate || 'Не назначены';
    const date = serverData?.date || data.date || '';
    const time = serverData?.time || data.time || '';
    
    let html = `
        <div class="success-icon-large">✅</div>
        <div class="success-message">
            <h3>Добро пожаловать, ${data.fio}!</h3>
            <p>Ваша регистрация прошла успешно!</p>
        </div>
        
        <div class="success-details">
            <p><strong>Ваши ворота:</strong> ${gate}</p>
            <p style="margin-top: 6px; color: #555;">Основные ворота вам назначат дополнительно — придет уведомление или с вами свяжутся.</p>
            <p><strong>Статус:</strong> Зарегистрирован</p>
    `;
    
    if (date && time) {
        html += `<p><strong>Время регистрации:</strong> ${date} ${time}</p>`;
    }
    
    html += `
        </div>
        
        <div class="info-box">
            <p>📍 Придерживайтесь схемы движения</p>
            <p>🚛 Соблюдайте скоростной режим 5 км/ч</p>
            <p>📋 Следуйте указаниям персонала</p>
        </div>
    `;

    try {
        const supported = ("Notification" in window);
        const perm = supported ? Notification.permission : 'unsupported';
        const enabled = isLocalNotificationsEnabled();

        if (!supported || perm !== 'granted' || !enabled) {
            html += `
                <div class="info-box warning">
                    <p><strong>Важно:</strong> если уведомления выключены, вы можете <strong>не получить сообщение</strong> на телефон.</p>
                    <p>Нажмите кнопку ниже и разрешите уведомления в браузере.</p>
                    <div class="button-group" style="margin-top: 12px;">
                        <button type="button" class="btn btn-skip" onclick="enableLocalNotifications()">🔔 Включить уведомления</button>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        // ignore
    }
    
    if (data.scheduleViolation === 'Да') {
        html += `
            <div class="warning-box">
                <p>⚠️ <strong>ВНИМАНИЕ!</strong> Вы нарушили график заезда!</p>
                <p>Рекомендуем связаться с вашим поставщиком.</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== ОЧИСТКА КЭША ====================

async function clearCache() {
  try {
    showLoader(true);
    
    const response = await fetch(`${CONFIG.APP_SCRIPT_URL}?action=clear_cache&_t=${Date.now()}`);
    const data = await response.json();
    
    showLoader(false);
    
    if (data.success) {
      showNotification('✅ Кэш поставщиков очищен', 'success');
      logToConsole('INFO', 'Кэш очищен', data);
    } else {
      showNotification('❌ Ошибка очистки кэша', 'error');
      logToConsole('ERROR', 'Ошибка очистки кэша', data);
    }
  } catch (error) {
    showLoader(false);
    showNotification('❌ Ошибка сети при очистке кэша', 'error');
    logToConsole('ERROR', 'Ошибка сети при очистке кэша', error);
  }
}
// ==================== ЭКСПОРТ ФУНКЦИЙ ====================

window.handlePhoneSubmit = handlePhoneSubmit;
window.handleFioSubmit = handleFioSubmit;
window.handleManualSupplier = handleManualSupplier;
window.selectLegalEntity = selectLegalEntity;
window.selectProductType = selectProductType;
window.selectBrand = selectBrand;
window.handleManualBrand = handleManualBrand;
window.handleVehicleNumberSubmit = handleVehicleNumberSubmit;
window.handlePalletsSubmit = handlePalletsSubmit;
window.handleOrderSubmit = handleOrderSubmit;
window.handleEtrnSubmit = handleEtrnSubmit;
window.skipOrderNumber = skipOrderNumber;
window.skipEtrn = skipEtrn;
window.selectTransit = selectTransit;
window.submitRegistration = submitRegistration;
window.resetRegistration = resetRegistration;
window.goBack = goBack;
window.selectSupplier = selectSupplier;
window.showLogsModal = showLogsModal;
window.showOfflineDataModal = showOfflineDataModal;
window.forceSendOfflineData = forceSendOfflineData;
window.closeModal = closeModal;
window.testAPIConnectionDetailed = testAPIConnectionDetailed;
window.showNetworkLogs = showNetworkLogs;
window.showLoader = showLoader;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.resetOfflineAttempts = resetOfflineAttempts;
window.sendViaAlternativeMethod = sendViaAlternativeMethod;
window.clearCache = clearCache;
window.refreshTopData = refreshTopData;
window.openDriverCabinet = openDriverCabinet;
window.closeDriverCabinet = closeDriverCabinet;
window.switchTab = switchTab;
window.refreshDriverCabinet = refreshDriverCabinet;
window.switchCabinetTab = switchCabinetTab;
window.refreshCabinet = refreshCabinet;
window.enterCabinetWithPhone = enterCabinetWithPhone;
window.openDriverCabinetFromStep1 = openDriverCabinetFromStep1;
window.formatDateUniversal = formatDateUniversal;
window.refreshCabinet = refreshCabinet;
window.renderHistoryTab = renderHistoryTab;
window.renderNotificationsTab = renderNotificationsTab;
window.renderStatusTab = renderStatusTab;
window.openRegistrationDetails = openRegistrationDetails;
window.copyRegistrationDetails = copyRegistrationDetails;
window.escapeHTML = escapeHTML;
window.safeJSONParse = safeJSONParse;
window.safeAttribute = safeAttribute;
window.openModal = openModal;
window.closeModalById = closeModalById;
// Удалена несуществующая функция closeCurrentModal
window.closeAllModals = closeAllModals;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.openNotificationsCenter = openNotificationsCenter;
window.openAdminPanel = openAdminPanel;
window.showNotificationsOnlyModal = showNotificationsOnlyModal;
window.refreshCabinetInModal = refreshCabinetInModal;
window.switchCabinetTab = switchCabinetTab;
window.shareRegistration = shareRegistration;
window.getStatusIcon = getStatusIcon;
window.fallbackCopyTextToClipboard = fallbackCopyTextToClipboard;
window.copyAdminReportText = copyAdminReportText;
window.closeDetailsAndRestore = closeDetailsAndRestore;
window.restorePreviousModal = restorePreviousModal;

logToConsole('INFO', 'app.js загружен и готов к работе (оптимизированная версия с ТОП-данными и PWA уведомлениями)');
