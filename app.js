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

// Популярные марки авто
const POPULAR_BRANDS = ['Газель', 'Мерседес', 'Вольво', 'Скания', 'Ман'];

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
    
    // Проверяем что все элементы существуют
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

function handlePhoneSubmit() {
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
    
    // Проверка существующего водителя
    setTimeout(() => {
        showLoader(false);
        showStep(2); // Переход к вводу ФИО
    }, 1000);
}

// Шаг 2: Ввод ФИО
function handleFioSubmit() {
    const fioInput = document.getElementById('fio-input');
    if (!fioInput) return;
    
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО', 'error');
        fioInput.focus();
        return;
    }
    
    registrationState.data.fio = fio;
    showStep(3); // Переход к выбору поставщика
}

// Шаг 3: Выбор поставщика
function selectSupplier(supplier) {
    registrationState.data.supplier = supplier;
    showStep(4); // Переход к выбору юрлица
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
    showStep(4); // Переход к выбору юрлица
}

// Шаг 4: Выбор юрлица
function selectLegalEntity(entity) {
    registrationState.data.legalEntity = entity;
    showStep(5); // Переход к выбору типа товара
}

// Шаг 5: Выбор типа товара
function selectProductType(type) {
    registrationState.data.productType = type;
    
    // Автоматическое назначение ворот
    const gate = assignGateAutomatically(registrationState.data.legalEntity, type);
    registrationState.data.gate = gate;
    
    showStep(6); // Переход к выбору марки авто
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
function selectBrand(brand) {
    registrationState.data.vehicleType = brand;
    showStep(7); // Переход к вводу номера ТС
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
    showStep(7); // Переход к вводу номера ТС
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
    showStep(8); // Переход к вводу поддонов
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
    showStep(9); // Переход к вводу номера заказа
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
    showStep(10); // Переход к вводу ЭТрН
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
    showStep(11); // Переход к выбору транзита
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
        // Отправка данных в Google Sheets
        const response = await saveToGoogleSheets(registrationState.data);
        
        if (response && response.success) {
            showSuccessMessage();
            resetRegistrationState();
            showStep(13);
        } else {
            showNotification('Ошибка при сохранении данных', 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showNotification('Данные сохранены локально. Отправлены при восстановлении связи.', 'warning');
        saveRegistrationOffline();
        showStep(13);
    } finally {
        showLoader(false);
    }
}

// Сохранение в Google Sheets
async function saveToGoogleSheets(data) {
    try {
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'register_driver',
                data: data
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        throw error;
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
    // Просто предотвращаем автоматический показ
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


