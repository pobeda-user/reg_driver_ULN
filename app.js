// app.js v1.3 - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

// Конфигурация
let CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzt-xQk-DSNfofBV5ewoioKNHJ8p7Idn3GDSu9PY6Dq-MSpl8NpgHiONiQgAcCfGwD0/exec',
    APP_VERSION: '1.4'
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
  logToConsole('INFO', 'Загрузка истории поставщиков', {
    phone: registrationState.data.phone
  });
  
  const container = document.getElementById('supplier-buttons');
  const infoBox = document.getElementById('supplier-history-info');
  
  if (!container || !infoBox) return;
  
  if (!registrationState.data.phone) {
    infoBox.innerHTML = '<p>❌ Нет номера телефона для поиска</p>';
    return;
  }
  
  infoBox.innerHTML = `
    <p>🔍 Ищу поставщиков для ${registrationState.data.phone}...</p>
    <div class="loader" style="width: 20px; height: 20px; margin: 10px auto;"></div>
  `;
  
  container.innerHTML = '<div class="info-box">Загрузка истории поставщиков...</div>';
  
  try {
    // Используем GET запрос с параметрами в URL
    const response = await sendAPIRequest({
      action: 'get_suppliers',
      phone: registrationState.data.phone
    });
    
    logToConsole('INFO', 'Ответ от сервера по поставщикам', {
      success: response.success,
      count: response.suppliers ? response.suppliers.length : 0,
      message: response.message || 'Нет сообщения'
    });
    
    if (response && response.success && response.suppliers && response.suppliers.length > 0) {
      infoBox.innerHTML = `
        <p>✅ Найдено поставщиков: ${response.suppliers.length}</p>
        <p style="font-size: 12px; color: #666;">Выберите из истории:</p>
      `;
      
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
          logToConsole('INFO', 'Выбран поставщик из истории', { 
            supplier,
            index: index + 1
          });
          selectSupplier(supplier);
        };
        container.appendChild(button);
      });
      
    } else {
      const errorMessage = response.message || 'История поставщиков не найдена';
      infoBox.innerHTML = `<p>📭 ${errorMessage}</p>`;
      container.innerHTML = '<div class="info-box info">История не найдена. Введите поставщика вручную.</div>';
    }
    
  } catch (error) {
    logToConsole('ERROR', 'Ошибка загрузки поставщиков', {
      error: error.message,
      stack: error.stack,
      phone: registrationState.data.phone
    });
    
    infoBox.innerHTML = `
      <p>⚠️ Ошибка загрузки истории</p>
      <p style="font-size: 12px; color: #666;">${error.message}</p>
    `;
    
    container.innerHTML = `
      <div class="info-box warning">
        <p>Ошибка загрузки истории поставщиков</p>
        <p>Вы можете:</p>
        <ol style="margin: 10px 0 10px 20px;">
          <li>Ввести поставщика вручную ниже</li>
          <li>Нажать "Назад" и повторить</li>
        </ol>
      </div>
    `;
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

async function loadPopularBrands() {
    logToConsole('INFO', 'Загрузка популярных марок авто');
    
    const container = document.getElementById('brand-buttons');
    if (!container) return;
    
    container.innerHTML = `
        <div class="info-box">
            <p>🔄 Загрузка популярных марок авто...</p>
            <div class="loader" style="width: 20px; height: 20px; margin: 10px auto;"></div>
        </div>
    `;
    
    try {
        // Используем GET запрос для получения марок
        const response = await sendAPIRequest({
            action: 'get_popular_brands'
        });
        
        logToConsole('INFO', 'Ответ по маркам авто', {
            success: response.success,
            count: response.brands ? response.brands.length : 0
        });
        
        if (response && response.success && response.brands && response.brands.length > 0) {
            container.innerHTML = '';
            
            // Добавляем кнопки для популярных марок
            response.brands.forEach((brand, index) => {
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
            
            logToConsole('SUCCESS', `Загружено ${response.brands.length} популярных марок`);
            
        } else {
            // Показываем стандартные марки если API не ответил
            showDefaultBrands();
            logToConsole('WARN', 'Используются стандартные марки авто', {
                message: response?.message || 'Нет ответа от сервера'
            });
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Ошибка загрузки марок авто', error);
        
        // В случае ошибки показываем стандартные марки
        showDefaultBrands();
        container.innerHTML += `
            <div class="info-box warning" style="margin-top: 10px;">
                <p>⚠️ Ошибка загрузки популярных марок</p>
                <p>Вы можете ввести марку вручную ниже</p>
            </div>
        `;
    }
}

function showDefaultBrands() {
    const container = document.getElementById('brand-buttons');
    if (!container) return;
    
    const defaultBrands = [
        'Газель',
        'Мерседес',
        'Вольво',
        'Скания',
        'MAN',
        'DAF',
        'Ford',
        'Renault',
        'Iveco',
        'Камаз',
        'Hyundai',
        'Киа',
        'Тойота'
    ];
    
    container.innerHTML = '';
    
    defaultBrands.forEach((brand, index) => {
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
    
    // Загружаем популярные марки авто перед переходом на шаг 6
    loadPopularBrands();
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
// ==================== ШАГ 12: ПОДТВЕРЖДЕНИЕ ====================
function showConfirmation() {
    logToConsole('INFO', 'Показываю подтверждение с исправленными данными');
    
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
            <span class="data-label">🔄 Транзит:</span>
            <span class="data-value">${data.transit || ''}</span>
        </div>
        <div class="data-item highlight">
            <span class="data-label">🚪 Ворота назначенные:</span>
            <span class="data-value">${data.gate || 'Не назначены'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">⏰ Опоздание по графику:</span>
            <span class="data-value">${data.scheduleViolation || 'Нет'}</span>
        </div>
    `;
    
    // Блок оффлайн данных (если есть)
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
    const requiredFields = ['phone', 'fio', 'supplier', 'legalEntity', 'productType', 'vehicleNumber'];
    const missingFields = requiredFields.filter(field => !registrationState.data[field]);
    
    if (missingFields.length > 0) {
        showNotification(`Заполните обязательные поля: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // УДАЛЯЕМ поле problemTypes из данных перед отправкой
    const dataToSend = {...registrationState.data};
    delete dataToSend.problemTypes; // Убедимся что поле не отправляется
    
    // Проверяем соединение
    if (!navigator.onLine) {
        logToConsole('WARN', 'Нет соединения с интернетом');
        showNotification('⚠️ Нет соединения с интернетом. Данные будут сохранены локально.', 'warning');
        
        // Удаляем problemTypes из данных для оффлайн сохранения
        delete registrationState.data.problemTypes;
        
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
        // Добавляем временную метку и уникальный ID для отслеживания
        dataToSend._timestamp = Date.now();
        dataToSend._localId = `local_${dataToSend._timestamp}_${Math.random().toString(36).substr(2, 6)}`;
        dataToSend._attempt = 1;
        dataToSend._sentFrom = 'online_submit';
        
        logToConsole('INFO', 'Подготовка данных для отправки', {
            localId: dataToSend._localId,
            timestamp: dataToSend._timestamp,
            phone: dataToSend.phone
        });
        
        const response = await sendRegistrationToServer(dataToSend);
        
        logToConsole('INFO', 'Ответ от сервера получен', {
            success: response.success,
            message: response.message,
            hasData: !!response.data
        });
        
        if (response && response.success) {
            logToConsole('SUCCESS', 'Регистрация успешна на сервере!');
            
            // Удаляем problemTypes из локального состояния
            delete registrationState.data.problemTypes;
            
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
            
            // Удаляем problemTypes при сохранении оффлайн
            delete registrationState.data.problemTypes;
            
            const saved = saveRegistrationOffline();
            if (saved) {
                showSuccessMessage();
                resetRegistrationState();
                showStep(13);
                showNotification('📱 Данные сохранены локально для повторной отправки.', 'warning');
            }
        }
        
    } catch (error) {
        logToConsole('ERROR', 'Критическая ошибка отправки', error);
        
        // Удаляем problemTypes при сохранении оффлайн
        delete registrationState.data.problemTypes;
        
        const saved = saveRegistrationOffline();
        
        if (saved) {
            logToConsole('INFO', 'Данные сохранены оффлайн');
            
            // Показываем успех даже при оффлайн
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            
            showNotification('📱 Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        }
    } finally {
        showLoader(false);
    }
}

async function testConnection() {
  const testUrl = CONFIG.APP_SCRIPT_URL + '?action=ping&test=' + Date.now();
  
  console.log('Тестирую:', testUrl);
  
  try {
    // Пробуем через XMLHttpRequest как fallback
    const xhr = new XMLHttpRequest();
    xhr.open('GET', testUrl, true);
    xhr.timeout = 10000;
    
    const result = await new Promise((resolve) => {
      xhr.onload = () => resolve({ success: xhr.status === 200, status: xhr.status, response: xhr.responseText });
      xhr.onerror = () => resolve({ success: false, error: 'Network error' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Timeout' });
      xhr.send();
    });
    
    console.log('Результат XHR:', result);
    
    // Пробуем fetch с разными опциями
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      console.log('Fetch статус:', response.status, response.ok);
      
      if (response.ok) {
        const data = await response.text();
        console.log('Fetch ответ:', data);
      }
    } catch (fetchError) {
      console.log('Fetch ошибка:', fetchError);
    }
    
    return result.success;
    
  } catch (error) {
    console.error('Ошибка теста:', error);
    return false;
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
    
    // ИСПРАВЛЕНИЕ: Используем GET запрос вместо POST для регистрации
    // Google Apps Script лучше работает с GET для веб-приложений
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
      
      // Проверяем, если это HTML страница с ошибкой
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
// ==================== АЛЬТЕРНАТИВНЫЙ МЕТОД ОТПРАВКИ ====================
async function sendViaAlternativeMethodForRegistration(data) {
  try {
    logToConsole('INFO', 'Пробую альтернативный метод регистрации');
    
    // Используем POST с более простыми заголовками
    const url = CONFIG.APP_SCRIPT_URL;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=register_driver&data=${encodeURIComponent(JSON.stringify(data))}`,
      mode: 'no-cors' // Пробуем no-cors режим
    });
    
    logToConsole('INFO', 'Альтернативный метод статус', {
      status: response.status,
      url: url
    });
    
    // В режиме no-cors мы не можем прочитать ответ, только проверить что запрос отправлен
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

// ==================== ПРОВЕРКА ПРОБЛЕМ ====================
// ==================== ПРОВЕРКА ПРОБЛЕМ ====================
function checkForProblems() {
    const problems = [];
    const data = registrationState.data;
    
    // Проверяем отсутствующие обязательные поля
    const requiredFields = ['phone', 'fio', 'supplier', 'legalEntity', 'productType', 'vehicleNumber'];
    const missingFields = requiredFields.filter(field => !data[field] || data[field].toString().trim() === '');
    
    if (missingFields.length > 0) {
        const fieldNames = {
            'phone': 'Телефон',
            'fio': 'ФИО',
            'supplier': 'Поставщик',
            'legalEntity': 'Юрлицо',
            'productType': 'Тип товара',
            'vehicleNumber': 'Номер ТС'
        };
        
        const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
        problems.push(`Не заполнены: ${missingFieldNames.join(', ')}`);
    }
    
    // Проверяем отсутствие номера заказа или значение 0
    if (!data.orderNumber || data.orderNumber.toString().trim() === '' || data.orderNumber.toString().trim() === '0') {
        problems.push('Отсутствует номер заказа');
    }
    
    // Проверяем отсутствие ЭТрН или значение 0
    if (!data.etrn || data.etrn.toString().trim() === '' || data.etrn.toString().trim() === '0') {
        problems.push('Отсутствует ЭТрН');
    }
    
    // Проверяем нарушение графика
    if (data.scheduleViolation === 'Да') {
        problems.push('Нарушение графика заезда');
    }
    
    // Логируем для отладки
    logToConsole('INFO', 'Проверка проблем', {
        problemsFound: problems,
        hasProblems: problems.length > 0,
        orderNumber: data.orderNumber,
        etrn: data.etrn,
        scheduleViolation: data.scheduleViolation
    });
    
    return problems.length > 0 ? problems.join('; ') : 'Нет';
}

// ==================== API ФУНКЦИИ ====================
async function sendAPIRequest(requestData) {
  try {
    logToConsole('INFO', 'Отправляю API запрос', {
      action: requestData.action,
      data: requestData
    });
    
    const action = requestData.action || 'unknown';
    
    // Для GET запросов используем GET метод с параметрами URL
    if (action === 'get_suppliers' || action === 'ping' || action === 'get_popular_brands' || action === 'clear_cache' || action === 'test_cache') {
      const url = new URL(CONFIG.APP_SCRIPT_URL);
      
      // Добавляем параметры в URL
      Object.keys(requestData).forEach(key => {
        if (requestData[key] !== undefined && requestData[key] !== null) {
          // Для объектов сериализуем в JSON
          if (typeof requestData[key] === 'object') {
            url.searchParams.append(key, JSON.stringify(requestData[key]));
          } else {
            url.searchParams.append(key, requestData[key]);
          }
        }
      });
      
      // Добавляем timestamp для избежания кэширования браузером
      url.searchParams.append('_t', Date.now());
      
      logToConsole('INFO', 'GET запрос URL', url.toString());
      
      const startTime = Date.now();
      
      // Отправляем GET запрос
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
      
      logToConsole('INFO', 'GET статус ответа', {
        status: response.status,
        ok: response.ok,
        duration: `${duration}ms`,
        url: url.toString()
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
        
        logToConsole('INFO', 'GET ответ получен', {
          success: result.success,
          action: action,
          duration: duration,
          fromCache: result.fromCache || false,
          suppliersCount: result.suppliers ? result.suppliers.length : 0
        });
        
        return result;
      } catch (parseError) {
        logToConsole('ERROR', 'Ошибка парсинга JSON', {
          error: parseError.message,
          rawText: text.substring(0, 200),
          url: url.toString()
        });
        
        // Если ответ содержит success в текстовом виде
        if (text.includes('success') || text.includes('suppliers')) {
          return {
            success: true,
            message: 'Запрос обработан (парсинг не удался)',
            rawResponse: text,
            fromCache: text.includes('fromCache') || false
          };
        }
        
        throw new Error('Неверный формат ответа сервера');
      }
      
    } else {
      // Для POST запросов (register_driver и другие)
      logToConsole('INFO', 'Отправляю POST запрос', {
        url: CONFIG.APP_SCRIPT_URL,
        action: action,
        dataSize: JSON.stringify(requestData).length
      });
      
      const startTime = Date.now();
      
      const response = await fetch(CONFIG.APP_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
        mode: 'cors'
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logToConsole('INFO', 'POST статус ответа', {
        status: response.status,
        ok: response.ok,
        duration: `${duration}ms`,
        action: action
      });
      
      if (response.ok) {
        const text = await response.text();
        try {
          const result = JSON.parse(text);
          
          logToConsole('INFO', 'POST ответ получен', {
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
          
          if (text.includes('success')) {
            return {
              success: true,
              message: 'Запрос обработан',
              rawResponse: text
            };
          }
          
          throw new Error('Неверный формат ответа сервера');
        }
      } else {
        const errorText = await response.text().catch(() => 'Не удалось прочитать ошибку');
        
        logToConsole('ERROR', 'POST HTTP ошибка', {
          status: response.status,
          errorText: errorText.substring(0, 200),
          action: action
        });
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }
    
  } catch (error) {
    logToConsole('ERROR', 'Ошибка отправки API запроса', {
      error: error.message,
      stack: error.stack,
      action: requestData.action,
      url: CONFIG.APP_SCRIPT_URL,
      timestamp: new Date().toISOString()
    });
    
    // Пробуем альтернативный метод
    try {
      return await sendViaAlternativeMethod(requestData);
    } catch (altError) {
      logToConsole('ERROR', 'Альтернативный метод тоже не сработал', {
        error: altError.message,
        action: requestData.action
      });
      
      throw new Error(`Не удалось отправить запрос: ${error.message}`);
    }
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
            
            // Добавляем информацию о попытке отправки
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
                    // Проверяем, не является ли это дублирующей записью
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
    if (!productType) {
        logToConsole('WARN', 'Не указан тип товара для проверки графика');
        return false;
    }
    
    const schedules = {
        'Сухой': { end: 16, endMinutes: 30 },
        'ФРЕШ': { end: 14, endMinutes: 0 },
        'ФРОВ': { end: 14, endMinutes: 0 },
        'Акциз': { end: 13, endMinutes: 0 }
    };
    
    const schedule = schedules[productType];
    if (!schedule) {
        logToConsole('WARN', `Неизвестный тип товара для проверки графика: ${productType}`);
        return false;
    }
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const isViolation = hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes);
    
    logToConsole('INFO', 'Проверка графика', {
        productType: productType,
        currentTime: `${hours}:${minutes}`,
        endTime: `${schedule.end}:${schedule.endMinutes}`,
        isViolation: isViolation
    });
    
    return isViolation;
}

function assignGateAutomatically(legalEntity, productType) {
  if (!productType || !legalEntity) {
    return 'Не назначены (проверьте тип товара и юрлицо)';
  }
  
  // Ворота назначенные (более подробное описание для водителя)
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

// Экспортируем функцию для кнопки
window.clearCache = clearCache;

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
window.sendViaAlternativeMethod = sendViaAlternativeMethod;
logToConsole('INFO', 'app.js загружен и готов к работе');



















