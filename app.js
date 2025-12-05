// app.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ПРАВИЛЬНОЙ ОТПРАВКОЙ ДАННЫХ

// Конфигурация
let CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDATeBrTYOYUnP9JrjcUXuKHXbPWl75X-BTE-OFsREZLFB4I9qX-f4Ctu_MzKaGBko/exec'
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение загружается...');
    
    // Загружаем CONFIG из window если есть
    if (window.CONFIG) {
        CONFIG = { ...CONFIG, ...window.CONFIG };
        console.log('Конфигурация загружена:', CONFIG.APP_SCRIPT_URL);
    }
    
    // Загружаем сохраненное состояние
    loadRegistrationState();
    
    // Настраиваем обработчики
    setupPhoneInput();
    setupEventListeners();
    
    // Показываем текущий шаг
    showStep(registrationState.step);
    
    // Тестируем соединение
    setTimeout(() => {
        testAPIConnection();
    }, 1000);
    
    console.log('✅ Приложение инициализировано');
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
        console.log('🌐 Соединение восстановлено');
        updateConnectionStatus(true);
        showNotification('Соединение восстановлено', 'success');
        
        // Пробуем отправить оффлайн данные
        sendOfflineData();
    });
    
    window.addEventListener('offline', function() {
        console.log('⚠️ Соединение потеряно');
        updateConnectionStatus(false);
        showNotification('Нет соединения с интернетом', 'warning');
    });
}

// ==================== ШАГ 13: ОТПРАВКА ====================
async function submitRegistration() {
    console.log('📤 Начинаю отправку регистрации...');
    console.log('Данные для отправки:', registrationState.data);
    
    // Проверяем заполненность обязательных полей
    const requiredFields = ['phone', 'fio', 'supplier', 'legalEntity', 'productType'];
    const missingFields = requiredFields.filter(field => !registrationState.data[field]);
    
    if (missingFields.length > 0) {
        showNotification(`Заполните обязательные поля: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    showLoader(true);
    
    try {
        // Пытаемся отправить данные онлайн
        const response = await sendRegistrationToServer(registrationState.data);
        
        console.log('📨 Ответ от сервера:', response);
        
        if (response && response.success) {
            console.log('✅ Регистрация успешна на сервере!');
            
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
            console.error('❌ Ошибка от сервера:', response?.message);
            throw new Error(response?.message || 'Неизвестная ошибка сервера');
        }
        
    } catch (error) {
        console.error('❌ Ошибка отправки:', error);
        
        // Сохраняем оффлайн
        const saved = saveRegistrationOffline();
        
        if (saved) {
            console.log('📱 Данные сохранены оффлайн');
            
            // Показываем успех даже при оффлайн
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            
            showNotification('📱 Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        } else {
            console.error('❌ Ошибка сохранения оффлайн');
            showNotification('❌ Ошибка сохранения данных. Попробуйте еще раз.', 'error');
        }
    } finally {
        showLoader(false);
    }
}

// ==================== ФУНКЦИЯ ОТПРАВКИ НА СЕРВЕР ====================
async function sendRegistrationToServer(data) {
    try {
        console.log('📤 Отправляю данные на сервер:', CONFIG.APP_SCRIPT_URL);
        
        const requestData = {
            action: 'register_driver',
            data: data
        };
        
        console.log('Данные запроса:', requestData);
        
        // Отправляем POST запрос
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });
        
        console.log('📥 Статус ответа:', response.status, response.statusText);
        
        if (response.ok) {
            const text = await response.text();
            console.log('📥 Ответ текст:', text);
            
            try {
                const result = JSON.parse(text);
                console.log('📥 Ответ JSON:', result);
                return result;
            } catch (parseError) {
                console.error('❌ Ошибка парсинга JSON:', parseError);
                return { success: false, message: 'Неверный формат ответа сервера' };
            }
        } else {
            console.error('❌ HTTP ошибка:', response.status);
            throw new Error(`HTTP ошибка ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка отправки на сервер:', error);
        throw error;
    }
}

// ==================== ОФФЛАЙН СОХРАНЕНИЕ И ОТПРАВКА ====================
function saveRegistrationOffline() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        offlineRegistrations.push({
            id: 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            data: registrationState.data,
            timestamp: new Date().toISOString(),
            attempts: 0,
            status: 'pending'
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        console.log('✅ Данные сохранены оффлайн. Всего записей:', offlineRegistrations.length);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения оффлайн:', error);
        return false;
    }
}

async function sendOfflineData() {
    try {
        console.log('🔄 Пробую отправить оффлайн данные...');
        
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        if (offlineRegistrations.length === 0) {
            console.log('ℹ️ Нет оффлайн данных для отправки');
            return;
        }
        
        console.log(`📋 Найдено ${offlineRegistrations.length} оффлайн записей`);
        
        const successful = [];
        const failed = [];
        
        // Отправляем каждую запись
        for (let i = 0; i < offlineRegistrations.length; i++) {
            const record = offlineRegistrations[i];
            
            try {
                // Не отправляем уже отправленные или слишком старые записи
                if (record.status === 'sent' || record.attempts >= 5) {
                    continue;
                }
                
                console.log(`🔄 Отправляю оффлайн запись ${i + 1}/${offlineRegistrations.length}`);
                
                const response = await sendRegistrationToServer(record.data);
                
                if (response && response.success) {
                    record.status = 'sent';
                    record.sentAt = new Date().toISOString();
                    record.response = response;
                    successful.push(record.id);
                    console.log(`✅ Оффлайн запись ${record.id} отправлена успешно`);
                } else {
                    record.attempts = (record.attempts || 0) + 1;
                    record.lastError = response?.message || 'Неизвестная ошибка';
                    failed.push(record.id);
                    console.log(`❌ Ошибка отправки оффлайн записи ${record.id}:`, record.lastError);
                }
                
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                record.attempts = (record.attempts || 0) + 1;
                record.lastError = error.message;
                failed.push(record.id);
                console.error(`❌ Ошибка отправки оффлайн записи ${record.id}:`, error);
            }
            
            // Обновляем запись в массиве
            offlineRegistrations[i] = record;
        }
        
        // Сохраняем обновленные данные
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        // Удаляем успешно отправленные записи старше 7 дней
        const now = new Date();
        const filtered = offlineRegistrations.filter(record => {
            if (record.status === 'sent') {
                const sentDate = new Date(record.sentAt || record.timestamp);
                const diffDays = (now - sentDate) / (1000 * 60 * 60 * 24);
                return diffDays < 7; // Храним отправленные 7 дней
            }
            return true; // Храним все pending
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(filtered));
        
        // Показываем результат
        if (successful.length > 0) {
            showNotification(`✅ ${successful.length} оффлайн записей отправлено`, 'success');
        }
        
        if (failed.length > 0) {
            showNotification(`⚠️ ${failed.length} записей не удалось отправить`, 'warning');
        }
        
        console.log(`📊 Итог отправки: успешно ${successful.length}, не удалось ${failed.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка отправки оффлайн данных:', error);
    }
}

// ==================== API ФУНКЦИИ ====================
async function testAPIConnection() {
    try {
        console.log('🔍 Тестирую соединение с API...');
        
        // Простой GET запрос для теста
        const testUrl = CONFIG.APP_SCRIPT_URL + '?action=ping&test=' + Date.now();
        console.log('🔗 URL теста:', testUrl);
        
        const response = await fetch(testUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        
        console.log('📊 Статус GET:', response.status, response.statusText);
        
        if (response.ok) {
            try {
                const data = await response.json();
                console.log('✅ API тест успешен:', data);
                updateConnectionStatus(true);
                return true;
            } catch (jsonError) {
                console.log('⚠️ API тест: ответ не JSON, но сервер доступен');
                updateConnectionStatus(true);
                return true;
            }
        } else {
            console.log('❌ API тест не прошел, статус:', response.status);
            
            // Пробуем POST запрос
            console.log('🔄 Пробую POST запрос...');
            try {
                const postResponse = await fetch(CONFIG.APP_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'test' }),
                    mode: 'cors'
                });
                
                console.log('📊 Статус POST:', postResponse.status);
                
                if (postResponse.ok) {
                    updateConnectionStatus(true);
                    return true;
                }
            } catch (postError) {
                console.log('❌ POST тест не прошел:', postError.message);
            }
            
            updateConnectionStatus(false);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Ошибка тестирования API:', error);
        updateConnectionStatus(false);
        return false;
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function updateConnectionStatus(isConnected) {
    console.log('📡 Обновление статуса соединения:', isConnected ? 'онлайн' : 'оффлайн');
    
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

// ==================== ПРОВЕРКА И ОБРАБОТКА ОФФЛАЙН ДАННЫХ ====================
function checkOfflineData() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        if (offlineRegistrations.length > 0) {
            console.log(`ℹ️ Найдено ${offlineRegistrations.length} оффлайн записей`);
            
            // Показываем уведомление
            showNotification(`У вас ${offlineRegistrations.length} неотправленных записей. Они отправятся автоматически при восстановлении связи.`, 'info');
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки оффлайн данных:', error);
        return false;
    }
}

// ==================== ПЕРИОДИЧЕСКАЯ ПРОВЕРКА ====================
// Проверяем соединение каждые 30 секунд
setInterval(() => {
    if (navigator.onLine) {
        testAPIConnection();
        sendOfflineData();
    }
}, 30000);

// Проверяем оффлайн данные при загрузке
window.addEventListener('load', () => {
    setTimeout(() => {
        checkOfflineData();
    }, 2000);
});

// ==================== ЭКСПОРТ ФУНКЦИЙ ДЛЯ HTML ====================
// Экспортируем все функции, которые вызываются из HTML
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

console.log('✅ app.js загружен, функции экспортированы');

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) ====================
function showStep(stepNumber) {
    console.log(`📱 Переход к шагу: ${stepNumber}`);
    
    document.querySelectorAll('.step').forEach(step => {
        step.style.display = 'none';
    });
    
    const stepElement = document.querySelector(`[data-step="${stepNumber}"]`);
    if (stepElement) {
        stepElement.style.display = 'block';
        registrationState.step = stepNumber;
        saveRegistrationState();
        
        window.scrollTo(0, 0);
        
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

function setupPhoneInput() {
    const phoneInput = document.getElementById('phone-input');
    if (!phoneInput) return;
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) value = value.substring(0, 10);
        
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i === 3 || i === 6 || i === 8) formatted += ' ';
            formatted += value[i];
        }
        
        e.target.value = formatted;
    });
    
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
    
    const normalizedPhone = normalizePhone(phone);
    registrationState.data.phone = normalizedPhone;
    console.log('📞 Телефон сохранен:', normalizedPhone);
    
    showStep(2);
}

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
    console.log('👤 ФИО сохранено:', fio);
    
    loadSupplierHistory();
    showStep(3);
}

async function loadSupplierHistory() {
    console.log('🔍 Загружаю историю поставщиков...');
    
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
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_suppliers',
                phone: registrationState.data.phone
            }),
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📦 Ответ поставщиков:', data);
            
            if (data && data.success && data.suppliers && data.suppliers.length > 0) {
                infoBox.innerHTML = `<p>✅ Найдено поставщиков: ${data.suppliers.length}</p>`;
                container.innerHTML = '';
                
                data.suppliers.forEach((supplier, index) => {
                    if (!supplier || supplier.trim() === '') return;
                    
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'option-btn';
                    button.innerHTML = `
                        <span class="option-number">${index + 1}</span>
                        <span class="option-text">${supplier}</span>
                    `;
                    button.onclick = () => {
                        console.log('✅ Выбран поставщик:', supplier);
                        selectSupplier(supplier);
                    };
                    container.appendChild(button);
                });
                
                console.log(`✅ Создано ${data.suppliers.length} кнопок поставщиков`);
                
            } else {
                infoBox.innerHTML = '<p>📭 История поставщиков не найдена</p>';
                container.innerHTML = '<div class="info-box">История не найдена. Введите поставщика вручную.</div>';
            }
        } else {
            throw new Error(`HTTP ошибка ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки поставщиков:', error);
        infoBox.innerHTML = '<p>⚠️ Ошибка загрузки истории</p>';
        container.innerHTML = '<div class="info-box warning">Ошибка загрузки. Введите поставщика вручную.</div>';
    }
}

function selectSupplier(supplier) {
    console.log('✅ Выбран поставщик:', supplier);
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
    console.log('✅ Поставщик сохранен:', supplier);
    showStep(4);
}

function selectLegalEntity(entity) {
    console.log('🏢 Выбрано юрлицо:', entity);
    registrationState.data.legalEntity = entity;
    showStep(5);
}

function selectProductType(type) {
    console.log('📦 Выбран тип товара:', type);
    registrationState.data.productType = type;
    
    const gate = assignGateAutomatically(registrationState.data.legalEntity, type);
    registrationState.data.gate = gate;
    console.log('🚪 Назначены ворота:', gate);
    
    showStep(6);
}

function selectBrand(brand) {
    console.log('🚗 Выбрана марка авто:', brand);
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
    console.log('✅ Марка авто сохранена:', brand);
    showStep(7);
}

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
    console.log('✅ Номер ТС сохранен:', vehicleNumber);
    showStep(8);
}

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
    console.log('✅ Поддоны сохранены:', pallets);
    showStep(9);
}

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
    console.log('✅ Номер заказа сохранен:', orderNumber);
    showStep(10);
}

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
    console.log('✅ ЭТрН сохранен:', etrn);
    showStep(11);
}

function selectTransit(type) {
    console.log('📦 Выбран тип доставки:', type);
    registrationState.data.transit = type;
    
    const now = new Date();
    registrationState.data.date = formatDate(now);
    registrationState.data.time = formatTime(now);
    
    registrationState.data.scheduleViolation = checkScheduleViolation() ? 'Да' : 'Нет';
    console.log('⏰ Нарушение графика:', registrationState.data.scheduleViolation);
    
    showConfirmation();
    showStep(12);
}

function showConfirmation() {
    console.log('📋 Показываю подтверждение...');
    
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
    
    container.innerHTML = html;
    console.log('✅ Подтверждение отображено');
}

function showSuccessMessage(serverData = null) {
    console.log('🎉 Показываю сообщение об успехе...');
    
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
    console.log('✅ Сообщение об успехе отображено');
}

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

function saveRegistrationState() {
    try {
        localStorage.setItem('driver_registration_state', JSON.stringify(registrationState));
    } catch (error) {
        console.error('Ошибка сохранения состояния:', error);
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
        console.error('Ошибка загрузки состояния:', error);
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

function showNotification(message, type = 'info') {
    console.log(`💬 Уведомление [${type}]: ${message}`);
    
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
