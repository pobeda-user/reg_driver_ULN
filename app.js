// Конфигурация для GitHub Pages
const CONFIG = {
    // Ваш Google Apps Script URL
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDATeBrTYOYUnP9JrjcUXuKHXbPWl75X-BTE-OFsREZLFB4I9qX-f4Ctu_MzKaGBko/exec',
    
    // Базовый URL приложения
    BASE_URL: 'https://pobeda-user.github.io/reg_driver_ULN/',
    
    // ID таблицы Google Sheets
    SPREADSHEET_ID: '1GcF4SDjUse7cDE2gsO50PLeTfjxaw_IAR6sZ-G1eBpA',
    
    // Настройки PWA
    PWA: {
        name: 'УЛН. Регистрация водителей',
        themeColor: '#4285f4',
        backgroundColor: '#4285f4'
    }
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Приложение инициализировано');
    loadRegistrationState();
    setupPhoneInput();
    checkConnection();
    
    // Показываем первый шаг
    showStep(1);
});

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
            console.log('Состояние восстановлено:', registrationState);
            
            // Восстанавливаем данные в полях
            if (registrationState.data.phone) {
                document.getElementById('phone-input').value = formatPhoneDisplay(registrationState.data.phone);
            }
            if (registrationState.data.fio) {
                document.getElementById('fio-input').value = registrationState.data.fio;
            }
            
            // Показываем текущий шаг
            showStep(registrationState.step);
        }
    } catch (error) {
        console.error('Ошибка загрузки состояния:', error);
        // Сбрасываем на начальный шаг при ошибке
        showStep(1);
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
        
        // Фокус на первом поле ввода если есть
        const input = stepElement.querySelector('input, button');
        if (input && input.type !== 'button') {
            setTimeout(() => input.focus(), 100);
        }
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
    
    // Enter для перехода
    phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handlePhoneSubmit();
        }
    });
}

function handlePhoneSubmit() {
    const phoneInput = document.getElementById('phone-input');
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
    
    // Проверка существующего водителя через Google Apps Script
    checkExistingDriver(phone)
        .then(existingDriver => {
            showLoader(false);
            
            if (existingDriver && existingDriver.exists) {
                // Водитель найден - используем его данные
                registrationState.data.fio = existingDriver.driver.fio;
                showNotification(`Добро пожаловать, ${existingDriver.driver.fio}!`, 'success');
                
                // Загружаем историю поставщиков
                loadSupplierHistory(phone);
                showStep(3); // Пропускаем ввод ФИО, сразу к поставщикам
            } else {
                // Новый водитель
                showStep(2); // Переход к вводу ФИО
            }
        })
        .catch(error => {
            showLoader(false);
            showNotification('Ошибка проверки данных. Попробуйте еще раз.', 'error');
            console.error('Ошибка проверки водителя:', error);
            // Продолжаем как новый водитель
            showStep(2);
        });
}

// Проверка существующего водителя через Google Apps Script
async function checkExistingDriver(phone) {
    try {
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
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Ошибка при проверке водителя:', error);
        throw error;
    }
}

// Шаг 2: Ввод ФИО
function handleFioSubmit() {
    const fioInput = document.getElementById('fio-input');
    const fio = fioInput.value.trim();
    
    if (!fio || fio.length < 5) {
        showNotification('Пожалуйста, введите полные ФИО (например: Иванов Иван Иванович)', 'error');
        fioInput.focus();
        return;
    }
    
    registrationState.data.fio = fio;
    
    // Загружаем историю поставщиков
    loadSupplierHistory(registrationState.data.phone);
    
    showStep(3); // Переход к выбору поставщика
}

// Шаг 3: Выбор поставщика
async function loadSupplierHistory(phone) {
    const container = document.getElementById('supplier-buttons');
    
    try {
        const response = await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_suppliers',
                phone: phone
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        container.innerHTML = '';
        
        if (data.suppliers && data.suppliers.length > 0) {
            data.suppliers.forEach((supplier, index) => {
                const button = document.createElement('button');
                button.className = 'option-btn';
                button.innerHTML = `
                    <span class="option-number">${index + 1}</span>
                    <span class="option-text">${supplier}</span>
                `;
                button.onclick = () => selectSupplier(supplier);
                container.appendChild(button);
            });
        } else {
            container.innerHTML = '<p class="no-history">История поставщиков не найдена</p>';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки поставщиков:', error);
        container.innerHTML = '<p class="error">Ошибка загрузки истории</p>';
    }
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
        brandInput.focus();
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
        showNotification('Пожалуйста, введите номер ТС (например: А123ВС777)', 'error');
        vehicleNumberInput.focus();
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
        showNotification('Пожалуйста, введите корректное количество поддонов (0 или больше)', 'error');
        palletsInput.focus();
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
        orderInput.focus();
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
        // Отправка данных в Google Sheets через Apps Script
        const response = await saveToGoogleSheets(registrationState.data);
        
        if (response.success) {
            // Показываем успешное сообщение
            showSuccessMessage(response.data);
            
            // Логируем успешную регистрацию
            await logEvent('REGISTRATION_SUCCESS', 
                `Зарегистрирован: ${registrationState.data.fio}, ${registrationState.data.phone}`);
            
            // Очищаем состояние
            resetRegistrationState();
            
            // Показываем успешный экран
            showStep(13);
            
            // Отправляем уведомление если есть нарушение графика
            if (registrationState.data.scheduleViolation === 'Да') {
                sendScheduleWarningNotification();
            }
        } else {
            showNotification('Ошибка при сохранении данных: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки регистрации:', error);
        showNotification('Ошибка соединения: ' + error.message, 'error');
        
        // Пробуем сохранить локально для оффлайн отправки
        saveRegistrationOffline();
    } finally {
        showLoader(false);
    }
}

// Сохранение в Google Sheets через Apps Script
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
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Ошибка сохранения в Google Sheets:', error);
        throw error;
    }
}

// Оффлайн сохранение
function saveRegistrationOffline() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        offlineRegistrations.push({
            data: registrationState.data,
            timestamp: new Date().toISOString(),
            attempts: 0
        });
        
        localStorage.setItem('offline_registrations', JSON.stringify(offlineRegistrations));
        
        showNotification('Данные сохранены локально. Будут отправлены при восстановлении связи.', 'warning');
        
        // Запускаем фоновую синхронизацию
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-data');
            });
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка оффлайн сохранения:', error);
        return false;
    }
}

// Синхронизация оффлайн данных
async function syncOfflineData() {
    try {
        const offlineRegistrations = JSON.parse(localStorage.getItem('offline_registrations') || '[]');
        
        if (offlineRegistrations.length === 0) return;
        
        const successful = [];
        
        for (const registration of offlineRegistrations) {
            try {
                const response = await saveToGoogleSheets(registration.data);
                
                if (response.success) {
                    successful.push(registration);
                    await logEvent('OFFLINE_SYNC_SUCCESS', 
                        `Синхронизировано: ${registration.data.fio}`);
                }
            } catch (error) {
                console.error('Ошибка синхронизации записи:', error);
            }
        }
        
        // Удаляем успешно синхронизированные записи
        if (successful.length > 0) {
            const remaining = offlineRegistrations.filter(r => 
                !successful.some(s => s.timestamp === r.timestamp));
            localStorage.setItem('offline_registrations', JSON.stringify(remaining));
            
            if (remaining.length === 0) {
                showNotification('Все оффлайн данные успешно синхронизированы', 'success');
            }
        }
        
    } catch (error) {
        console.error('Ошибка синхронизации оффлайн данных:', error);
    }
}

// Шаг 13: Успешная регистрация
function showSuccessMessage(data) {
    const container = document.getElementById('success-message');
    
    let message = `
        <div class="success-icon-large">✅</div>
        <h3>Добро пожаловать, ${registrationState.data.fio}!</h3>
        <p>Ваша регистрация прошла успешно!</p>
        
        <div class="success-details">
            <p><strong>Ваши ворота:</strong> ${registrationState.data.gate}</p>
            <p><strong>Статус:</strong> Зарегистрирован</p>
            <p><strong>Время регистрации:</strong> ${registrationState.data.date} ${registrationState.data.time}</p>
        </div>
        
        <div class="info-box">
            <p>📍 <strong>Пожалуйста, придерживайтесь схемы движения на распределительном центре.</strong></p>
            <p>🚛 <strong>Соблюдайте скоростной режим 5 км/ч</strong></p>
            <p>📋 <strong>Следуйте указаниям персонала</strong></p>
        </div>
    `;
    
    if (registrationState.data.scheduleViolation === 'Да') {
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
    
    const message = `⚠️ Уважаемый ${data.fio}!

📋 Вы зарегистрировались на доставку товара типа: ${data.productType}
⏰ Время регистрации: ${data.time}

🚨 ВНИМАНИЕ! Вы нарушаете график заезда!

📅 График заезда для ${productDesc}:
🕖 С ${schedule.start}:00 - до ${endTime}

❗️ С большой вероятностью вас могут не принять на складе сегодня!

📍 Для помощи и уточнения информации вы можете:
👉 Проследовать к окну выдачи/сдачи документов для уточнения
📞 Свяжиться с вашим поставщиком

💡 Рекомендация:
В следующий раз планируйте прибытие согласно установленному графику

🙏 Спасибо за понимание!`;
    
    // Логируем уведомление
    logEvent('SCHEDULE_WARNING', message);
    
    // Можно добавить отправку через Google Apps Script если нужно
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
    document.getElementById('phone-input').value = '';
    document.getElementById('fio-input').value = '';
    document.getElementById('supplier-input').value = '';
    document.getElementById('brand-input').value = '';
    document.getElementById('vehicle-number-input').value = '';
    document.getElementById('pallets-input').value = '';
    document.getElementById('order-input').value = '';
    document.getElementById('etrn-input').value = '';
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

// Логирование событий
async function logEvent(event, details) {
    try {
        await fetch(CONFIG.APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'log_event',
                event: event,
                details: details
            })
        });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

// Утилиты
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) {
        // Создаем временное уведомление если элемента нет
        const tempNotif = document.createElement('div');
        tempNotif.className = `notification ${type}`;
        tempNotif.textContent = message;
        tempNotif.style.cssText = `
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
        document.body.appendChild(tempNotif);
        
        setTimeout(() => {
            tempNotif.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => tempNotif.remove(), 300);
        }, 5000);
        return;
    }
    
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

// Проверка соединения
function checkConnection() {
    if (!navigator.onLine) {
        showNotification('Вы в оффлайн режиме. Данные будут сохранены локально.', 'warning');
        syncOfflineData(); // Пробуем синхронизировать старые данные
    }
}

// Обработчики онлайн/оффлайн
window.addEventListener('online', () => {
    showNotification('Соединение восстановлено. Синхронизируем данные...', 'success');
    syncOfflineData();
});

window.addEventListener('offline', () => {
    showNotification('Нет соединения с интернетом', 'warning');
});

// Добавление на домашний экран
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    
    setTimeout(() => {
        if (confirm('Хотите установить приложение для быстрого доступа?')) {
            e.prompt();
        }
    }, 3000);
});

// Проверка Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        console.log('Service Worker поддерживается');
    });
}

// Экспорт функций для HTML
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