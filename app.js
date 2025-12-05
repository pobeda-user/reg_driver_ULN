// app.js - Упрощенная и исправленная версия с правильным экспортом функций

// Конфигурация (будет переопределена из HTML)
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

let POPULAR_BRANDS = ['Газель', 'Мерседес', 'Вольво', 'Скания', 'Ман'];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализирую приложение...');
    
    // Загружаем CONFIG из window если есть
    if (window.CONFIG) {
        CONFIG = { ...CONFIG, ...window.CONFIG };
    }
    
    console.log('Конфигурация:', CONFIG);
    
    // Загружаем сохраненное состояние
    loadRegistrationState();
    
    // Настраиваем обработчики
    setupPhoneInput();
    setupEventListeners();
    
    // Тестируем соединение с API
    setTimeout(() => {
        testAPIConnection().then(isConnected => {
            console.log('Соединение с API:', isConnected ? '✓' : '✗');
            if (!isConnected) {
                showNotification('Режим оффлайн. Данные будут сохранены локально.', 'warning');
            }
        });
    }, 1000);
    
    // Показываем текущий шаг
    showStep(registrationState.step);
    
    console.log('Приложение инициализировано');
});

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
    // Обработка Enter в полях ввода
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const input = e.target;
            if (input.tagName === 'INPUT') {
                console.log('Нажат Enter в поле:', input.id);
                handleEnterKey(input);
            }
        }
    });
    
    // Обновление статуса соединения
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

// ==================== НАВИГАЦИЯ ====================
function showStep(stepNumber) {
    console.log(`Переход к шагу: ${stepNumber}`);
    
    // Скрыть все шаги
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
        step.style.display = 'none';
    });
    
    // Показать нужный шаг
    const stepElement = document.querySelector(`[data-step="${stepNumber}"]`);
    if (stepElement) {
        stepElement.style.display = 'block';
        stepElement.classList.add('active');
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
    if (!phoneInput) {
        console.error('Поле phone-input не найдено!');
        return;
    }
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) {
            value = value.substring(0, 10);
        }
        
        // Форматирование: XXX XXX XX XX
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i === 3 || i === 6 || i === 8) {
                formatted += ' ';
            }
            formatted += value[i];
        }
        
        e.target.value = formatted;
    });
    
    // Фокус при загрузке
    setTimeout(() => {
        phoneInput.focus();
    }, 500);
}

async function handlePhoneSubmit() {
    console.log('Обработка телефона...');
    
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
    
    console.log('Телефон сохранен:', normalizedPhone);
    
    // Показываем загрузку
    showLoader(true);
    
    try {
        // Проверяем существующего водителя
        const response = await sendRequest('check_driver', { phone: normalizedPhone });
        console.log('Результат проверки водителя:', response);
        
        if (response && response.exists && response.driver) {
            // Автозаполнение ФИО
            const fioInput = document.getElementById('fio-input');
            if (fioInput && response.driver.fio) {
                fioInput.value = response.driver.fio;
                registrationState.data.fio = response.driver.fio;
                console.log('Автозаполнено ФИО:', response.driver.fio);
            }
        }
    } catch (error) {
        console.warn('Не удалось проверить водителя:', error);
        // Не показываем ошибку пользователю, просто продолжаем
    } finally {
        showLoader(false);
        showStep(2);
    }
}

// ==================== ШАГ 2: ФИО ====================
async function handleFioSubmit() {
    console.log('Обработка ФИО...');
    
    const fioInput = document.getElementById('fio-input');
    if (!fioInput) return;
    
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО (не менее 5 символов)', 'error');
        fioInput.focus();
        return;
    }
    
    registrationState.data.fio = fio;
    console.log('ФИО сохранено:', fio);
    
    // Показываем загрузку
    showLoader(true);
    
    try {
        // Загружаем историю поставщиков
        await loadSupplierHistory();
    } catch (error) {
        console.error('Ошибка загрузки поставщиков:', error);
        // Продолжаем даже при ошибке
    } finally {
        showLoader(false);
        showStep(3);
    }
}

// ==================== ШАГ 3: ПОСТАВЩИКИ ====================
async function loadSupplierHistory() {
    console.log('Загрузка истории поставщиков...');
    
    const container = document.getElementById('supplier-buttons');
    const infoBox = document.getElementById('supplier-history-info');
    
    if (!container || !infoBox) {
        console.error('Элементы поставщиков не найдены!');
        return;
    }
    
    // Показываем загрузку
    infoBox.innerHTML = '<p>🔍 Ищу поставщиков по вашему номеру...</p>';
    container.innerHTML = '<div class="info-box">Загрузка...</div>';
    
    try {
        const response = await sendRequest('get_suppliers', { 
            phone: registrationState.data.phone 
        });
        
        console.log('Ответ от get_suppliers:', response);
        
        if (response.success && response.suppliers && response.suppliers.length > 0) {
            // Успешно найдены поставщики
            infoBox.innerHTML = `<p>✅ Найдено поставщиков: ${response.suppliers.length}</p>`;
            container.innerHTML = '';
            
            // Создаем кнопки для каждого поставщика
            response.suppliers.forEach((supplier, index) => {
                if (!supplier || supplier.trim() === '') return;
                
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${supplier}</span>
                `;
                button.onclick = function() {
                    console.log('Выбран поставщик из истории:', supplier);
                    selectSupplier(supplier);
                };
                container.appendChild(button);
            });
            
            console.log(`Создано ${response.suppliers.length} кнопок поставщиков`);
            
        } else {
            // Поставщиков не найдено
            infoBox.innerHTML = '<p>📭 История поставщиков не найдена</p>';
            container.innerHTML = `
                <div class="info-box warning">
                    <p>История поставщиков не найдена для вашего номера телефона.</p>
                    <p>Введите поставщика вручную ниже.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке поставщиков:', error);
        infoBox.innerHTML = '<p>❌ Ошибка загрузки истории</p>';
        container.innerHTML = `
            <div class="info-box warning">
                <p>Не удалось загрузить историю поставщиков.</p>
                <p>Проверьте соединение или введите поставщика вручную.</p>
            </div>
        `;
    }
}

function selectSupplier(supplier) {
    console.log('Выбран поставщик:', supplier);
    registrationState.data.supplier = supplier;
    showStep(4);
}

function handleManualSupplier() {
    console.log('Ручной ввод поставщика...');
    
    const supplierInput = document.getElementById('supplier-input');
    if (!supplierInput) return;
    
    const supplier = supplierInput.value.trim();
    
    if (!supplier) {
        showNotification('Пожалуйста, введите название поставщика', 'error');
        supplierInput.focus();
        return;
    }
    
    registrationState.data.supplier = supplier;
    console.log('Поставщик сохранен:', supplier);
    showStep(4);
}

// ==================== ШАГ 4: ЮРЛИЦО ====================
function selectLegalEntity(entity) {
    console.log('Выбрано юрлицо:', entity);
    registrationState.data.legalEntity = entity;
    showStep(5);
}

// ==================== ШАГ 5: ТИП ТОВАРА ====================
async function selectProductType(type) {
    console.log('Выбран тип товара:', type);
    registrationState.data.productType = type;
    
    // Автоматическое назначение ворот
    const gate = assignGateAutomatically(registrationState.data.legalEntity, type);
    registrationState.data.gate = gate;
    console.log('Назначены ворота:', gate);
    
    // Загружаем популярные марки авто
    await loadPopularBrands();
    
    showStep(6);
}

// ==================== ШАГ 6: МАРКА АВТО ====================
async function loadPopularBrands() {
    console.log('Загрузка популярных марок авто...');
    
    const container = document.getElementById('brand-buttons');
    if (!container) {
        console.error('Контейнер brand-buttons не найден!');
        return;
    }
    
    container.innerHTML = '<div class="info-box">Загрузка популярных марок...</div>';
    
    try {
        const response = await sendRequest('get_popular_brands');
        console.log('Ответ популярных марок:', response);
        
        if (response.success && response.brands && response.brands.length > 0) {
            POPULAR_BRANDS = response.brands;
            container.innerHTML = '';
            
            // Создаем кнопки для каждой марки
            response.brands.forEach((brand, index) => {
                if (!brand || brand.trim() === '') return;
                
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${brand}</span>
                `;
                button.onclick = function() {
                    console.log('Выбрана марка:', brand);
                    selectBrand(brand);
                };
                container.appendChild(button);
            });
            
            console.log(`Создано ${response.brands.length} кнопок марок авто`);
            
        } else {
            // Используем марки по умолчанию
            container.innerHTML = '';
            POPULAR_BRANDS.forEach((brand, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${brand}</span>
                `;
                button.onclick = function() {
                    selectBrand(brand);
                };
                container.appendChild(button);
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки марок:', error);
        // Используем марки по умолчанию при ошибке
        container.innerHTML = '';
        POPULAR_BRANDS.forEach((brand, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'option-btn';
            button.innerHTML = `
                <span class="option-number">${index + 1}</span>
                <span class="option-text">${brand}</span>
            `;
            button.onclick = function() {
                selectBrand(brand);
            };
            container.appendChild(button);
        });
    }
}

function selectBrand(brand) {
    console.log('Выбрана марка авто:', brand);
    registrationState.data.vehicleType = brand;
    showStep(7);
}

function handleManualBrand() {
    console.log('Ручной ввод марки авто...');
    
    const brandInput = document.getElementById('brand-input');
    if (!brandInput) return;
    
    const brand = brandInput.value.trim();
    
    if (!brand) {
        showNotification('Пожалуйста, введите марку авто', 'error');
        brandInput.focus();
        return;
    }
    
    registrationState.data.vehicleType = brand;
    console.log('Марка авто сохранена:', brand);
    showStep(7);
}

// ==================== ШАГ 7: НОМЕР ТС ====================
function handleVehicleNumberSubmit() {
    console.log('Обработка номера ТС...');
    
    const input = document.getElementById('vehicle-number-input');
    if (!input) return;
    
    const vehicleNumber = input.value.trim().toUpperCase();
    
    if (!vehicleNumber) {
        showNotification('Пожалуйста, введите номер транспортного средства', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.vehicleNumber = vehicleNumber;
    console.log('Номер ТС сохранен:', vehicleNumber);
    showStep(8);
}

// ==================== ШАГ 8: ПОДДОНЫ ====================
function handlePalletsSubmit() {
    console.log('Обработка поддонов...');
    
    const input = document.getElementById('pallets-input');
    if (!input) return;
    
    const pallets = parseInt(input.value);
    
    if (isNaN(pallets) || pallets < 0) {
        showNotification('Пожалуйста, введите корректное количество поддонов (0 или больше)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.pallets = pallets;
    console.log('Поддоны сохранены:', pallets);
    showStep(9);
}

// ==================== ШАГ 9: НОМЕР ЗАКАЗА ====================
function handleOrderSubmit() {
    console.log('Обработка номера заказа...');
    
    const input = document.getElementById('order-input');
    if (!input) return;
    
    const orderNumber = input.value.trim();
    
    if (!orderNumber) {
        showNotification('Пожалуйста, введите номер заказа (0 если неизвестен)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.orderNumber = orderNumber;
    console.log('Номер заказа сохранен:', orderNumber);
    showStep(10);
}

// ==================== ШАГ 10: ЭТРН ====================
function handleEtrnSubmit() {
    console.log('Обработка ЭТрН...');
    
    const input = document.getElementById('etrn-input');
    if (!input) return;
    
    const etrn = input.value.trim();
    
    if (!etrn) {
        showNotification('Пожалуйста, введите номер ЭТрН (0 если нет)', 'error');
        input.focus();
        return;
    }
    
    registrationState.data.etrn = etrn;
    console.log('ЭТрН сохранен:', etrn);
    showStep(11);
}

// ==================== ШАГ 11: ТРАНЗИТ ====================
function selectTransit(type) {
    console.log('Выбран тип доставки:', type);
    registrationState.data.transit = type;
    
    // Обновляем дату и время
    const now = new Date();
    registrationState.data.date = formatDate(now);
    registrationState.data.time = formatTime(now);
    
    // Проверяем нарушение графика
    registrationState.data.scheduleViolation = checkScheduleViolation() ? 'Да' : 'Нет';
    console.log('Нарушение графика:', registrationState.data.scheduleViolation);
    
    // Показываем подтверждение
    showConfirmation();
    showStep(12);
}

// ==================== ШАГ 12: ПОДТВЕРЖДЕНИЕ ====================
function showConfirmation() {
    console.log('Показ подтверждения...');
    
    const container = document.getElementById('data-review');
    if (!container) return;
    
    const data = registrationState.data;
    
    let html = '';
    
    // Добавляем все поля данных
    const fields = [
        { label: '📱 Телефон', value: formatPhoneDisplay(data.phone), key: 'phone' },
        { label: '👤 ФИО', value: data.fio, key: 'fio' },
        { label: '🏢 Поставщик', value: data.supplier, key: 'supplier' },
        { label: '🏛️ Юрлицо', value: data.legalEntity, key: 'legalEntity' },
        { label: '📦 Тип товара', value: data.productType, key: 'productType' },
        { label: '🚗 Марка авто', value: data.vehicleType, key: 'vehicleType' },
        { label: '🔢 Номер ТС', value: data.vehicleNumber, key: 'vehicleNumber' },
        { label: '📦 Поддоны', value: data.pallets, key: 'pallets' },
        { label: '📋 Номер заказа', value: data.orderNumber, key: 'orderNumber' },
        { label: '📱 ЭТрН', value: data.etrn, key: 'etrn' },
        { label: '📦 Транзит', value: data.transit, key: 'transit' }
    ];
    
    fields.forEach(field => {
        if (field.value) {
            html += `
                <div class="data-item">
                    <span class="data-label">${field.label}:</span>
                    <span class="data-value">${field.value}</span>
                </div>
            `;
        }
    });
    
    // Ворота (особый стиль)
    html += `
        <div class="data-item highlight">
            <span class="data-label">🚪 Ворота:</span>
            <span class="data-value">${data.gate || 'Не назначены'}</span>
        </div>
    `;
    
    // Нарушение графика (если есть)
    if (data.scheduleViolation === 'Да') {
        html += `
            <div class="data-item warning">
                <span class="data-label">⚠️ Нарушение графика:</span>
                <span class="data-value">ДА</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
    console.log('Подтверждение отображено');
}

// ==================== ШАГ 13: ОТПРАВКА ====================
async function submitRegistration() {
    console.log('Отправка регистрации...');
    console.log('Данные для отправки:', registrationState.data);
    
    // Показываем загрузку
    showLoader(true);
    
    try {
        const response = await sendRequest('register_driver', {
            data: registrationState.data
        });
        
        console.log('Ответ от сервера:', response);
        
        if (response.success) {
            console.log('✅ Регистрация успешна!');
            
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
            
        } else {
            console.error('❌ Ошибка от сервера:', response.message);
            throw new Error(response.message || 'Неизвестная ошибка сервера');
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
            
            showNotification('Данные сохранены локально и будут отправлены при восстановлении связи', 'warning');
        } else {
            console.error('❌ Ошибка сохранения оффлайн');
            showNotification('Ошибка сохранения данных. Попробуйте еще раз.', 'error');
        }
    } finally {
        showLoader(false);
    }
}

function showSuccessMessage(serverData = null) {
    console.log('Показ успешного сообщения...');
    
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
            <p>📍 <strong>Пожалуйста, придерживайтесь схемы движения на распределительном центре.</strong></p>
            <p>🚛 <strong>Соблюдайте скоростной режим 5 км/ч</strong></p>
            <p>📋 <strong>Следуйте указаниям персонала</strong></p>
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
    console.log('Сообщение об успехе отображено');
}

// ==================== СБРОС РЕГИСТРАЦИИ ====================
function resetRegistration() {
    console.log('Сброс регистрации...');
    
    if (confirm('Вы уверены, что хотите начать регистрацию заново? Все введенные данные будут потеряны.')) {
        resetRegistrationState();
        clearFormFields();
        showStep(1);
        showNotification('Регистрация сброшена', 'info');
    }
}

function resetRegistrationState() {
    console.log('Сброс состояния регистрации...');
    
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
    console.log('Очистка полей формы...');
    
    const fields = [
        'phone-input',
        'fio-input', 
        'supplier-input',
        'brand-input',
        'vehicle-number-input',
        'pallets-input',
        'order-input',
        'etrn-input'
    ];
    
    fields.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
        }
    });
}

// ==================== СОХРАНЕНИЕ СОСТОЯНИЯ ====================
function saveRegistrationState() {
    try {
        localStorage.setItem('driver_registration_state', JSON.stringify(registrationState));
        console.log('Состояние сохранено в localStorage');
    } catch (error) {
        console.error('Ошибка сохранения состояния:', error);
    }
}

function loadRegistrationState() {
    try {
        const saved = localStorage.getItem('driver_registration_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            
            // Обновляем состояние
            registrationState = parsed;
            
            // Восстанавливаем поля ввода
            const phoneInput = document.getElementById('phone-input');
            const fioInput = document.getElementById('fio-input');
            
            if (phoneInput && registrationState.data.phone) {
                phoneInput.value = formatPhoneDisplay(registrationState.data.phone);
            }
            
            if (fioInput && registrationState.data.fio) {
                fioInput.value = registrationState.data.fio;
            }
            
            console.log('Состояние восстановлено из localStorage');
        }
    } catch (error) {
        console.error('Ошибка загрузки состояния:', error);
    }
}

// ==================== ОФФЛАЙН СОХРАНЕНИЕ ====================
function saveRegistrationOffline() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        offlineRegistrations.push({
            data: registrationState.data,
            timestamp: new Date().toISOString()
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        console.log('Данные сохранены оффлайн. Всего записей:', offlineRegistrations.length);
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения оффлайн:', error);
        return false;
    }
}

// ==================== API ФУНКЦИИ ====================
async function sendRequest(action, data = {}) {
    try {
        const url = CONFIG.APP_SCRIPT_URL;
        console.log(`Отправка запроса ${action} на ${url}`);
        
        const requestData = {
            action: action,
            ...data
        };
        
        console.log('Данные запроса:', requestData);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Статус ответа:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ошибка ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Ответ API:', result);
        
        return result;
        
    } catch (error) {
        console.error('Ошибка API запроса:', error);
        throw error;
    }
}

async function testAPIConnection() {
    try {
        console.log('Тестирование соединения с API...');
        
        // Используем параметр action=ping для GET запроса
        const url = CONFIG.APP_SCRIPT_URL + '?action=ping&test=' + Date.now();
        console.log('Тестирую URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache' // Отключаем кеширование
        });
        
        console.log('Статус ответа теста:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('API доступен:', data);
            updateConnectionStatus(true);
            return true;
        } else {
            console.warn('API недоступен, статус:', response.status);
            updateConnectionStatus(false);
            return false;
        }
        
    } catch (error) {
        console.warn('API недоступен, ошибка:', error);
        updateConnectionStatus(false);
        return false;
    }
}

function updateConnectionStatus(isConnected) {
    console.log('Обновление статуса соединения:', isConnected ? 'онлайн' : 'оффлайн');
    
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
    
    const isViolation = hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes);
    console.log(`Проверка графика для ${productType}: ${hours}:${minutes}, нарушение: ${isViolation}`);
    
    return isViolation;
}

function assignGateAutomatically(legalEntity, productType) {
    console.log(`Автоназначение ворот для ${legalEntity}/${productType}`);
    
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
    console.log(`Enter на шаге ${step}, поле: ${input.id}`);
    
    switch(step) {
        case 1: 
            handlePhoneSubmit(); 
            break;
        case 2: 
            handleFioSubmit(); 
            break;
        case 3: 
            handleManualSupplier(); 
            break;
        case 6: 
            handleManualBrand(); 
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
            console.log('Enter не обрабатывается на этом шаге');
    }
}

// ==================== UI ФУНКЦИИ ====================
function showNotification(message, type = 'info') {
    console.log(`Показ уведомления [${type}]: ${message}`);
    
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
        console.log('Лоадер:', show ? 'показан' : 'скрыт');
    }
}

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

console.log('app.js загружен, функции экспортированы');

