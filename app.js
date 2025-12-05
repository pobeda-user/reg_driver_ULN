// app.js v1.3 - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

// Конфигурация
let CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDATeBrTYOYUnP9JrjcUXuKHXbPWl75X-BTE-OFsREZLFB4I9qX-f4Ctu_MzKaGBko/exec',
    APP_VERSION: '1.3'
};

// Глобальные переменные
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

// Логирование
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    logToConsole('INFO', 'Приложение загружается', { version: CONFIG.APP_VERSION });
    
    // Загружаем CONFIG из window если есть
    if (window.CONFIG) {
        CONFIG = { ...CONFIG, ...window.CONFIG };
        logToConsole('INFO', 'Конфигурация загружена', { url: CONFIG.APP_SCRIPT_URL });
    }
    
    // Загружаем сохраненное состояние
    loadRegistrationState();
    
    // Настраиваем обработчики
    setupPhoneInput();
    setupEventListeners();
    
    // Показываем текущий шаг
    showStep(registrationState.step);
    
    // Показываем оффлайн данные
    showOfflineDataCount();
    
    // Тестируем соединение
    setTimeout(() => {
        testAPIConnection();
    }, 1000);
    
    // Периодическая проверка соединения
    setInterval(checkConnectionAndSendOffline, 60000); // Каждую минуту
    
    logToConsole('INFO', 'Приложение инициализировано');
});

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
    // Обработка Enter в полях ввода
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const input = e.target;
            if (input.tagName === 'INPUT') {
                handleEnterKey(input);
            }
        }
    });
    
    // Обновление статуса соединения
    window.addEventListener('online', function() {
        logToConsole('INFO', 'Соединение восстановлено');
        updateConnectionStatus(true);
        showNotification('🌐 Соединение восстановлено', 'success');
        
        // Пробуем отправить оффлайн данные
        setTimeout(() => sendOfflineData(), 2000);
    });
    
    window.addEventListener('offline', function() {
        logToConsole('WARN', 'Соединение потеряно');
        updateConnectionStatus(false);
        showNotification('⚠️ Нет соединения с интернетом', 'warning');
    });
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
    
    // Загружаем историю поставщиков
    loadSupplierHistory();
    showStep(3);
}

// ==================== ШАГ 3: ПОСТАВЩИКИ ====================
async function loadSupplierHistory() {
    logToConsole('INFO', 'Загрузка истории поставщиков');
    
    const container = document.getElementById('supplier-buttons');
    const infoBox = document.getElementById('supplier-history-info');
    
    if (!container || !infoBox) return;
    
    if (!registrationState.data.phone) {
        infoBox.innerHTML = '<p>❌ Нет номера телефона для поиска</p>';
        return;
    }
    
    infoBox.innerHTML = '<p>🔍 Ищу поставщиков...</p>';
    container.innerHTML = '<div class="info-box">Загрузка...</div>';
    
    try {
        const response = await sendAPIRequest({
            action: 'get_suppliers',
            phone: registrationState.data.phone
        });
        
        logToConsole('INFO', 'Ответ поставщиков', response);
        
        if (response && response.success && response.suppliers && response.suppliers.length > 0) {
            infoBox.innerHTML = `<p>✅ Найдено поставщиков: ${response.suppliers.length}</p>`;
            container.innerHTML = '';
            
            response.suppliers.forEach((supplier, index) => {
                if (!supplier || supplier.trim() === '') return;
                
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${supplier}</span>
                `;
                button.onclick = () => {
                    logToConsole('INFO', 'Выбран поставщик', { supplier });
                    selectSupplier(supplier);
                };
                container.appendChild(button);
            });
            
        } else {
            infoBox.innerHTML = '<p>📭 История поставщиков не найдена</p>';
            container.innerHTML = '<div class="info-box">История не найдена. Введите поставщика вручную.</div>';
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка загрузки поставщиков', error);
        infoBox.innerHTML = '<p>⚠️ Ошибка загрузки истории</p>';
        container.innerHTML = '<div class="info-box warning">Ошибка загрузки. Введите поставщика вручную.</div>';
    }
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
    
    // Автоматическое назначение ворот
    const gate = assignGateAutomatically(registrationState.data.legalEntity, type);
    registrationState.data.gate = gate;
    logToConsole('INFO', 'Назначены ворота', { gate });
    
    showStep(6);
}

// ==================== ШАГ 6: МАРКА АВТО ====================
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

// ==================== ШАГ 11: ТРАНЗИТ ====================
function selectTransit(type) {
    logToConsole('INFO', 'Выбран тип доставки', { type });
    registrationState.data.transit = type;
    
    // Обновляем дату и время
    const now = new Date();
    registrationState.data.date = formatDate(now);
    registrationState.data.time = formatTime(now);
    
    // Проверяем нарушение графика
    registrationState.data.scheduleViolation = checkScheduleViolation() ? 'Да' : 'Нет';
    logToConsole('INFO', 'Нарушение графика', { violation: registrationState.data.scheduleViolation });
    
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
            <span class="data-label">📦 Транзит:</span>
            <span class="data-value">${data.transit || ''}</span>
        </div>
        <div class="data-item highlight">
            <span class="data-label">🚪 Ворота:</span>
            <span class="data-value">${data.gate || 'Не назначены'}</span>
        </div>
    `;
    
    if (data.scheduleViolation === 'Да') {
        html += `
            <div class="data-item warning">
                <span class="data-label">⚠️ Нарушение графика:</span>
                <span class="data-value">ДА</span>
            </div>
        `;
    }
    
    // Добавляем кнопку просмотра оффлайн данных
    const offlineCount = getOfflineDataCount();
    if (offlineCount > 0) {
        html += `
            <div class="data-item info" style="background: #e3f2fd; border-radius: 8px; padding: 10px; margin-top: 10px;">
                <span class="data-label">📱 Оффлайн записей:</span>
                <span class="data-value">${offlineCount} <button onclick="showOfflineDataModal()" style="margin-left: 10px; padding: 5px 10px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Просмотр</button></span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== ШАГ 13: ОТПРАВКА ====================
async function submitRegistration() {
    logToConsole('INFO', 'Начинаю отправку регистрации', {
        data: registrationState.data,
        connectionStatus: navigator.onLine ? 'online' : 'offline'
    });
    
    // Проверяем заполненность обязательных полей
    const requiredFields = ['phone', 'fio', 'supplier', 'legalEntity', 'productType'];
    const missingFields = requiredFields.filter(field => !registrationState.data[field]);
    
    if (missingFields.length > 0) {
        showNotification(`Заполните обязательные поля: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // Проверяем соединение
    if (!navigator.onLine) {
        logToConsole('WARN', 'Нет соединения с интернетом');
        showNotification('⚠️ Нет соединения с интернетом. Данные будут сохранены локально.', 'warning');
        
        const saved = saveRegistrationOffline();
        if (saved) {
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
        }
        return;
    }
    
    showLoader(true);
    
    try {
        // Пытаемся отправить онлайн
        logToConsole('INFO', 'Пытаюсь отправить данные онлайн');
        const response = await sendRegistrationToServer(registrationState.data);
        
        logToConsole('INFO', 'Ответ от сервера получен', {
            success: response.success,
            message: response.message,
            hasData: !!response.data
        });
        
        if (response && response.success) {
            logToConsole('SUCCESS', 'Регистрация успешна на сервере!', {
                serverData: response.data
            });
            
            // Обновляем данные из ответа сервера
            if (response.data) {
                Object.assign(registrationState.data, response.data);
            }
            
            // Показываем успешное сообщение
            showSuccessMessage(response.data);
            
            // Сбрасываем состояние
            resetRegistrationState();
            
            // Переходим к шагу успеха
            showStep(13);
            
            showNotification('✅ Регистрация успешно завершена!', 'success');
            
        } else {
            logToConsole('ERROR', 'Ошибка от сервера', {
                response: response,
                errorMessage: response?.message
            });
            
            // Показываем более информативное сообщение
            const errorMsg = response?.message || 'Неизвестная ошибка сервера';
            showNotification(`❌ Ошибка сервера: ${errorMsg}`, 'error');
            
            // Сохраняем оффлайн для повторной отправки
            const saved = saveRegistrationOffline();
            if (saved) {
                showSuccessMessage();
                resetRegistrationState();
                showStep(13);
                showNotification('📱 Данные сохранены локально для повторной отправки.', 'warning');
            }
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Критическая ошибка отправки', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        
        // Сохраняем оффлайн
        const saved = saveRegistrationOffline();
        
        if (saved) {
            logToConsole('INFO', 'Данные сохранены оффлайн', { 
                id: 'saved_offline',
                timestamp: new Date().toISOString()
            });
            
            // Показываем успех даже при оффлайн
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            
            showNotification('📱 Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        } else {
            logToConsole('ERROR', 'Ошибка сохранения оффлайн');
            showNotification('❌ Ошибка сохранения данных. Попробуйте еще раз.', 'error');
        }
    } finally {
        showLoader(false);
    }
}

// ==================== ФУНКЦИЯ ОТПРАВКИ НА СЕРВЕР ====================
async function sendRegistrationToServer(data) {
    try {
        logToConsole('INFO', 'Отправляю данные на сервер', { 
            url: CONFIG.APP_SCRIPT_URL, 
            dataSize: JSON.stringify(data).length 
        });
        
        const requestData = {
            action: 'register_driver',
            data: data
        };
        
        const startTime = Date.now();
        
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        logToConsole('INFO', 'Статус ответа', { 
            status: response.status, 
            statusText: response.statusText,
            duration: `${duration}ms`,
            url: CONFIG.APP_SCRIPT_URL
        });
        
        if (response.ok) {
            const text = await response.text();
            
            try {
                const result = JSON.parse(text);
                logToConsole('INFO', 'Ответ JSON получен', { 
                    success: result.success,
                    message: result.message,
                    responseSize: text.length
                });
                return result;
            } catch (parseError) {
                logToConsole('ERROR', 'Ошибка парсинга JSON', {
                    error: parseError.message,
                    rawText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
                    url: CONFIG.APP_SCRIPT_URL
                });
                return { 
                    success: false, 
                    message: 'Неверный формат ответа сервера',
                    rawResponse: text
                };
            }
        } else {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Не удалось прочитать текст ошибки';
            }
            
            logToConsole('ERROR', 'HTTP ошибка', { 
                status: response.status, 
                statusText: response.statusText,
                errorText: errorText.substring(0, 500) + (errorText.length > 500 ? '...' : ''),
                url: CONFIG.APP_SCRIPT_URL,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            throw new Error(`HTTP ошибка ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка отправки на сервер', {
            error: error.message,
            stack: error.stack,
            url: CONFIG.APP_SCRIPT_URL,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

// ==================== API ФУНКЦИИ ====================
async function sendAPIRequest(requestData) {
    try {
        logToConsole('INFO', 'Отправляю API запрос', {
            action: requestData.action,
            dataSize: JSON.stringify(requestData).length
        });
        
        const startTime = Date.now();
        
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        logToConsole('INFO', 'Статус ответа API', { 
            status: response.status,
            duration: `${duration}ms`,
            action: requestData.action
        });
        
        if (response.ok) {
            const text = await response.text();
            try {
                const result = JSON.parse(text);
                logToConsole('INFO', 'Ответ API получен', {
                    success: result.success,
                    action: requestData.action,
                    responseSize: text.length
                });
                return result;
            } catch (parseError) {
                logToConsole('ERROR', 'Ошибка парсинга JSON API', {
                    error: parseError.message,
                    action: requestData.action,
                    rawText: text.substring(0, 200)
                });
                return { 
                    success: false, 
                    message: 'Неверный формат ответа API',
                    action: requestData.action
                };
            }
        } else {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Не удалось прочитать текст ошибки';
            }
            
            logToConsole('ERROR', 'HTTP ошибка API', { 
                status: response.status,
                action: requestData.action,
                errorText: errorText.substring(0, 200),
                url: CONFIG.APP_SCRIPT_URL
            });
            
            throw new Error(`HTTP ошибка ${response.status} для действия ${requestData.action}`);
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка отправки API запроса', {
            error: error.message,
            stack: error.stack,
            action: requestData.action,
            url: CONFIG.APP_SCRIPT_URL
        });
        throw error;
    }
}

async function testAPIConnection() {
    try {
        logToConsole('INFO', 'Тестирую соединение с API');
        
        // Тест GET запросом
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
        
        // Обновляем счетчик
        showOfflineDataCount();
        
        return true;
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка сохранения оффлайн', error);
        return false;
    }
}

// ==================== ОТПРАВКА ОФФЛАЙН ДАННЫХ ====================
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
            // Сбрасываем счетчики попыток для всех записей
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
            // Если попыток >= 5, пропускаем (но можем сбросить через resetAttempts)
            if (record.attempts >= 5 && !resetAttempts) {
                logToConsole('WARN', `Запись ${record.id} превысила лимит попыток`, { 
                    attempts: record.attempts,
                    lastError: record.lastError 
                });
                continue;
            }
            
            try {
                logToConsole('INFO', `Отправляю запись ${record.id}`, { 
                    attempt: record.attempts + 1,
                    data: record.data 
                });
                
                const response = await sendRegistrationToServer(record.data);
                
                logToConsole('INFO', `Ответ для записи ${record.id}`, {
                    success: response.success,
                    message: response.message
                });
                
                if (response && response.success) {
                    record.status = 'sent';
                    record.sentAt = new Date().toISOString();
                    record.response = response;
                    successful.push(record.id);
                    logToConsole('SUCCESS', `Запись ${record.id} отправлена успешно`);
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
            
            // Небольшая пауза между запросами
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Сохраняем прогресс после каждой записи
            localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        }
        
        // Очищаем старые отправленные записи (старше 7 дней)
        cleanupOldOfflineRecords();
        
        // Обновляем счетчик
        showOfflineDataCount();
        
        // Показываем результат
        if (successful.length > 0) {
            showNotification(`✅ ${successful.length} оффлайн записей отправлено`, 'success');
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
        
        // Закрываем модальное окно если открыто
        closeModal();
        
        // Обновляем счетчик
        showOfflineDataCount();
        
        // Пробуем отправить снова
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
        
        // Подсчитываем записи с превышенным лимитом
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
        
        // Предупреждение если есть записи с превышенным лимитом
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
        
        // Создаем модальное окно
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка показа оффлайн данных', error);
        alert('Ошибка загрузки оффлайн данных: ' + error.message);
    }
}

function closeModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

async function forceSendOfflineData() {
    showLoader(true);
    await sendOfflineData();
    showLoader(false);
    closeModal();
}

function clearOfflineData() {
    if (confirm('Удалить все оффлайн данные? Это действие нельзя отменить.')) {
        localStorage.removeItem('offline_registrations');
        showOfflineDataCount();
        closeModal();
        showNotification('Оффлайн данные очищены', 'info');
    }
}

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
            return true; // Храним все pending записи
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
        const saved = localStorage.getItem('driver_registration_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            registrationState = parsed;
            
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
        closeModal();
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
            closeModal();
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
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        const part1 = cleaned.substring(1, 4);
        const part2 = cleaned.substring(4, 7);
        const part3 = cleaned.substring(7, 9);
        const part4 = cleaned.substring(9, 11);
        
        return `${part1} ${part2} ${part3} ${part4}`;
    }
    
    return phone;
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
    if (productType === 'Сухой') {
        if (legalEntity === 'Гулливер') {
            return 'с 31 по 36 (бакалея соль,мука и т.п,вода,консервы) и с 38 по 39 (кондитерка, уголь, пакеты, батарейки, жвачки и т.п)';
        }
        if (legalEntity === 'ТК Лето') {
            return 'с 26 по 30, с 20 по 22 (для кондитерки)';
        }
    }
    
    if (productType === 'ФРЕШ') {
        if (legalEntity === 'Гулливер') {
            return 'с 45 по 51, с 5 по 8';
        }
        if (legalEntity === 'ТК Лето') {
            return 'с 45 по 51';
        }
    }
    
    if (productType === 'ФРОВ') {
        return 'с 9 по 11';
    }
    
    if (productType === 'Акциз') {
        return 'с 40 по 41';
    }
    
    return 'Не назначены';
}

function handleEnterKey(input) {
    const step = registrationState.step;
    
    switch(step) {
        case 1: handlePhoneSubmit(); break;
        case 2: handleFioSubmit(); break;
        case 3: handleManualSupplier(); break;
        case 6: handleManualBrand(); break;
        case 7: handleVehicleNumberSubmit(); break;
        case 8: handlePalletsSubmit(); break;
        case 9: handleOrderSubmit(); break;
        case 10: handleEtrnSubmit(); break;
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
    const gate = serverData?.gate || data.gate || 'Не назначены';
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
logToConsole('INFO', 'app.js загружен и готов к работе');

