// Конфигурация
const CONFIG = {
    SPREADSHEET_ID: '1GcF4SDjUse7cDE2gsO50PLeTfjxaw_IAR6sZ-G1eBpA',
    SHEET_NAME: 'Регистрация водителей',
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDATeBrTYOYUnP9JrjcUXuKHXbPWl75X-BTE-OFsREZLFB4I9qX-f4Ctu_MzKaGBko/exec', // Замените на ваш URL
    NOTIFICATION_ENDPOINT: 'https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage' // Опционально
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

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadRegistrationState();
    setupPhoneInput();
});

// Сохранение состояния в localStorage
function saveRegistrationState() {
    localStorage.setItem('driver_registration_state', JSON.stringify(registrationState));
}

function loadRegistrationState() {
    const saved = localStorage.getItem('driver_registration_state');
    if (saved) {
        registrationState = JSON.parse(saved);
        showStep(registrationState.step);
        
        // Восстанавливаем данные в полях
        if (registrationState.data.phone) {
            document.getElementById('phone-input').value = registrationState.data.phone;
        }
        if (registrationState.data.fio) {
            document.getElementById('fio-input').value = registrationState.data.fio;
        }
    }
}

// Навигация по шагам
function showStep(stepNumber) {
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
        let value = e.target.value.replace(/\D/g, '');
        
        // Форматирование: 999 123 45 67
        if (value.length > 0) {
            value = value.match(/(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
            value = [value[1], value[2], value[3], value[4]].filter(Boolean).join(' ');
        }
        
        e.target.value = value;
    });
}

function handlePhoneSubmit() {
    const phoneInput = document.getElementById('phone-input');
    let phone = phoneInput.value.replace(/\s/g, '');
    
    if (!phone || phone.length < 10) {
        showNotification('Пожалуйста, введите корректный номер телефона', 'error');
        return;
    }
    
    // Нормализация номера
    phone = normalizePhone(phone);
    registrationState.data.phone = phone;
    
    // Проверка существующего водителя
    checkExistingDriver(phone);
}

function normalizePhone(phone) {
    // Убираем все нецифровые символы
    let cleaned = phone.replace(/\D/g, '');
    
    // Добавляем +7 если нужно
    if (cleaned.length === 10) {
        cleaned = '7' + cleaned;
    }
    
    return '+' + cleaned;
}

function checkExistingDriver(phone) {
    showLoader(true);
    
    // Здесь будет запрос к Google Apps Script для проверки существующего водителя
    // Временная заглушка
    setTimeout(() => {
        showLoader(false);
        
        // Если водитель найден
        // registrationState.data.fio = 'Иванов Иван Иванович'; // Пример
        
        showStep(2); // Переход к вводу ФИО
    }, 1000);
}

// Шаг 2: Ввод ФИО
function handleFioSubmit() {
    const fioInput = document.getElementById('fio-input');
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО', 'error');
        return;
    }
    
    registrationState.data.fio = fio;
    
    // Загружаем историю поставщиков
    loadSupplierHistory();
    
    showStep(3); // Переход к выбору поставщика
}

// Шаг 3: Выбор поставщика
function loadSupplierHistory() {
    // Здесь будет запрос к Google Apps Script для получения истории поставщиков
    // Временный пример данных
    const previousSuppliers = ['ООО "Продукты"', 'ИП Петров', 'ЗАО "Мясокомбинат"'];
    
    const container = document.getElementById('supplier-buttons');
    container.innerHTML = '';
    
    previousSuppliers.forEach((supplier, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.innerHTML = `
            <span class="option-number">${index + 1}</span>
            <span class="option-text">${supplier}</span>
        `;
        button.onclick = () => selectSupplier(supplier);
        container.appendChild(button);
    });
}

function selectSupplier(supplier) {
    registrationState.data.supplier = supplier;
    showStep(4); // Переход к выбору юрлица
}

function handleManualSupplier() {
    const supplierInput = document.getElementById('supplier-input');
    const supplier = supplierInput.value.trim();
    
    if (!supplier) {
        showNotification('Пожалуйста, введите название поставщика', 'error');
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
    
    // Загрузка популярных марок авто
    loadPopularBrands();
    
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
function loadPopularBrands() {
    const container = document.getElementById('brand-buttons');
    container.innerHTML = '';
    
    POPULAR_BRANDS.forEach((brand, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.innerHTML = `
            <span class="option-number">${index + 1}</span>
            <span class="option-text">${brand}</span>
        `;
        button.onclick = () => selectBrand(brand);
        container.appendChild(button);
    });
}

function selectBrand(brand) {
    registrationState.data.vehicleType = brand;
    showStep(7); // Переход к вводу номера ТС
}

function handleManualBrand() {
    const brandInput = document.getElementById('brand-input');
    const brand = brandInput.value.trim();
    
    if (!brand) {
        showNotification('Пожалуйста, введите марку авто', 'error');
        return;
    }
    
    registrationState.data.vehicleType = brand;
    showStep(7); // Переход к вводу номера ТС
}

// Шаг 7: Номер ТС
function handleVehicleNumberSubmit() {
    const vehicleNumberInput = document.getElementById('vehicle-number-input');
    const vehicleNumber = vehicleNumberInput.value.trim().toUpperCase();
    
    if (!vehicleNumber) {
        showNotification('Пожалуйста, введите номер ТС', 'error');
        return;
    }
    
    registrationState.data.vehicleNumber = vehicleNumber;
    showStep(8); // Переход к вводу поддонов
}

// Шаг 8: Количество поддонов
function handlePalletsSubmit() {
    const palletsInput = document.getElementById('pallets-input');
    const pallets = parseInt(palletsInput.value);
    
    if (isNaN(pallets) || pallets < 0) {
        showNotification('Пожалуйста, введите корректное количество поддонов', 'error');
        return;
    }
    
    registrationState.data.pallets = pallets;
    showStep(9); // Переход к вводу номера заказа
}

// Шаг 9: Номер заказа
function handleOrderSubmit() {
    const orderInput = document.getElementById('order-input');
    const orderNumber = orderInput.value.trim();
    
    if (!orderNumber) {
        showNotification('Пожалуйста, введите номер заказа (0 если не знаете)', 'error');
        return;
    }
    
    registrationState.data.orderNumber = orderNumber;
    showStep(10); // Переход к вводу ЭТрН
}

// Шаг 10: ЭТрН
function handleEtrnSubmit() {
    const etrnInput = document.getElementById('etrn-input');
    const etrn = etrnInput.value.trim();
    
    if (!etrn) {
        showNotification('Пожалуйста, введите номер ЭТрН (0 если не знаете)', 'error');
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

function checkScheduleViolation() {
    if (!registrationState.data.productType) return false;
    
    const schedule = ENTRY_SCHEDULE[registrationState.data.productType];
    if (!schedule) return false;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes)) {
        return true;
    }
    
    return false;
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

// Шаг 12: Подтверждение
function showConfirmation() {
    const container = document.getElementById('data-review');
    const data = registrationState.data;
    
    container.innerHTML = `
        <div class="data-item">
            <span class="data-label">Телефон:</span>
            <span class="data-value">${data.phone}</span>
        </div>
        <div class="data-item">
            <span class="data-label">ФИО:</span>
            <span class="data-value">${data.fio}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Поставщик:</span>
            <span class="data-value">${data.supplier}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Юрлицо:</span>
            <span class="data-value">${data.legalEntity}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Тип товара:</span>
            <span class="data-value">${data.productType}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Марка авто:</span>
            <span class="data-value">${data.vehicleType}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Номер ТС:</span>
            <span class="data-value">${data.vehicleNumber}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Поддоны:</span>
            <span class="data-value">${data.pallets}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Номер заказа:</span>
            <span class="data-value">${data.orderNumber}</span>
        </div>
        <div class="data-item">
            <span class="data-label">ЭТрН:</span>
            <span class="data-value">${data.etrn}</span>
        </div>
        <div class="data-item">
            <span class="data-label">Транзит:</span>
            <span class="data-value">${data.transit}</span>
        </div>
        <div class="data-item highlight">
            <span class="data-label">🚪 Ворота:</span>
            <span class="data-value">${data.gate}</span>
        </div>
    `;
}

// Отправка регистрации
async function submitRegistration() {
    showLoader(true);
    
    try {
        // Отправка данных в Google Sheets через Apps Script
        const response = await saveToGoogleSheets(registrationState.data);
        
        if (response.success) {
            // Показываем успешное сообщение
            showSuccessMessage(response.message);
            
            // Очищаем состояние
            resetRegistrationState();
            
            // Показываем успешный экран
            showStep(13);
            
            // Отправляем уведомление (если настроено)
            if (checkScheduleViolation()) {
                sendScheduleWarningNotification();
            }
        } else {
            showNotification('Ошибка при сохранении данных: ' + response.message, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

async function saveToGoogleSheets(data) {
    // Здесь будет запрос к Google Apps Script
    // Временная заглушка
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                message: 'Данные успешно сохранены'
            });
        }, 2000);
    });
}

// Шаг 13: Успешная регистрация
function showSuccessMessage() {
    const container = document.getElementById('success-message');
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
                <p>С большой вероятностью вас могут не принять на складе сегодня.</p>
                <p>Рекомендуем связаться с вашим поставщиком.</p>
            </div>
        `;
    }
    
    container.innerHTML = message;
}

// Уведомление о нарушении графика
function sendScheduleWarningNotification() {
    const data = registrationState.data;
    const productDesc = getProductDescription(data.productType);
    const schedule = ENTRY_SCHEDULE[data.productType];
    const endTime = schedule.end + ':' + (schedule.endMinutes === 0 ? '00' : schedule.endMinutes);
    
    const message = `
        ⚠️ *Уважаемый ${data.fio}!*
        
        📋 Вы зарегистрировались на доставку товара типа: *${data.productType}*
        ⏰ Время регистрации: ${data.time}
        
        🚨 *ВНИМАНИЕ!* Вы нарушаете график заезда!
        
        📅 *График заезда для ${productDesc}:*
        🕖 С ${schedule.start}:00 - до ${endTime}
        
        ❗️ *С большой вероятностью вас могут не принять на складе сегодня!*
        
        📍 *Для помощи и уточнения информации вы можете:*
        👉 Проследовать к окну выдачи/сдачи документов для уточнения
        📞 Свяжиться с вашим поставщиком
        
        💡 *Рекомендация:*
        В следующий раз планируйте прибытие согласно установленному графику
        
        🙏 Спасибо за понимание!
    `;
    
    // Здесь будет отправка в Telegram через Apps Script
    console.log('Уведомление о нарушении графика:', message);
}

function getProductDescription(productType) {
    const descriptions = {
        'Сухой': 'Сухой склад (Кондитерка, Бакалея, Хозтовары и т.п)',
        'ФРЕШ': 'Охлажденная продукция (мясо, куры, колбасы, сыры и т.п)',
        'ФРОВ': 'ФРОВ (фрукты, овощи)',
        'Акциз': 'АКЦИЗНЫЙ склад (крепкий алкоголь)'
    };
    
    return descriptions[productType] || productType;
}

// Сброс регистрации
function resetRegistration() {
    if (confirm('Вы уверены, что хотите начать регистрацию заново?')) {
        resetRegistrationState();
        showStep(1);
        clearFormFields();
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
    document.getElementById('phone-input').value = '';
    document.getElementById('fio-input').value = '';
    document.getElementById('supplier-input').value = '';
    document.getElementById('brand-input').value = '';
    document.getElementById('vehicle-number-input').value = '';
    document.getElementById('pallets-input').value = '';
    document.getElementById('order-input').value = '';
    document.getElementById('etrn-input').value = '';
}

// Утилиты
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    loader.style.display = show ? 'flex' : 'none';
}

// Оффлайн поддержка
window.addEventListener('online', () => {
    showNotification('Соединение восстановлено', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Нет соединения с интернетом', 'warning');
});

// Добавление на домашний экран
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const deferredPrompt = e;
    
    // Можно показать кнопку для установки
    setTimeout(() => {
        if (confirm('Хотите установить приложение для быстрого доступа?')) {
            deferredPrompt.prompt();
        }
    }, 3000);
});