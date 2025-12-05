// Конфигурация для GitHub Pages
const CONFIG = {
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDATeBrTYOYUnP9JrjcUXuKHXbPWl75X-BTE-OFsREZLFB4I9qX-f4Ctu_MzKaGBko/exec',
    BASE_URL: 'https://pobeda-user.github.io/reg_driver_ULN/',
    SPREADSHEET_ID: '1GcF4SDjUse7cDE2gsO50PLeTfjxaw_IAR6sZ-G1eBpA'
};

// Состояние регистрации
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
        status: 'Зарегистрирован',
        date: '',
        time: '',
        scheduleViolation: 'Нет'
    }
};

// Популярные марки авто (будут загружены с сервера)
let POPULAR_BRANDS = ['Газель', 'Мерседес', 'Вольво', 'Скания', 'Ман'];

// График заезда
const ENTRY_SCHEDULE = {
    'Сухой': { start: 7, end: 16, endMinutes: 30 },
    'ФРЕШ': { start: 7, end: 14, endMinutes: 0 },
    'ФРОВ': { start: 7, end: 14, endMinutes: 0 },
    'Акциз': { start: 7, end: 13, endMinutes: 0 }
};

// Инициализация после полной загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем приложение');
    
    setTimeout(() => {
        if (checkElementsExist()) {
            initApp();
        } else {
            console.error('Не все элементы найдены, пробуем через 1 секунду');
            setTimeout(initApp, 1000);
        }
    }, 100);
});

// Проверка существования основных элементов
function checkElementsExist() {
    const requiredElements = [
        'phone-input',
        'fio-input',
        'supplier-input',
        'brand-input',
        'vehicle-number-input',
        'pallets-input',
        'order-input',
        'etrn-input'
    ];
    
    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            console.warn('Элемент не найден:', id);
            return false;
        }
    }
    return true;
}

// Инициализация приложения
function initApp() {
    console.log('Инициализация приложения');
    
    loadRegistrationState();
    setupPhoneInput();
    setupEventListeners();
    checkConnection();
    
    // Тестируем соединение при запуске
    testConnection().then(isConnected => {
        if (!isConnected) {
            showNotification('Оффлайн режим. Данные будут сохранены локально.', 'warning');
        }
    });
    
    // Загружаем популярные марки авто
    loadPopularBrands();
    
    // Показываем текущий шаг
    showStep(registrationState.step);
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработчики для кнопок навигации
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-action="back"]')) {
            goBack();
        }
        if (e.target.closest('[data-action="reset"]')) {
            resetRegistration();
        }
    });
    
    // Обработчики Enter для полей ввода
    const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleEnterKey(this);
            }
        });
    });
}

// Сохранение состояния в localStorage
function saveRegistrationState() {
    try {
        localStorage.setItem('driver_registration_state', JSON.stringify(registrationState));
        console.log('Состояние сохранено');
    } catch (error) {
        console.error('Ошибка сохранения состояния:', error);
    }
}

function loadRegistrationState() {
    try {
        const saved = localStorage.getItem('driver_registration_state');
        if (saved) {
            registrationState = JSON.parse(saved);
            console.log('Состояние восстановлено');
            
            // Восстанавливаем данные в полях
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

// Навигация по шагам
function showStep(stepNumber) {
    console.log('Переход к шагу:', stepNumber);
    
    // Скрыть все шаги
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
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

// Шаг 1: Ввод телефона
function setupPhoneInput() {
    const phoneInput = document.getElementById('phone-input');
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\s/g, ''); // Убираем пробелы
        
        // Если цифр больше 10, обрезаем
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
        
        // Позиция курсора в конец
        setTimeout(() => {
            phoneInput.selectionStart = phoneInput.selectionEnd = formatted.length;
        }, 0);
    });
    
    // Обработка клавиш Backspace и Delete
    phoneInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            setTimeout(() => {
                let value = phoneInput.value.replace(/\s/g, '');
                if (value.length < phoneInput.value.length) {
                    phoneInput.value = value;
                }
            }, 10);
        }
    });
    
    // Enter для перехода
    phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handlePhoneSubmit();
        }
    });
    
    // Фокус при загрузке
    setTimeout(() => phoneInput.focus(), 100);
}

async function handlePhoneSubmit() {
    const phoneInput = document.getElementById('phone-input');
    if (!phoneInput) return;
    
    let phone = phoneInput.value.replace(/\s/g, '');
    
    if (!phone || phone.length < 10) {
        showNotification('Пожалуйста, введите корректный номер телефона', 'error');
        phoneInput.focus();
        return;
    }
    
    // Нормализация номера
    phone = normalizePhone(phone);
    registrationState.data.phone = phone;
    
    showLoader(true);
    
    try {
        // Проверяем существующего водителя
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'check_driver',
                phone: phone
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.exists && data.driver) {
                // Автозаполнение ФИО
                const fioInput = document.getElementById('fio-input');
                if (fioInput && data.driver.fio) {
                    fioInput.value = data.driver.fio;
                    registrationState.data.fio = data.driver.fio;
                }
            }
        }
    } catch (error) {
        console.error('Ошибка проверки водителя:', error);
    } finally {
        showLoader(false);
        showStep(2);
    }
}

// Шаг 2: Ввод ФИО
async function handleFioSubmit() {
    const fioInput = document.getElementById('fio-input');
    if (!fioInput) return;
    
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО', 'error');
        fioInput.focus();
        return;
    }
    
    registrationState.data.fio = fio;
    
    // Загружаем историю поставщиков
    await loadSupplierHistory();
    showStep(3);
}

// Шаг 3: Выбор поставщика
async function loadSupplierHistory() {
    try {
        showLoader(true);
        
        console.log('Загружаю поставщиков для телефона:', registrationState.data.phone);
        
        // Используем URL с параметром для обхода CORS
        const url = `${CONFIG.APP_SCRIPT_URL}?action=get_suppliers&phone=${encodeURIComponent(registrationState.data.phone)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'no-cors' // Используем no-cors для простых запросов
        });
        
        // Для no-cors мы не можем прочитать ответ, поэтому пробуем POST
        const postResponse = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_suppliers',
                phone: registrationState.data.phone
            })
        });
        
        if (postResponse.ok) {
            const data = await postResponse.json();
            console.log('Получены поставщики:', data);
            
            if (data.success) {
                initSupplierButtons(data.suppliers);
            } else {
                showNotification('Не удалось загрузить историю поставщиков', 'warning');
                initSupplierButtons([]);
            }
        } else {
            console.warn('Ошибка при загрузке поставщиков');
            initSupplierButtons([]);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки истории поставщиков:', error);
        showNotification('Не удалось загрузить историю поставщиков', 'warning');
        initSupplierButtons([]);
    } finally {
        showLoader(false);
    }
}

function initSupplierButtons(suppliers) {
    const container = document.getElementById('supplier-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (suppliers && suppliers.length > 0) {
        suppliers.forEach((supplier, index) => {
            if (supplier && supplier.trim()) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${supplier}</span>
                `;
                button.onclick = () => selectSupplier(supplier);
                container.appendChild(button);
            }
        });
    } else {
        // Если поставщиков нет, показываем сообщение
        const message = document.createElement('div');
        message.className = 'info-box warning';
        message.innerHTML = '<p>История поставщиков не найдена. Введите поставщика вручную ниже.</p>';
        container.appendChild(message);
    }
}

function selectSupplier(supplier) {
    console.log('Выбран поставщик:', supplier);
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
    showStep(4);
}

// Шаг 4: Выбор юрлица
function selectLegalEntity(entity) {
    registrationState.data.legalEntity = entity;
    showStep(5);
}

// Шаг 5: Выбор типа товара
async function selectProductType(type) {
    registrationState.data.productType = type;
    
    // Автоматическое назначение ворот
    const gate = assignGateAutomatically(registrationState.data.legalEntity, type);
    registrationState.data.gate = gate;
    
    // Показываем популярные марки
    await initPopularBrands();
    showStep(6);
}

function assignGateAutomatically(legalEntity, productType) {
    if (productType === 'Сухой') {
        if (legalEntity === 'Гулливер') return 'с 31 по 36 (бакалея соль,мука и т.п,вода,консервы) и с 38 по 39 (кондитерка, уголь, пакеты, батарейки, жвачки и т.п)';
        if (legalEntity === 'ТК Лето') return 'с 26 по 30, с 20 по 22 (для кондитерки)';
    }
    
    if (productType === 'ФРЕШ') {
        if (legalEntity === 'Гулливер') return 'с 45 по 51, с 5 по 8';
        if (legalEntity === 'ТК Лето') return 'с 45 по 51';
    }
    
    if (productType === 'ФРОВ') return 'с 9 по 11';
    if (productType === 'Акциз') return 'с 40 по 41';
    
    return 'Не назначены';
}

// Шаг 6: Марка авто
async function loadPopularBrands() {
    try {
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_popular_brands'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.brands && data.brands.length > 0) {
                POPULAR_BRANDS = data.brands;
                console.log('Загружены популярные марки:', POPULAR_BRANDS);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки популярных марок:', error);
        // Используем значения по умолчанию
        POPULAR_BRANDS = ['Газель', 'Мерседес', 'Вольво', 'Скания', 'Ман'];
    }
}

async function initPopularBrands() {
    const container = document.getElementById('brand-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Ждем загрузки популярных марок
    if (POPULAR_BRANDS.length === 0) {
        await loadPopularBrands();
    }
    
    POPULAR_BRANDS.forEach((brand, index) => {
        if (brand && brand.trim()) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'option-btn';
            button.innerHTML = `
                <span class="option-number">${index + 1}</span>
                <span class="option-text">${brand}</span>
            `;
            button.onclick = () => selectBrand(brand);
            container.appendChild(button);
        }
    });
}

function selectBrand(brand) {
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
    showStep(7);
}

// Шаг 7: Номер ТС
function handleVehicleNumberSubmit() {
    const vehicleNumberInput = document.getElementById('vehicle-number-input');
    if (!vehicleNumberInput) return;
    
    const vehicleNumber = vehicleNumberInput.value.trim().toUpperCase();
    
    if (!vehicleNumber) {
        showNotification('Пожалуйста, введите номер ТС', 'error');
        vehicleNumberInput.focus();
        return;
    }
    
    registrationState.data.vehicleNumber = vehicleNumber;
    showStep(8);
}

// Шаг 8: Количество поддонов
function handlePalletsSubmit() {
    const palletsInput = document.getElementById('pallets-input');
    if (!palletsInput) return;
    
    const pallets = parseInt(palletsInput.value);
    
    if (isNaN(pallets) || pallets < 0) {
        showNotification('Пожалуйста, введите корректное количество поддонов', 'error');
        palletsInput.focus();
        return;
    }
    
    registrationState.data.pallets = pallets;
    showStep(9);
}

// Шаг 9: Номер заказа
function handleOrderSubmit() {
    const orderInput = document.getElementById('order-input');
    if (!orderInput) return;
    
    const orderNumber = orderInput.value.trim();
    
    if (!orderNumber) {
        showNotification('Пожалуйста, введите номер заказа (0 если не знаете)', 'error');
        orderInput.focus();
        return;
    }
    
    registrationState.data.orderNumber = orderNumber;
    showStep(10);
}

// Шаг 10: ЭТрН
function handleEtrnSubmit() {
    const etrnInput = document.getElementById('etrn-input');
    if (!etrnInput) return;
    
    const etrn = etrnInput.value.trim();
    
    if (!etrn) {
        showNotification('Пожалуйста, введите номер ЭТрН (0 если не знаете)', 'error');
        etrnInput.focus();
        return;
    }
    
    registrationState.data.etrn = etrn;
    showStep(11);
}

// Шаг 11: Транзит
function selectTransit(value) {
    registrationState.data.transit = value;
    
    // Обновляем дату и время
    const now = new Date();
    registrationState.data.date = formatDate(now);
    registrationState.data.time = formatTime(now);
    
    // Проверяем нарушение графика
    registrationState.data.scheduleViolation = checkScheduleViolation() ? 'Да' : 'Нет';
    
    // Показываем подтверждение
    showConfirmation();
    showStep(12);
}

// Шаг 12: Подтверждение
function showConfirmation() {
    const container = document.getElementById('data-review');
    if (!container) return;
    
    const data = registrationState.data;
    
    container.innerHTML = `
        <div class="data-item">
            <span class="data-label">📱 Телефон:</span>
            <span class="data-value">${formatPhoneDisplay(data.phone)}</span>
        </div>
        <div class="data-item">
            <span class="data-label">👤 ФИО:</span>
            <span class="data-value">${data.fio}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🏢 Поставщик:</span>
            <span class="data-value">${data.supplier}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🏛️ Юрлицо:</span>
            <span class="data-value">${data.legalEntity}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📦 Тип товара:</span>
            <span class="data-value">${data.productType}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🚗 Марка авто:</span>
            <span class="data-value">${data.vehicleType}</span>
        </div>
        <div class="data-item">
            <span class="data-label">🔢 Номер ТС:</span>
            <span class="data-value">${data.vehicleNumber}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📦 Поддоны:</span>
            <span class="data-value">${data.pallets}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📋 Номер заказа:</span>
            <span class="data-value">${data.orderNumber}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📱 ЭТрН:</span>
            <span class="data-value">${data.etrn}</span>
        </div>
        <div class="data-item">
            <span class="data-label">📦 Транзит:</span>
            <span class="data-value">${data.transit}</span>
        </div>
        <div class="data-item highlight">
            <span class="data-label">🚪 Ворота:</span>
            <span class="data-value">${data.gate}</span>
        </div>
        ${data.scheduleViolation === 'Да' ? `
        <div class="data-item warning">
            <span class="data-label">⚠️ Нарушение графика:</span>
            <span class="data-value">ДА</span>
        </div>
        ` : ''}
    `;
}

// Отправка регистрации
async function submitRegistration() {
    showLoader(true);
    
    try {
        // Подготовка данных для отправки
        const postData = {
            action: 'register_driver',
            data: {
                phone: registrationState.data.phone,
                fio: registrationState.data.fio,
                supplier: registrationState.data.supplier,
                legalEntity: registrationState.data.legalEntity,
                productType: registrationState.data.productType,
                vehicleType: registrationState.data.vehicleType,
                vehicleNumber: registrationState.data.vehicleNumber,
                pallets: registrationState.data.pallets,
                orderNumber: registrationState.data.orderNumber,
                etrn: registrationState.data.etrn,
                transit: registrationState.data.transit,
                gate: registrationState.data.gate
            }
        };
        
        console.log('Отправляю данные:', postData);
        
        // Способ 1: Прямой POST запрос
        try {
            const response = await fetch(CONFIG.APP_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData)
            });
            
            console.log('Статус ответа:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Ответ сервера:', result);
                
                if (result.success) {
                    showSuccessMessage();
                    resetRegistrationState();
                    showStep(13);
                    return;
                } else {
                    throw new Error(result.message || 'Ошибка сервера');
                }
            } else {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
        } catch (fetchError) {
            console.log('POST не удался, пробуем альтернативный метод:', fetchError);
            
            // Способ 2: Используем Google Forms URL
            const formData = new FormData();
            Object.keys(postData.data).forEach(key => {
                formData.append(key, postData.data[key]);
            });
            
            const altResponse = await fetch(CONFIG.APP_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });
            
            if (altResponse.ok) {
                showSuccessMessage();
                resetRegistrationState();
                showStep(13);
                return;
            }
            
            throw fetchError;
        }
        
    } catch (error) {
        console.error('Все способы отправки не удались:', error);
        
        // Пробуем через GET как последний вариант
        try {
            const params = new URLSearchParams();
            Object.keys(registrationState.data).forEach(key => {
                if (registrationState.data[key]) {
                    params.append(key, registrationState.data[key]);
                }
            });
            
            await fetch(`${CONFIG.APP_SCRIPT_URL}?${params.toString()}&action=register_driver`);
            
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            
        } catch (lastError) {
            console.error('Последняя попытка тоже не удалась:', lastError);
            
            // Сохраняем оффлайн
            saveRegistrationOffline();
            
            // Все равно показываем успех пользователю
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
            
            showNotification('Данные сохранены локально и будут отправлены при восстановлении связи', 'warning');
        }
    } finally {
        showLoader(false);
    }
}

// Оффлайн сохранение
function saveRegistrationOffline() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        offlineRegistrations.push({
            data: registrationState.data,
            timestamp: new Date().toISOString()
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        console.log('Данные сохранены оффлайн');
        showNotification('Данные сохранены локально. Отправятся при восстановлении связи.', 'warning');
        return true;
    } catch (error) {
        console.error('Ошибка оффлайн сохранения:', error);
        return false;
    }
}

// Шаг 13: Успешная регистрация
function showSuccessMessage() {
    const container = document.getElementById('success-message');
    if (!container) return;
    
    const data = registrationState.data;
    
    let message = `
        <div class="success-icon-large">✅</div>
        <h3>Добро пожаловать, ${data.fio}!</h3>
        <p>Ваша регистрация прошла успешно!</p>
        
        <div class="success-details">
            <p><strong>Ваши ворота:</strong> ${data.gate}</p>
            <p><strong>Статус:</strong> Зарегистрирован</p>
            <p><strong>Время регистрации:</strong> ${data.date} ${data.time}</p>
        </div>
        
        <div class="info-box">
            <p>📍 <strong>Пожалуйста, придерживайтесь схемы движения на распределительном центре.</strong></p>
            <p>🚛 <strong>Соблюдайте скоростной режим 5 км/ч</strong></p>
            <p>📋 <strong>Следуйте указаниям персонала</strong></p>
        </div>
    `;
    
    if (data.scheduleViolation === 'Да') {
        message += `
            <div class="warning-box">
                <p>⚠️ <strong>ВНИМАНИЕ!</strong> Вы нарушили график заезда!</p>
                <p>Рекомендуем связаться с вашим поставщиком.</p>
            </div>
        `;
    }
    
    container.innerHTML = message;
}

// Сброс регистрации
function resetRegistration() {
    if (confirm('Вы уверены, что хотите начать регистрацию заново?')) {
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
            status: 'Зарегистрирован',
            date: '',
            time: '',
            scheduleViolation: 'Нет'
        }
    };
    
    localStorage.removeItem('driver_registration_state');
}

function clearFormFields() {
    const inputs = [
        'phone-input', 'fio-input', 'supplier-input', 'brand-input',
        'vehicle-number-input', 'pallets-input', 'order-input', 'etrn-input'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
}

// Вспомогательные функции
function normalizePhone(phone) {
    if (!phone) return '';
    
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
        cleaned = '7' + cleaned;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.substring(1);
    }
    
    return '+' + cleaned;
}

function formatPhoneDisplay(phone) {
    if (!phone) return '';
    
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})$/);
        if (match) {
            return `${match[2]} ${match[3]} ${match[4]} ${match[5]}`;
        }
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
    if (!productType || !ENTRY_SCHEDULE[productType]) return false;
    
    const schedule = ENTRY_SCHEDULE[productType];
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes)) {
        return true;
    }
    
    return false;
}

// Обработка нажатия Enter
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

// Уведомления
function showNotification(message, type = 'info') {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        left: 20px;
        max-width: 400px;
        margin: 0 auto;
        padding: 16px 24px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Загрузчик
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// Проверка соединения
function checkConnection() {
    if (!navigator.onLine) {
        showNotification('Вы в оффлайн режиме. Данные будут сохранены локально.', 'warning');
    }
}

// Обработчики онлайн/оффлайн
window.addEventListener('online', () => {
    showNotification('Соединение восстановлено', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Нет соединения с интернетом', 'warning');
});

// Убрать автоматический показ установки PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
});

// Экспорт функций для глобального использования
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

// Добавьте функцию для тестирования соединения
async function testConnection() {
    try {
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'GET'
        });
        
        if (response.ok) {
            console.log('Соединение с Google Apps Script установлено');
            return true;
        }
    } catch (error) {
        console.warn('Нет соединения с Google Apps Script:', error);
        return false;
    }
}
// Функция для отправки оффлайн данных при восстановлении соединения
async function syncOfflineData() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        if (offlineRegistrations.length === 0) return;
        
        console.log(`Найдено ${offlineRegistrations.length} оффлайн регистраций`);
        
        for (const registration of offlineRegistrations) {
            try {
                await fetch(CONFIG.APP_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'register_driver',
                        data: registration.data
                    })
                });
                
                console.log('Оффлайн регистрация отправлена:', registration.data);
            } catch (error) {
                console.error('Ошибка отправки оффлайн данных:', error);
                break; // Прерываем если ошибка
            }
        }
        
        // Очищаем отправленные данные
        localStorage.removeItem('offline_registrations');
        showNotification('Оффлайн данные синхронизированы', 'success');
        
    } catch (error) {
        console.error('Ошибка синхронизации оффлайн данных:', error);
    }
}

// Вызывайте при восстановлении соединения
window.addEventListener('online', () => {
    showNotification('Соединение восстановлено', 'success');
    setTimeout(syncOfflineData, 1000); // Синхронизируем через 1 секунду
});
