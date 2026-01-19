// utils.js - Вспомогательные функции

// Нормализация номера телефона
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

// Форматирование номера телефона для отображения
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

// Форматирование даты
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Форматирование времени
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Комбинированное форматирование даты и времени
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

// Парсинг любой даты
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
                let minutesOnly = minutes;

                if (hasSeconds) {
                    // Если есть десятичная часть (секунды), берем только минуты
                    minutesOnly = minutes.split('.')[0];
                }

                return new Date(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                    parseInt(hours, 10),
                    parseInt(minutesOnly, 10),
                    0
                );
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
        console.error('Ошибка при разборе даты', { dateStr, error });
        return new Date(0);
    }
}

// Экранирование HTML
function escapeHTML(str) {
    if (!str) return '';
    try {
        return str.toString()
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
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
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;')
            .replace(/</g, '<')
            .replace(/>/g, '>');
    } catch (error) {
        console.error('Ошибка экранирования атрибута:', error);
        return '';
    }
}

// Проверка нарушения графика
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

// Назначение ворот автоматически
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

export {
    normalizePhone,
    formatPhoneDisplay,
    formatDate,
    formatTime,
    formatDateTime,
    parseAnyDate,
    escapeHTML,
    safeJSONParse,
    safeAttribute,
    checkScheduleViolation,
    assignGateAutomatically,
    logToConsole
};
