// app.js v1.4 - ПОЛНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ С ТОП-ДАННЫМИ

// Конфигурация
let CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzt-xQk-DSNfofBV5ewoioKNHJ8p7Idn3GDSu9PY6Dq-MSpl8NpgHiONiQgAcCfGwD0/exec',
    APP_VERSION: '1.4'
};

// Константы для кэширования ТОП-данных
const TOP_DATA_CACHE_KEY = 'driver_registration_top_data';
const TOP_DATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

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

// ==================== ФУНКЦИЯ ДЛЯ ОТКРЫТИЯ ЛИЧНОГО КАБИНЕТА ИЗ ШАГА 1 ====================
function openDriverCabinetFromStep1() {
    try {
        const phoneInput = document.getElementById('phone-input');
        const phone = phoneInput.value.replace(/\s/g, '');
        
        if (!phone || phone.length < 10) {
            showNotification('Пожалуйста, введите номер телефона для доступа к личному кабинету', 'error');
            phoneInput.focus();
            return;
        }
        
        const normalizedPhone = normalizePhone(phone);
        
        // Сохраняем телефон в registrationState
        if (registrationState && registrationState.data) {
            registrationState.data.phone = normalizedPhone;
        } else {
            registrationState = {
                step: 1,
                data: {
                    phone: normalizedPhone,
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
        }
        
        // Открываем личный кабинет
        openDriverCabinet();
        
    } catch (error) {
        console.error('Ошибка открытия личного кабинета:', error);
        showNotification('Ошибка открытия личного кабинета: ' + error.message, 'error');
    }
}

// ==================== КЭШИРОВАНИЕ ТОП-ДАННЫХ ====================

// Загрузка ТОП-данных при старте приложения
async function loadTopData() {
  try {
    logToConsole('INFO', 'Загрузка ТОП данных');
    
    // Проверяем локальный кэш
    const cached = localStorage.getItem(TOP_DATA_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Если кэш свежий (менее 24 часов), используем его
      if (age < TOP_DATA_CACHE_TTL) {
        logToConsole('INFO', 'Использую ТОП данные из кэша', {
          age: Math.round(age / 1000 / 60) + ' минут',
          suppliers: data.suppliers?.length || 0,
          brands: data.brands?.length || 0
        });
        return data;
      }
    }
    
    // Загружаем с сервера
    const response = await sendAPIRequest({
      action: 'get_top_data'
    });
    
    if (response && response.success) {
      // Сохраняем в кэш
      const cacheData = {
        data: response,
        timestamp: Date.now()
      };
      localStorage.setItem(TOP_DATA_CACHE_KEY, JSON.stringify(cacheData));
      
      logToConsole('SUCCESS', 'ТОП данные загружены и сохранены', {
        suppliers: response.suppliers?.length || 0,
        brands: response.brands?.length || 0,
        fromCache: response.fromCache || false
      });
      
      return response;
    } else {
      throw new Error('Не удалось загрузить ТОП данные');
    }
    
  } catch (error) {
    logToConsole('ERROR', 'Ошибка загрузки ТОП данных', error);
    
    // Пробуем использовать старый кэш даже если он устарел
    const cached = localStorage.getItem(TOP_DATA_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      logToConsole('WARN', 'Использую устаревшие ТОП данные из кэша');
      return data;
    }
    
    return null;
  }
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
        
        return new Date(0);
        
    } catch (e) {
        console.log('Ошибка парсинга даты:', e, dateStr);
        return new Date(0);
    }
}

// Принудительное обновление ТОП-данных
async function refreshTopData() {
  try {
    logToConsole('INFO', 'Принудительное обновление ТОП данных');
    localStorage.removeItem(TOP_DATA_CACHE_KEY);
    await loadTopData();
    showNotification('✅ ТОП данные обновлены', 'success');
  } catch (error) {
    logToConsole('ERROR', 'Ошибка обновления ТОП данных', error);
    showNotification('❌ Ошибка обновления данных', 'error');
  }
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

function debugRegistrationData() {
    console.log('=== ДЕБАГ ДАННЫХ РЕГИСТРАЦИИ ===');
    console.log('Текущее состояние:', registrationState);
    console.log('Телефон:', registrationState.data.phone);
    console.log('Нормализованный телефон:', normalizePhone(registrationState.data.phone));
    console.log('Поле gate в данных:', registrationState.data.gate);
    console.log('Объект для отправки:', JSON.stringify(registrationState.data, null, 2));
    
    // Проверяем, есть ли функция normalizePhone
    console.log('Функция normalizePhone:', typeof normalizePhone);
    
    return registrationState.data;
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
    
    // Инициализация системы уведомлений
    initializeNotificationSystem();
    
    // ПРЕДВАРИТЕЛЬНАЯ ЗАГРУЗКА ТОП ДАННЫХ (в фоне)
    setTimeout(() => {
        loadTopData().then(() => {
            logToConsole('INFO', 'Предварительная загрузка ТОП данных завершена');
        }).catch(error => {
            logToConsole('ERROR', 'Ошибка предварительной загрузки ТОП данных', error);
        });
    }, 1000);
    
    // Показываем текущий шаг
    showStep(registrationState.step);
    
    // Показываем оффлайн данные
    showOfflineDataCount();
    
    // Тестируем соединение
    setTimeout(() => {
        testAPIConnection();
    }, 1000);
    
    // Периодическая проверка соединения
    setInterval(checkConnectionAndSendOffline, 60000);
    
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
            
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            showNotification('📱 Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        }
    } finally {
        showLoader(false);
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
        
        closeModal();
        
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

// ==================== ЛИЧНЫЙ КАБИНЕТ ВОДИТЕЛЯ ====================
async function openDriverCabinet() {
    try {
        console.log('Открываю личный кабинет...');
        
        // 1. Пробуем получить телефон из текущей сессии
        let driverPhone = '';
        let driverName = '';
        
        if (registrationState && registrationState.data) {
            driverPhone = registrationState.data.phone || '';
            driverName = registrationState.data.fio || '';
            console.log('Телефон из registrationState:', driverPhone);
        }
        
        // 2. Пробуем из localStorage
        if (!driverPhone) {
            const lastReg = localStorage.getItem('driver_last_registration');
            if (lastReg) {
                try {
                    const data = JSON.parse(lastReg);
                    driverPhone = data.phone || '';
                    driverName = data.fio || '';
                    console.log('Телефон из localStorage:', driverPhone);
                } catch (e) {
                    console.log('Ошибка парсинга localStorage:', e);
                }
            }
        }
        
        // 3. Если телефон не найден, показываем ввод
        if (!driverPhone) {
            showNotification('Введите номер телефона для доступа к личному кабинету', 'warning');
            
            // Показываем модальное окно для ввода телефона
            showPhoneInputModal();
            return;
        }
        
        // 4. Проверяем соединение с интернетом
        if (!navigator.onLine) {
            showNotification('Нет соединения с интернетом. Некоторые функции могут быть недоступны.', 'warning');
            showSimpleDriverCabinet(driverPhone, driverName);
            return;
        }
        
        // 5. Показываем загрузчик
        showLoader(true);
        
        try {
            // 6. Получаем данные с сервера
            const [history, notifications, statusUpdates] = await Promise.all([
                getDriverHistory(driverPhone),
                getPWANotifications(driverPhone),
                getDriverStatusUpdates(driverPhone)
            ]);
            
            console.log('Данные получены:', {
                historyCount: history.length,
                notificationsCount: notifications.length,
                statusUpdatesCount: statusUpdates.length
            });
            
            // 7. Сохраняем время последней проверки
            localStorage.setItem('last_cabinet_check_' + driverPhone, Date.now().toString());
            
            // 8. Показываем полный личный кабинет с данными
            showDriverCabinet(history, notifications, statusUpdates, driverPhone, driverName);
            
        } catch (error) {
            console.error('Ошибка загрузки данных кабинета:', error);
            showNotification('Не удалось загрузить данные. Показываю упрощенную версию.', 'warning');
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

function showPhoneInputModal() {
    const modalHtml = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">📱 Введите номер телефона</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
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
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="enterCabinetWithPhone()">Войти</button>
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
        if (phoneInput) phoneInput.focus();
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
    
    // Закрываем модальное окно
    closeModal();
    
    // Показываем личный кабинет
    openDriverCabinet();
}

// ==================== ПОЛУЧЕНИЕ ИСТОРИИ РЕГИСТРАЦИЙ ====================
// ==================== ФУНКЦИЯ ПОЛУЧЕНИЯ ИСТОРИИ (С ИСПРАВЛЕННЫМИ ДАТАМИ) ====================
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

// ==================== ПОЛУЧЕНИЕ PWA УВЕДОМЛЕНИЙ ====================
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
            
            // Показываем новые уведомления как push
            formattedNotifications.forEach(notification => {
                if (!notification.status || notification.status !== 'read') {
                    showPushNotification(notification);
                }
            });
            
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

function switchCabinetTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.cabinet-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Убрать активный класс со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = '#666';
    });
    
    // Показать выбранную вкладку
    const tabElement = document.getElementById(`cabinet-${tabName}-tab`);
    if (tabElement) {
        tabElement.style.display = 'block';
    }
    
    // Активировать кнопку
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.includes(getCabinetTabName(tabName))) {
            btn.style.borderBottomColor = '#4285f4';
            btn.style.color = '#4285f4';
        }
    });
}

function getCabinetTabName(tabName) {
    const map = {
        'info': 'Основная информация',
        'history': 'История регистраций',
        'notifications': 'Уведомления'
    };
    return map[tabName] || tabName;
}

function refreshCabinet(phone) {
    showNotification('Обновление информации...', 'info');
    
    // Здесь можно добавить запрос к серверу для обновления данных
    setTimeout(() => {
        showNotification('Информация обновлена', 'success');
    }, 1000);
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

function renderHistoryTab(history) {
    if (history.length === 0) {
        return '<div class="empty-state">📭 История регистраций отсутствует</div>';
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    history.forEach((item, index) => {
        html += `
            <div class="card" style="margin-bottom: 10px;">
                <div class="card-header">
                    <div class="card-title">Регистрация #${index + 1}</div>
                    <div class="badge ${getStatusBadgeClass(item.status)}">${item.status || 'Зарегистрирован'}</div>
                </div>
                <div class="card-body">
                    <p><strong>Дата:</strong> ${item.date || ''} ${item.time || ''}</p>
                    <p><strong>Поставщик:</strong> ${item.supplier || ''}</p>
                    <p><strong>Юрлицо:</strong> ${item.legalEntity || ''}</p>
                    <p><strong>Тип товара:</strong> ${item.productType || ''}</p>
                    <p><strong>Ворота:</strong> ${item.defaultGate || 'Не назначены'}</p>
                    ${item.assignedGate ? `<p><strong>Назначенные ворота:</strong> ${item.assignedGate}</p>` : ''}
                    ${item.problemType ? `<p><strong>Проблема:</strong> <span style="color: #f44336;">${item.problemType}</span></p>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderNotificationsTab(notifications) {
    const unreadNotifications = notifications.filter(n => !n.status || n.status !== 'read');
    
    if (unreadNotifications.length === 0) {
        return '<div class="empty-state">📭 Нет новых уведомлений</div>';
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    unreadNotifications.forEach((notification, index) => {
        const icon = getNotificationIcon(notification.type);
        
        html += `
            <div class="notification-item" style="
                background: ${getNotificationColor(notification.type)};
                border-left: 4px solid ${getNotificationBorderColor(notification.type)};
                padding: 12px 15px;
                margin-bottom: 10px;
                border-radius: 8px;
                color: #333;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <div style="font-size: 20px; margin-right: 10px;">${icon}</div>
                    <div style="font-weight: 600; flex: 1;">${notification.title || 'Уведомление'}</div>
                    <div style="font-size: 11px; color: #666;">${formatNotificationTime(notification.timestamp)}</div>
                </div>
                <div style="font-size: 14px; line-height: 1.4;">${notification.message || ''}</div>
                ${notification.data ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${JSON.stringify(notification.data)}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderStatusTab(statusUpdates) {
    if (statusUpdates.length === 0) {
        return '<div class="empty-state">📭 Нет информации о текущем статусе</div>';
    }
    
    const latestUpdate = statusUpdates[0];
    
    let html = `
        <div class="status-overview" style="margin-bottom: 20px;">
            <div class="info-box ${getStatusBoxClass(latestUpdate.newStatus)}">
                <p><strong>Текущий статус:</strong> <span style="font-size: 18px;">${latestUpdate.newStatus || 'Зарегистрирован'}</span></p>
                ${latestUpdate.assignedGate ? `<p><strong>Назначенные ворота:</strong> ${latestUpdate.assignedGate}</p>` : ''}
                ${latestUpdate.problemType ? `<p><strong>Тип проблемы:</strong> ${latestUpdate.problemType}</p>` : ''}
                <p><strong>Последнее обновление:</strong> ${formatNotificationTime(latestUpdate.timestamp)}</p>
            </div>
        </div>
        
        <h4>История изменений статуса:</h4>
        <div style="max-height: 300px; overflow-y: auto;">
    `;
    
    statusUpdates.slice(0, 10).forEach((update, index) => {
        html += `
            <div class="history-item" style="padding: 10px; border-bottom: 1px solid #f0f0f0;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>${update.newStatus || 'Изменение статуса'}</strong>
                        ${update.oldStatus ? ` (с ${update.oldStatus})` : ''}
                    </div>
                    <div style="font-size: 11px; color: #666;">${formatNotificationTime(update.timestamp)}</div>
                </div>
                ${update.problemType ? `<div style="font-size: 12px; color: #f44336; margin-top: 3px;">Проблема: ${update.problemType}</div>` : ''}
                ${update.assignedGate ? `<div style="font-size: 12px; color: #4caf50; margin-top: 3px;">Ворота: ${update.assignedGate}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Вспомогательные функции
function getStatusBadgeClass(status) {
    const statusMap = {
        'Зарегистрирован': 'badge-info',
        'Назначены ворота': 'badge-success',
        'Проблема с товаром': 'badge-warning',
        'Проблема с документами': 'badge-warning',
        'Отказ в приемке': 'badge-danger',
        'Нет в графике': 'badge-danger',
        'Документы готовы к выдаче': 'badge-success'
    };
    
    return statusMap[status] || 'badge-info';
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

function getNotificationColor(type) {
    const colorMap = {
        'gate_assigned': '#e8f5e9',
        'documents_ready': '#e8f5e9',
        'rejection': '#ffebee',
        'rejection_detail': '#ffebee',
        'out_of_schedule': '#fff3e0',
        'problem_initial': '#fff3e0',
        'problem_detail': '#fff3e0',
        'status_change': '#e3f2fd'
    };
    
    return colorMap[type] || '#f5f5f5';
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
    
    // Если уже в формате "дд.мм.гггг чч:мм", возвращаем как есть
    if (typeof timestamp === 'string' && 
        timestamp.includes('.') && 
        timestamp.includes(':') &&
        timestamp.includes(' ')) {
        // Проверяем формат
        const parts = timestamp.split(' ');
        if (parts.length === 2) {
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            if (dateParts.length === 3 && timeParts.length >= 2) {
                // Убираем секунды если есть
                if (timeParts[1].includes('.')) {
                    const minutesOnly = timeParts[1].split('.')[0];
                    return `${dateParts[0]}.${dateParts[1]}.${dateParts[2]} ${timeParts[0]}:${minutesOnly}`;
                }
                return timestamp;
            }
        }
    }
    
    // Если нет, пытаемся распарсить
    return formatAnyDate(timestamp);
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
        } else {
            // Сбрасываем заголовок
            document.title = 'УЛН. Регистрация водителей';
            
            // Скрываем бэйдж
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка обновления бэйджей:', error);
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
        // Здесь можно отправить запрос на сервер для пометки как прочитанного
        // Пока просто обновим локальный кэш
        
        // Получаем текущий телефон
        let driverPhone = '';
        if (registrationState && registrationState.data && registrationState.data.phone) {
            driverPhone = registrationState.data.phone;
        }
        
        if (!driverPhone) return;
        
        // Обновляем кэш уведомлений
        const cacheKey = 'notifications_cache_' + driverPhone;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                if (cacheData.data && Array.isArray(cacheData.data)) {
                    // Помечаем уведомление как прочитанное
                    cacheData.data = cacheData.data.map(n => {
                        if (n.id === notificationId) {
                            return { ...n, status: 'read' };
                        }
                        return n;
                    });
                    
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                }
            } catch (e) {
                console.log('Ошибка обновления кэша уведомлений:', e);
            }
        }
        
    } catch (error) {
        console.error('Ошибка пометки уведомления как прочитанного:', error);
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
    const gate = serverData?.assignedGate || data.gate || 'Не назначены';
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
window.clearCache = clearCache;
window.refreshTopData = refreshTopData;
window.openDriverCabinet = openDriverCabinet;
window.closeDriverCabinet = closeDriverCabinet;
window.switchTab = switchTab;
window.refreshDriverCabinet = refreshDriverCabinet;
window.switchCabinetTab = switchCabinetTab;
window.refreshCabinet = refreshCabinet;
window.enterCabinetWithPhone = enterCabinetWithPhone;

logToConsole('INFO', 'app.js загружен и готов к работе (оптимизированная версия с ТОП-данными и PWA уведомлениями)');
                            



