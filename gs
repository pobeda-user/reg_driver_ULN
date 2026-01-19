// Google Apps Script для обработки данных с PWA - ПОЛНАЯ ВЕРСИЯ

const SHEET_ID = '1GcF4SDjUse7cDE2gsO50PLeTfjxaw_IAR6sZ-G1eBpA';
const SHEET_NAME = 'Регистрация водителей';
const LOG_SHEET_NAME = 'Логи PWA';
const CONFIG_SHEET_NAME = 'Конфигурация';

var supplierCache = {};


// ==================== CORS ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ====================
function setCORSHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}


function onEdit(e) {
  try {
    Logger.log('=== ЗАПУСК ONEDIT (PWA ВЕРСИЯ) ===');
    
    var range = e.range;
    var sheet = range.getSheet();
    var row = range.getRow();
    var col = range.getColumn();
    
    Logger.log('Лист: ' + sheet.getName() + ', строка: ' + row + ', колонка: ' + col);
    
    if (sheet.getName() !== SHEET_NAME || row === 1) return;
    
    // ФИКСИРОВАННЫЕ ИНДЕКСЫ
    var statusCol = 16; // Статус - колонка P
    var problemCol = 17; // Типы проблем - колонка Q  
    var gateCol = 15; // Ворота назначенные - колонка O
    
    Logger.log('Колонки - Статус: ' + statusCol + ', Проблемы: ' + problemCol + ', Ворота: ' + gateCol);
    Logger.log('Измененная колонка: ' + col);
    
    // Получаем ВСЕ данные строки
    var dataRange = sheet.getRange(row, 1, 1, sheet.getLastColumn());
    var data = dataRange.getValues()[0];
    
    // ФИКСИРОВАННЫЕ ИНДЕКСЫ данных:
    var chatId = data[17]; // Chat ID - колонка R (индекс 17)
    var fio = data[3];     // ФИО - колонка D (индекс 3)
    var assignedGate = data[14]; // Ворота назначенные - колонка O (индекс 14)
    var supplier = data[4]; // Поставщик - колонка E (индекс 4)
    var phone = data[2];    // Телефон - колонка C (индекс 2)
    var productType = data[6]; // Тип товара - колонка G (индекс 6)
    var currentStatus = data[15]; // Статус - колонка P (индекс 15)
    var problemType = data[16]; // Тип проблемы - колонка Q (индекс 16)
    var transit = data[12]; // Транзит - колонка M (индекс 12)
    var legalEntity = data[5]; // Юр.Лицо - колонка F (индекс 5)
    var vehicleNumber = data[8]; // Номер ТС - колонка I (индекс 8)
    var orderNumber = data[10]; // Номер заказа - колонка K (индекс 10)
    
    Logger.log('Данные строки:');
    Logger.log('- ФИО: ' + fio);
    Logger.log('- Телефон: ' + phone);
    Logger.log('- Ворота: ' + assignedGate);
    Logger.log('- Поставщик: ' + supplier);
    Logger.log('- Тип товара: ' + productType);
    Logger.log('- Юр.Лицо: ' + legalEntity);
    Logger.log('- Текущий статус: ' + currentStatus);
    Logger.log('- Тип проблемы: ' + problemType);
    
    // Если изменился статус
    if (col === statusCol) {
      var newStatus = range.getValue();
      var oldStatus = e.oldValue || '';
      
      Logger.log('Изменение статуса: ' + oldStatus + ' → ' + newStatus);
      
      // Логируем изменение статуса
      logStatusChange(row, oldStatus, newStatus, supplier, assignedGate, fio, phone, problemType);
      
      var notificationType = '';
      var notificationTitle = '';
      var notificationMessage = '';
      
      switch (newStatus) {
        case 'Назначены ворота':
          Logger.log('=== ОБРАБОТКА НАЗНАЧЕНИЯ ВОРОТ ===');
          
          if (assignedGate && assignedGate !== '' && assignedGate !== 'Не найден') {
            
            notificationType = 'gate_assigned';
            notificationTitle = '🚪 Назначены ворота';
            notificationMessage = '✅ Уважаемый ' + fio + ', вам назначены ворота №' + assignedGate;
            
            // Дополнительная информация для PWA
            var pwaDetails = '📍 Если ворота свободны - можете занимать, если заняты - ожидайте.\n\n' +
                           '⚠️ ВАЖНАЯ ИНФОРМАЦИЯ:\n' +
                           '• При постановке ТС на разгрузку необходимо поставить противооткатный башмак\n' +
                           '• Установите башмак под заднюю ось колёс, со стороны водительского места\n' +
                           '• Отгрузка начинается только после установки противооткатного башмака';
            
          } else {
            Logger.log('❌ Ворота не назначены или пустые');
          }
          break;
          
        case 'Документы готовы к выдаче':
          Logger.log('Статус изменен на "Документы готовы к выдаче"');
          notificationType = 'documents_ready';
          notificationTitle = '📄 Документы готовы';
          notificationMessage = '☑️ Уважаемый ' + fio + ', документы готовы к выдаче!';
          break;
          
        case 'Отказ в приемке':
          Logger.log('Статус изменен на "Отказ в приемке"');
          notificationType = 'rejection_initial';
          notificationTitle = '❌ Отказ в приемке';
          notificationMessage = 'Уважаемый ' + (fio || 'водитель') + ', приносим сожаления, но вам было принято "Отказать в приемке"';
          break;
          
        case 'Нет в графике':
          Logger.log('Статус изменен на "Нет в графике"');
          notificationType = 'out_of_schedule';
          notificationTitle = '⏰ Вне графика';
          notificationMessage = 'Уважаемый ' + (fio || 'водитель') + ', к сожалению вынуждены отказать вам в приемке, в связи с тем что вы приехали "Вне графика"';
          break;
          
        case 'Проблема с товаром':
        case 'Проблема с документами':
          Logger.log('Статус изменен на проблему: ' + newStatus);
          notificationType = 'problem_initial';
          notificationTitle = '⚠️ ' + newStatus;
          notificationMessage = 'Уважаемый ' + (fio || 'водитель') + ', возникла проблема: ' + newStatus;
          break;
          
        default:
          Logger.log('Статус изменен на неизвестный: ' + newStatus);
          // Для всех остальных смен статусов
          if (oldStatus && newStatus && oldStatus !== 'Зарегистрирован') {
            notificationType = 'status_change';
            notificationTitle = '📋 Изменение статуса';
            notificationMessage = 'Изменение статуса: ' + oldStatus + ' → ' + newStatus;
          }
          break;
      }
      
      // Отправляем уведомление в PWA если есть телефон
      if (notificationType && phone && fio) {
        sendPWAStatusNotification(phone, fio, notificationType, notificationTitle, 
                                 notificationMessage, row, assignedGate, supplier, 
                                 productType, newStatus, oldStatus, problemType);
      }
    }
    
    // Если изменился тип проблемы
    if (col === problemCol) {
      Logger.log('Изменен тип проблемы');
      var newProblemType = range.getValue();
      var status = currentStatus;
      
      // НЕ отправляем сообщения о проблемах для статуса "Нет в графике"
      if (status === 'Нет в графике') {
        Logger.log('Статус "Нет в графике" - игнорируем изменение типа проблемы');
        return;
      }
      
      if (newProblemType && phone && fio) {
        // Логируем изменение типа проблемы
        logStatusChange(row, status, status + ' (уточнено)', supplier, assignedGate, fio, phone, newProblemType);
        
        var notificationType = '';
        var notificationTitle = '';
        var notificationMessage = '';
        
        if (status === 'Отказ в приемке') {
          // Финальное сообщение об отказе
          notificationType = 'rejection_detail';
          notificationTitle = '❌ Отказ в приемке (детали)';
          notificationMessage = generateDetailedRefusalMessage(fio, newProblemType);
          
        } else if (status === 'Проблема с товаром' || status === 'Проблема с документами') {
          notificationType = 'problem_detail';
          notificationTitle = '⚠️ ' + status;
          notificationMessage = generateDetailedProblemMessage(fio, status, newProblemType);
        }
        
        // Отправляем уведомление в PWA
        if (notificationType) {
          sendPWAStatusNotification(phone, fio, notificationType, notificationTitle, 
                                   notificationMessage, row, assignedGate, supplier, 
                                   productType, status, '', newProblemType);
        }
      }
    }
    
    // Если изменились ворота - НЕ отправляем сообщение сразу
    if (col === gateCol) {
      Logger.log('Изменены ворота - сообщение не отправляется, ждем смены статуса');
      // Просто логируем изменение ворот
      logStatusChange(row, currentStatus, currentStatus + ' (ворота изменены)', supplier, assignedGate, fio, phone, problemType);
    }
    
    Logger.log('=== ЗАВЕРШЕНИЕ ONEDIT ===');
    
  } catch (error) {
    Logger.log('❌ Ошибка в onEdit: ' + error.toString());
    Logger.log('Стек ошибки: ' + error.stack);
  }
}

// ==================== ФУНКЦИЯ ОТПРАВКИ УВЕДОМЛЕНИЙ В PWA ====================
function sendPWAStatusNotification(phone, fio, type, title, message, row, gate, supplier, 
                                   productType, status, oldStatus, problemType) {
  try {
    Logger.log('Отправка PWA уведомления для ' + fio + ' (' + phone + ')');
    
    // Создаем объект уведомления
    const pwaNotification = {
      phone: normalizePhone(phone),
      fio: fio,
      type: type,
      title: title,
      message: message,
      data: {
        rowNumber: row,
        driverName: fio,
        supplier: supplier,
        gate: gate,
        productType: productType,
        status: status,
        oldStatus: oldStatus,
        problemType: problemType || '',
        notificationType: type,
        timestamp: getFormattedDateTime(), // Используем правильный формат
        date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy'),
        time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm')
      },
      registrationId: `reg_${row}_${Date.now()}`,
      rowNumber: row,
      action: 'show_notification'
    };
    
    Logger.log('PWA уведомление создано:', JSON.stringify(pwaNotification));
    
    // Сохраняем уведомление в таблицу для PWA
    savePWANotification(pwaNotification);
    
    return {
      success: true,
      notificationId: pwaNotification.registrationId,
      timestamp: getFormattedDateTime()
    };
    
  } catch (error) {
    Logger.log('❌ Ошибка отправки PWA уведомления:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

function savePWANotification(notification) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let pwaSheet = spreadsheet.getSheetByName('PWA_Notifications');
    
    // Создаем лист если его нет
    if (!pwaSheet) {
      pwaSheet = spreadsheet.insertSheet('PWA_Notifications');
      const headers = ['Timestamp', 'Phone', 'FIO', 'Type', 'Title', 'Message', 
                       'Data', 'Status', 'SentAt', 'ReadAt', 'RowNumber'];
      pwaSheet.getRange('A1:K1').setValues([headers]).setFontWeight('bold');
    }
    
    const now = new Date();
    const timeZone = Session.getScriptTimeZone();
    
    // ИСПРАВЛЕНИЕ: Используем правильный формат дд.мм.гггг чч:мм
    const timestamp = Utilities.formatDate(now, timeZone, 'dd.MM.yyyy HH:mm');
    
    // Форматируем дату и время для data
    const date = Utilities.formatDate(now, timeZone, 'dd.MM.yyyy');
    const time = Utilities.formatDate(now, timeZone, 'HH:mm');
    
    // Нормализуем телефон
    const normalizedPhone = normalizePhone(notification.phone || '');
    
    // Обновляем data с правильным форматом дат
    if (notification.data) {
      notification.data.timestamp = timestamp;
      notification.data.date = date;
      notification.data.time = time;
    }
    
    const rowData = [
      timestamp, // Формат: "дд.мм.гггг чч:мм"
      normalizedPhone,
      notification.fio || '',
      notification.type || '',
      notification.title || '',
      notification.message || '',
      JSON.stringify(notification.data || {}),
      'pending', // pending, sent, read
      '', // время отправки (заполнится при получении)
      '', // время прочтения
      notification.rowNumber || 0
    ];
    
    pwaSheet.appendRow(rowData);
    
    // Ограничиваем таблицу 1000 записями
    if (pwaSheet.getLastRow() > 1000) {
      pwaSheet.deleteRow(2);
    }
    
    Logger.log('✅ Уведомление сохранено для PWA в строку:', pwaSheet.getLastRow());
    Logger.log('Телефон:', normalizedPhone);
    Logger.log('Дата:', timestamp);
    
    return {
      success: true,
      rowNumber: pwaSheet.getLastRow(),
      timestamp: timestamp,
      phone: normalizedPhone
    };
    
  } catch (error) {
    Logger.log('❌ Ошибка сохранения PWA уведомления:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СООБЩЕНИЙ ====================
function generateDetailedRefusalMessage(fio, problemType) {
  var message = '❌ Уважаемый ' + fio + ', к сожалению вынуждены отказать вам в приемке.\n\n';
  
  switch (problemType) {
    case 'Несоответствие товара заказу':
      message += '📦 <b>Причина отказа:</b> Несоответствие товара заказу\n';
      message += '🔄 <b>Что делать:</b> Свяжитесь с поставщиком для уточнения деталей заказа\n';
      break;
    case 'Просроченный товар':
      message += '📅 <b>Причина отказа:</b> Просроченный товар\n';
      message += '🔄 <b>Что делать:</b> Товар должен быть утилизирован, обратитесь к поставщику\n';
      break;
    case 'Отсутствие маркировки':
      message += '🏷️ <b>Причина отказа:</b> Отсутствие маркировки\n';
      message += '🔄 <b>Что делать:</b> Необходима правильная маркировка товара\n';
      break;
    default:
      message += '📋 <b>Причина отказа:</b> ' + problemType + '\n';
      message += '🔄 <b>Что делать:</b> Обратитесь к диспетчеру для уточнения деталей\n';
  }
  
  message += '\n📞 <b>Для решения проблемы:</b> Свяжитесь с вашим поставщиком';
  
  return message;
}

function generateDetailedProblemMessage(fio, status, problemType) {
  var message = '⚠️ Уважаемый ' + fio + ', ' + status + '\n\n';
  
  if (status === 'Проблема с документами') {
    switch (problemType) {
      case 'Отсутствует накладная':
        message += '📄 <b>Проблема:</b> Отсутствует товарно-транспортная накладная\n';
        message += '✅ <b>Решение:</b> Предоставить оригинал ТТН';
        break;
      case 'Ошибка в накладной':
        message += '✏️ <b>Проблема:</b> Ошибка в товарно-транспортной накладной\n';
        message += '✅ <b>Решение:</b> Исправить ошибку или предоставить корректировочную накладную';
        break;
      default:
        message += '📋 <b>Проблема:</b> ' + problemType + '\n';
        message += '✅ <b>Решение:</b> Обратитесь к диспетчеру';
    }
  } else if (status === 'Проблема с товаром') {
    switch (problemType) {
      case 'Поврежденная упаковка':
        message += '📦 <b>Проблема:</b> Поврежденная упаковка товара\n';
        message += '✅ <b>Решение:</b> Ожидайте приемки с учетом повреждений';
        break;
      case 'Несоответствие количества':
        message += '🔢 <b>Проблема:</b> Несоответствие количества товара\n';
        message += '✅ <b>Решение:</b> Ожидайте пересчета или корректировки документов';
        break;
      default:
        message += '📋 <b>Проблема:</b> ' + problemType + '\n';
        message += '✅ <b>Решение:</b> Ожидайте решения диспетчера';
    }
  }
  
  message += '\n\n⏳ <b>Статус:</b> Ожидайте решения проблемы';
  
  return message;
}

// ==================== ФУНКЦИЯ ДЛЯ PWA ДЛЯ ПОЛУЧЕНИЯ УВЕДОМЛЕНИЙ ====================
function handleGetPWANotifications(phone, lastUpdate = null) {
  try {
    Logger.log('Получение PWA уведомлений для телефона:', phone);
    
    if (!phone) {
      return {
        success: false,
        message: 'Телефон не указан'
      };
    }
    
    const cleanPhone = normalizePhone(phone);
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let pwaSheet = spreadsheet.getSheetByName('PWA_Notifications');
    
    if (!pwaSheet || pwaSheet.getLastRow() <= 1) {
      return {
        success: true,
        notifications: [],
        count: 0
      };
    }
    
    const lastRow = pwaSheet.getLastRow();
    const data = pwaSheet.getDataRange().getValues();
    const notifications = [];
    
    // Пропускаем заголовок
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowPhone = row[1] ? normalizePhone(row[1].toString()) : '';
      const timestamp = row[0]; // Уже в формате "дд.мм.гггг чч:мм"
      const status = row[7];
      
      // Проверяем телефон и статус
      if (rowPhone === cleanPhone && status === 'pending') {
        
        try {
          const notification = {
            id: `notification_${i}`,
            phone: cleanPhone,
            fio: row[2] || '',
            type: row[3] || '',
            title: row[4] || '',
            message: row[5] || '',
            data: JSON.parse(row[6] || '{}'),
            timestamp: timestamp, // Уже в правильном формате
            rowNumber: i + 1,
            status: status
          };
          
          // Проверяем по времени если указан lastUpdate
          if (!lastUpdate || shouldIncludeNotification(timestamp, lastUpdate)) {
            notifications.push(notification);
            
            // Помечаем как отправленное
            pwaSheet.getRange(i + 1, 8).setValue('sent');
            pwaSheet.getRange(i + 1, 9).setValue(getFormattedDateTime());
          }
          
        } catch (parseError) {
          Logger.log('Ошибка парсинга данных уведомления:', parseError);
        }
      }
    }
    
    Logger.log('Найдено уведомлений для PWA:', notifications.length);
    
    return {
      success: true,
      notifications: notifications.sort((a, b) => {
        // Сортируем по дате (новые сначала)
        return compareDates(b.timestamp, a.timestamp);
      }),
      count: notifications.length,
      lastUpdate: getFormattedDateTime(),
      driverPhone: cleanPhone
    };
    
  } catch (error) {
    Logger.log('Ошибка получения PWA уведомлений:', error.toString());
    return {
      success: false,
      error: error.toString(),
      notifications: []
    };
  }
}

// Проверка нужно ли включать уведомление
function shouldIncludeNotification(timestamp, lastUpdate) {
  try {
    const notificationDate = parseCustomDate(timestamp);
    const lastUpdateDate = parseCustomDate(lastUpdate);
    return notificationDate > lastUpdateDate;
  } catch (e) {
    return true; // В случае ошибки включаем все
  }
}

// Парсинг даты из формата "дд.мм.гггг чч:мм"
function parseCustomDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(0);
  
  try {
    // Формат: "дд.мм.гггг чч:мм"
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return new Date(0);
    
    const [day, month, year] = datePart.split('.');
    const [hours, minutes] = timePart.split(':');
    
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      0
    );
  } catch (e) {
    Logger.log('Ошибка парсинга даты:', e.toString());
    return new Date(0);
  }
}

function compareDates(dateStr1, dateStr2) {
  const date1 = parseCustomDate(dateStr1);
  const date2 = parseCustomDate(dateStr2);
  return date1 - date2;
}

// Функция для получения даты в правильном формате
function getFormattedDateTime() {
  const now = new Date();
  const timeZone = Session.getScriptTimeZone();
  const date = Utilities.formatDate(now, timeZone, 'dd.MM.yyyy');
  const time = Utilities.formatDate(now, timeZone, 'HH:mm');
  return date + ' ' + time; // "дд.мм.гггг чч:мм"
}

// ==================== ОЧИСТКА СТАРЫХ УВЕДОМЛЕНИЙ ====================
function cleanupOldPWANotifications() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const pwaSheet = spreadsheet.getSheetByName('PWA_Notifications');
    
    if (!pwaSheet || pwaSheet.getLastRow() <= 1) return;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const data = pwaSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // Начинаем с 1 (пропускаем заголовок)
    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][0];
      const sentAt = data[i][8];
      
      // Удаляем уведомления старше 7 дней
      if (timestamp && new Date(timestamp) < sevenDaysAgo) {
        rowsToDelete.push(i + 1); // +1 потому что индекс строки в Sheets начинается с 1
      }
    }
    
    // Удаляем строки в обратном порядке
    rowsToDelete.reverse().forEach(rowIndex => {
      pwaSheet.deleteRow(rowIndex);
    });
    
    Logger.log('Очищено старых PWA уведомлений:', rowsToDelete.length);
    
    return {
      success: true,
      cleaned: rowsToDelete.length
    };
    
  } catch (error) {
    Logger.log('Ошибка очистки PWA уведомлений:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ОТПРАВКА УВЕДОМЛЕНИЙ В PWA ====================
function sendNotificationToPWA(notificationData) {
  try {
    Logger.log('Отправка уведомления в PWA:', JSON.stringify(notificationData, null, 2));
    
    // Здесь можно реализовать отправку push-уведомлений через:
    // 1. Firebase Cloud Messaging (FCM)
    // 2. Web Push API
    // 3. Сохранение в базу данных для последующего получения
    
    // Пример простого сохранения в лист для PWA
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let pwaLogSheet = spreadsheet.getSheetByName('PWA_Notifications');
    
    if (!pwaLogSheet) {
      pwaLogSheet = spreadsheet.insertSheet('PWA_Notifications');
      const headers = ['Timestamp', 'Phone', 'Type', 'Title', 'Message', 'Data', 'Status', 'SentAt'];
      pwaLogSheet.getRange('A1:H1').setValues([headers]).setFontWeight('bold');
    }
    
    const now = new Date();
    const rowData = [
      new Date().toISOString(),
      notificationData.phone,
      notificationData.type,
      notificationData.title,
      notificationData.message,
      JSON.stringify(notificationData.data || {}),
      'pending', // pending, sent, read
      '' // время отправки
    ];
    
    pwaLogSheet.appendRow(rowData);
    
    return {
      success: true,
      notificationId: `pwa_${Date.now()}`,
      timestamp: now.toISOString(),
      storedInRow: pwaLogSheet.getLastRow()
    };
    
  } catch (error) {
    Logger.log('Ошибка отправки уведомления в PWA:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ПОЛУЧЕНИЕ УВЕДОМЛЕНИЙ ДЛЯ PWA ====================
function handleGetPWAUpdates(phone, lastUpdate = null) {
  try {
    if (!phone) {
      return {
        success: false,
        message: 'Телефон не указан'
      };
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let pwaLogSheet = spreadsheet.getSheetByName('PWA_Notifications');
    
    if (!pwaLogSheet || pwaLogSheet.getLastRow() <= 1) {
      return {
        success: true,
        updates: [],
        lastUpdate: null
      };
    }
    
    const cleanPhone = normalizePhone(phone);
    const lastRow = pwaLogSheet.getLastRow();
    
    // Получаем все уведомления для этого телефона
    const data = pwaLogSheet.getDataRange().getValues();
    const updates = [];
    
    // Пропускаем заголовок
    for (let i = 1; i < data.length; i++) {
      const rowPhone = data[i][1] ? data[i][1].toString() : '';
      const timestamp = data[i][0];
      const type = data[i][2];
      const title = data[i][3];
      const message = data[i][4];
      const rowData = data[i][5];
      const status = data[i][6];
      
      if (normalizePhone(rowPhone) === cleanPhone && 
          status === 'pending' && 
          (!lastUpdate || new Date(timestamp) > new Date(lastUpdate))) {
        
        try {
          const parsedData = JSON.parse(rowData || '{}');
          
          updates.push({
            id: `notification_${i}`,
            phone: cleanPhone,
            type: type,
            title: title,
            message: message,
            data: parsedData,
            timestamp: timestamp,
            rowNumber: i + 1,
            notificationType: type
          });
          
          // Помечаем как отправленное
          pwaLogSheet.getRange(i + 1, 7).setValue('sent');
          pwaLogSheet.getRange(i + 1, 8).setValue(new Date().toISOString());
          
        } catch (parseError) {
          Logger.log('Ошибка парсинга данных уведомления:', parseError);
        }
      }
    }
    
    // Также проверяем обновления статусов в основной таблице
    const mainUpdates = handleGetStatusUpdates(phone, lastUpdate);
    if (mainUpdates.success && mainUpdates.updates && mainUpdates.updates.length > 0) {
      updates.push(...mainUpdates.updates.map(update => ({
        ...update,
        type: 'status_update',
        notificationType: 'status_update'
      })));
    }
    
    return {
      success: true,
      updates: updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      count: updates.length,
      lastUpdate: updates.length > 0 ? updates[0].timestamp : lastUpdate
    };
    
  } catch (error) {
    Logger.log('Ошибка получения обновлений для PWA:', error.toString());
    return {
      success: false,
      error: error.toString(),
      updates: []
    };
  }
}


// ==================== ПОЛУЧЕНИЕ ТОП ДАННЫХ ДЛЯ PWA (ТОЛЬКО ПОСТАВЩИКИ) ====================
function handleGetTopData() {
  try {
    const startTime = new Date();
    
    // Проверяем кэш (храним 5 минут)
    const cacheKey = 'top_data_cache_v4';
    const cacheTimeKey = 'top_data_cache_time_v4';
    const cacheTime = PropertiesService.getScriptProperties().getProperty(cacheTimeKey);
    const cachedData = PropertiesService.getScriptProperties().getProperty(cacheKey);
    
    const now = Date.now();
    if (cachedData && cacheTime && (now - parseInt(cacheTime)) < 5 * 60 * 1000) {
      const elapsed = new Date() - startTime;
      logToSheet('INFO', 'ТОП данные из кэша v4', `Время: ${elapsed}мс`);
      
      const result = JSON.parse(cachedData);
      result.fromCache = true;
      result.cacheAge = Math.round((now - parseInt(cacheTime)) / 1000);
      return result;
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    
    if (!topSheet || topSheet.getLastRow() <= 1) {
      // Если ТОП листа нет, создаем его
      const updateResult = updateTopData();
      
      if (!updateResult.success) {
        return {
          success: true,
          suppliers: [],
          phoneSuppliers: {},
          meta: {
            message: 'ТОП данные создаются, попробуйте позже'
          }
        };
      }
      
      Utilities.sleep(3000);
      return handleGetTopData();
    }
    
    // Читаем данные из ТОП листа
    const dataRange = topSheet.getDataRange();
    const data = dataRange.getValues();
    
    let suppliers = [];
    let phoneSuppliers = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const supplier = row[0] ? row[0].toString().trim() : '';
      const phone = row[1] ? row[1].toString().trim() : '';
      const suppliersStr = row[2] ? row[2].toString().trim() : '';
      
      if (supplier && supplier !== '' && !supplier.includes('===') && !supplier.includes('МЕТА')) {
        suppliers.push(supplier);
      }
      
      if (phone && suppliersStr && !phone.includes('ТЕЛЕФОН') && !phone.includes('===') && !phone.includes('МЕТА')) {
        const supplierList = suppliersStr.split('|').filter(s => s.trim() !== '');
        phoneSuppliers[phone] = supplierList;
      }
    }
    
    suppliers = [...new Set(suppliers)].sort();
    
    const result = {
      success: true,
      suppliers: suppliers,
      phoneSuppliers: phoneSuppliers,
      meta: {
        totalSuppliers: suppliers.length,
        totalPhones: Object.keys(phoneSuppliers).length,
        timestamp: new Date().toISOString(),
        cache: false,
        updateType: 'full'
      }
    };
    
    // Кэшируем результат
    try {
      PropertiesService.getScriptProperties().setProperties({
        [cacheKey]: JSON.stringify(result),
        [cacheTimeKey]: now.toString()
      });
    } catch (e) {
      logToSheet('WARN', 'Не удалось сохранить в кэш', e.toString());
    }
    
    const elapsed = new Date() - startTime;
    logToSheet('INFO', 'ТОП данные отправлены v4', 
      `Поставщиков: ${suppliers.length}, Телефонов: ${Object.keys(phoneSuppliers).length}, Время: ${elapsed}мс`);
    
    return result;
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка получения ТОП данных v4', error.toString());
    return {
      success: false,
      error: error.toString(),
      suppliers: [],
      phoneSuppliers: {}
    };
  }
}


// Функция нормализации названия поставщика
function normalizeSupplierName(supplier) {
  if (!supplier || typeof supplier !== 'string') {
    return '';
  }
  
  let normalized = supplier.trim();
  
  // Убираем юридические формы и кавычки
  normalized = normalized
    .replace(/^(ООО|ИП|АО|ЗАО|ПАО|НКО|LLC|LTD|INC|CORP)\s*['"]?/i, '')
    .replace(/['"]$/i, '')
    .trim();
  
  // Приводим к нижнему регистру
  normalized = normalized.toLowerCase();
  
  // Убираем лишние пробелы
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// ==================== ПОИСК ПОСТАВЩИКОВ (ИСПРАВЛЕННАЯ) ====================
function handleGetSuppliersOptimized(phone) {
  try {
    const startTime = new Date();
    
    if (!phone) {
      return { 
        success: true, 
        suppliers: [],
        message: 'Телефон не указан'
      };
    }
    
    const cleanPhone = normalizePhone(phone);
    const last7Digits = cleanPhone.slice(-7);
    
    // Получаем ТОП данные
    const topData = handleGetTopData();
    
    if (!topData.success) {
      logToSheet('ERROR', 'Не удалось получить ТОП данные', '');
      return { 
        success: true, 
        suppliers: [],
        message: 'Ошибка загрузки данных'
      };
    }
    
    // Ищем в phoneSuppliers
    let suppliers = [];
    
    // 1. Прямой поиск по полному номеру
    if (topData.phoneSuppliers && topData.phoneSuppliers[cleanPhone]) {
      suppliers = topData.phoneSuppliers[cleanPhone];
    }
    
    // 2. Поиск по последним 7 цифрам
    if (suppliers.length === 0 && topData.phoneSuppliers) {
      Object.keys(topData.phoneSuppliers).forEach(storedPhone => {
        if (storedPhone.slice(-7) === last7Digits) {
          suppliers = suppliers.concat(topData.phoneSuppliers[storedPhone]);
        }
      });
    }
    
    // Убираем дубликаты
    const uniqueSuppliers = [...new Set(suppliers)];
    
    const elapsed = new Date() - startTime;
    
    logToSheet('INFO', 'Поиск поставщиков', 
      `Телефон: ${phone}, Найдено: ${uniqueSuppliers.length}, Время: ${elapsed}мс`);
    
    return {
      success: true,
      suppliers: uniqueSuppliers,
      count: uniqueSuppliers.length,
      message: uniqueSuppliers.length > 0 ? 
        `Найдено ${uniqueSuppliers.length} поставщиков` : 
        'Поставщики не найдены',
      searchMethod: 'TOP_DATA',
      searchTime: elapsed
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка поиска поставщиков', error.toString());
    return { 
      success: true, 
      suppliers: [],
      message: 'Ошибка при поиске поставщиков'
    };
  }
}

// Функция для очистки дубликатов с нормализацией (можно запустить один раз)
function cleanupSupplierDuplicates() {
  try {
    console.log('=== ОЧИСТКА ДУБЛИКАТОВ ПОСТАВЩИКОВ ===\n');
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet || mainSheet.getLastRow() <= 1) {
      console.log('❌ Таблица пуста');
      return { success: false, message: 'Таблица пуста' };
    }
    
    const lastRow = mainSheet.getLastRow();
    const dataRange = mainSheet.getRange(2, 5, lastRow - 1, 1); // Столбец E (Поставщики)
    const data = dataRange.getValues();
    
    let changes = 0;
    const corrections = new Map();
    
    // Собираем статистику с нормализацией
    for (let i = 0; i < data.length; i++) {
      const supplier = data[i][0] ? data[i][0].toString().trim() : '';
      if (supplier && supplier !== '') {
        const normalized = normalizeSupplierName(supplier);
        
        if (normalized === '') continue;
        
        if (!corrections.has(normalized)) {
          // Сохраняем первый вариант с юридической формой, если есть
          corrections.set(normalized, supplier);
        } else {
          // Сравниваем с существующим
          const existing = corrections.get(normalized);
          // Предпочитаем вариант с юридической формой
          if ((supplier.includes('ООО') || supplier.includes('ИП') || 
               supplier.includes('АО') || supplier.includes('ЗАО')) &&
              !(existing.includes('ООО') || existing.includes('ИП') || 
                existing.includes('АО') || existing.includes('ЗАО'))) {
            corrections.set(normalized, supplier);
          }
        }
      }
    }
    
    // Применяем исправления
    console.log(`\nНайдено ${corrections.size} уникальных поставщиков после нормализации`);
    
    for (let i = 0; i < data.length; i++) {
      const supplier = data[i][0] ? data[i][0].toString().trim() : '';
      if (supplier && supplier !== '') {
        const normalized = normalizeSupplierName(supplier);
        const correctSupplier = corrections.get(normalized);
        
        if (correctSupplier && supplier !== correctSupplier) {
          // Исправляем в таблице
          mainSheet.getRange(i + 2, 5).setValue(correctSupplier);
          changes++;
          
          if (changes <= 10) { // Логируем только первые 10 изменений
            console.log(`  "${supplier}" → "${correctSupplier}"`);
          }
        }
      }
    }
    
    console.log(`\nИсправлено записей: ${changes}`);
    
    if (changes > 0) {
      // Обновляем ТОП данные
      console.log('\nОбновляю ТОП данные...');
      updateTopData();
    }
    
    return {
      success: true,
      changes: changes,
      uniqueSuppliers: corrections.size,
      message: changes > 0 ? `Исправлено ${changes} записей` : 'Изменений не требуется'
    };
    
  } catch (error) {
    console.log('❌ Ошибка очистки дубликатов:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}


// ==================== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ МАРОК (ФИКСИРОВАННЫЙ СПИСОК) ====================
function handleGetPopularBrandsOptimized() {
  try {
    // Фиксированный список марок (из вашего сообщения)
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
    
    // Убираем дубликаты
    const uniqueBrands = [...new Set(fixedBrands)];
    
    return { 
      success: true, 
      brands: uniqueBrands,
      count: uniqueBrands.length,
      message: `Загружено ${uniqueBrands.length} популярных марок`,
      fixedList: true
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка получения марок', error.toString());
    return { 
      success: true, 
      brands: ['Газель', 'DAF', 'KAMAZ', 'MAN', 'Мерседес', 'VOLVO'],
      message: 'Используется стандартный список марок',
      fixedList: true
    };
  }
}

// Дополнительная функция для улучшения пользовательского опыта
function setupBrandSelection() {
  const container = document.getElementById('brand-buttons');
  if (!container) return;
  
  // Добавляем обработчики для кнопок марок
  container.addEventListener('click', function(e) {
    const btn = e.target.closest('.compact-brand-btn');
    if (btn) {
      // Снимаем выделение со всех кнопок
      container.querySelectorAll('.compact-brand-btn').forEach(b => {
        b.classList.remove('selected');
      });
      
      // Выделяем выбранную кнопку
      btn.classList.add('selected');
    }
  });
}

// Обновите старую функцию для совместимости
function handleGetPopularBrands() {
  return handleGetPopularBrandsOptimized(); // Просто вызываем новую функцию
}

// ==================== ПОЛНОЕ ОБНОВЛЕНИЕ ТОП ДАННЫХ (ИСПРАВЛЕННОЕ) ====================
function updateTopData() {
  try {
    const startTime = new Date();
    logToSheet('INFO', 'ПОЛНОЕ обновление ТОП данных', 'Начало');
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet || mainSheet.getLastRow() <= 1) {
      logToSheet('INFO', 'Нет данных для обновления ТОП', 'Таблица пуста');
      return {
        success: true,
        message: 'Нет данных для обновления',
        suppliers: 0
      };
    }
    
    const lastRow = mainSheet.getLastRow();
    
    // Получаем ВСЕ данные из основного листа
    const dataRange = mainSheet.getRange(2, 1, lastRow - 1, 19);
    const data = dataRange.getValues();
    
    // Обрабатываем все строки
    const result = processDataForTopSheet(data, lastRow - 1);
    
    // Создаем или находим лист ТОП_ДАННЫЕ
    let topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    if (!topSheet) {
      topSheet = spreadsheet.insertSheet('ТОП_ДАННЫЕ');
    }
    
    // Записываем обновленные данные
    writeTopSheetDataSafe(topSheet, result.suppliersArray, result.phoneSuppliersArray);
    
    const elapsed = new Date() - startTime;
    
    // Сохраняем метаданные
    const metaRow = Math.max(result.suppliersArray.length, result.phoneSuppliersArray.length) + 3;
    writeMetaData(topSheet, metaRow, lastRow - 1, result.suppliersArray.length, 
                  result.phoneSuppliersArray.length, elapsed, 'FULL');
    
    // ВАЖНО: При полном обновлении сбрасываем счетчик на текущую строку
    PropertiesService.getScriptProperties().setProperty(
      'TOP_DATA_LAST_PROCESSED_ROW', 
      lastRow.toString()
    );
    
    logToSheet('SUCCESS', 'ПОЛНОЕ обновление ТОП данных завершено', 
      `Поставщиков: ${result.suppliersArray.length}, ` +
      `Телефонов: ${result.phoneSuppliersArray.length}, ` +
      `Время: ${elapsed}мс, ` +
      `Строк обработано: ${lastRow - 1}`);
    
    return {
      success: true,
      suppliers: result.suppliersArray.length,
      phones: result.phoneSuppliersArray.length,
      rowsProcessed: lastRow - 1,
      processingTime: elapsed,
      type: 'full'
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка полного обновления ТОП данных', error.toString());
    return {
      success: false,
      error: error.toString(),
      suppliers: 0,
      type: 'full'
    };
  }
}

// ==================== СБРОС СЧЕТЧИКА ИНКРЕМЕНТАЛЬНОГО ОБНОВЛЕНИЯ ====================
function resetIncrementalCounter() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet) {
      return {
        success: false,
        message: 'Основная таблица не найдена'
      };
    }
    
    const lastRow = mainSheet.getLastRow();
    
    // Сбрасываем счетчик на текущую последнюю строку
    PropertiesService.getScriptProperties().setProperty(
      'TOP_DATA_LAST_PROCESSED_ROW', 
      lastRow.toString()
    );
    
    logToSheet('INFO', 'Счетчик инкрементального обновления сброшен', 
      `Установлено значение: ${lastRow}`);
    
    return {
      success: true,
      message: `Счетчик сброшен на строку ${lastRow}`,
      lastProcessedRow: lastRow
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка сброса счетчика', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ПРОСТОЕ ИНКРЕМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ БЕЗ ПРОБЛЕМ ====================
function simpleIncrementalUpdate() {
  try {
    console.log('=== ПРОСТОЕ ИНКРЕМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ ===\n');
    
    // 1. Получаем текущее состояние
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet || mainSheet.getLastRow() <= 1) {
      console.log('❌ Таблица пуста');
      return { success: false, message: 'Таблица пуста' };
    }
    
    const lastRow = mainSheet.getLastRow();
    console.log(`Всего строк в таблице: ${lastRow}`);
    
    // 2. Сбрасываем счетчик если нужно
    const scriptProps = PropertiesService.getScriptProperties();
    let lastProcessed = parseInt(scriptProps.getProperty('TOP_DATA_LAST_PROCESSED_ROW') || '0');
    
    if (lastProcessed === 0) {
      console.log('🔄 Инициализирую счетчик...');
      scriptProps.setProperty('TOP_DATA_LAST_PROCESSED_ROW', lastRow.toString());
      lastProcessed = lastRow;
    }
    
    console.log(`Последняя обработанная строка: ${lastProcessed}`);
    
    // 3. Проверяем, есть ли новые строки
    if (lastRow <= lastProcessed) {
      console.log('✅ Нет новых строк для обработки');
      return { 
        success: true, 
        message: 'Нет новых строк',
        lastRow: lastRow,
        lastProcessed: lastProcessed
      };
    }
    
    // 4. Обрабатываем только новые строки (максимум 100)
    const newRowsCount = Math.min(100, lastRow - lastProcessed);
    const startRow = lastProcessed + 1;
    
    console.log(`🔄 Обрабатываю ${newRowsCount} новых строк с ${startRow}`);
    
    // Читаем новые данные
    const newDataRange = mainSheet.getRange(startRow, 1, newRowsCount, 19);
    const newData = newDataRange.getValues();
    
    // Получаем ТОП лист
    let topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    if (!topSheet) {
      console.log('📝 Создаю ТОП лист...');
      topSheet = spreadsheet.insertSheet('ТОП_ДАННЫЕ');
      createTopSheetStructure(topSheet);
    }
    
    // Читаем существующие данные
    const existingData = readExistingTopData(topSheet);
    
    // Обрабатываем новые данные
    const suppliersSet = new Set(existingData.suppliers || []);
    const phoneSuppliersMap = { ...existingData.phoneSuppliers };
    
    let newSuppliers = 0;
    let newPhones = 0;
    
    for (let i = 0; i < newData.length; i++) {
      const phone = newData[i][2] ? newData[i][2].toString().trim() : '';
      const supplier = newData[i][4] ? newData[i][4].toString().trim() : '';
      
      if (supplier && supplier !== '') {
        if (!suppliersSet.has(supplier)) {
          suppliersSet.add(supplier);
          newSuppliers++;
        }
        
        if (phone && phone !== '') {
          const cleanPhone = normalizePhone(phone);
          if (!phoneSuppliersMap[cleanPhone]) {
            phoneSuppliersMap[cleanPhone] = new Set();
          }
          phoneSuppliersMap[cleanPhone].add(supplier);
          newPhones++;
        }
      }
    }
    
    // Подготавливаем данные для записи
    const sortedSuppliers = Array.from(suppliersSet).sort();
    const phoneSuppliersArray = Object.entries(phoneSuppliersMap)
      .map(([phone, suppliersSet]) => ({
        phone,
        suppliers: Array.from(suppliersSet).join('|'),
        shortPhone: phone.slice(-7)
      }))
      .sort((a, b) => b.suppliers.length - a.suppliers.length);
    
    // Записываем обновленные данные
    writeTopSheetDataSafe(topSheet, sortedSuppliers, phoneSuppliersArray);
    
    // Обновляем счетчик
    const newLastProcessed = lastProcessed + newRowsCount;
    scriptProps.setProperty('TOP_DATA_LAST_PROCESSED_ROW', newLastProcessed.toString());
    
    console.log(`✅ Обновление завершено!`);
    console.log(`   Новых поставщиков: ${newSuppliers}`);
    console.log(`   Новых телефонов: ${newPhones}`);
    console.log(`   Всего поставщиков: ${sortedSuppliers.length}`);
    console.log(`   Всего телефонов: ${phoneSuppliersArray.length}`);
    console.log(`   Теперь обработано до строки: ${newLastProcessed}`);
    
    return {
      success: true,
      newRows: newRowsCount,
      newSuppliers: newSuppliers,
      newPhones: newPhones,
      totalSuppliers: sortedSuppliers.length,
      totalPhones: phoneSuppliersArray.length,
      lastProcessed: newLastProcessed
    };
    
  } catch (error) {
    console.log('❌ Ошибка:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ИСПРАВЛЕННОЕ ИНКРЕМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ ====================
function updateTopDataIncremental(batchSize = 300) {
  try {
    const startTime = new Date();
    logToSheet('INFO', 'ИНКРЕМЕНТАЛЬНОЕ обновление ТОП данных', `Размер пакета: ${batchSize}`);
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet || mainSheet.getLastRow() <= 1) {
      logToSheet('INFO', 'Нет данных для инкрементального обновления', 'Таблица пуста');
      return {
        success: true,
        message: 'Нет данных для обновления',
        suppliers: 0,
        type: 'incremental'
      };
    }
    
    const lastRow = mainSheet.getLastRow();
    
    // Получаем последнюю обработанную строку
    let lastProcessedRow = parseInt(
      PropertiesService.getScriptProperties().getProperty('TOP_DATA_LAST_PROCESSED_ROW') || '0'
    );
    
    // ВАЖНО: Если lastProcessedRow = 0, значит это первый запуск или был сброс
    if (lastProcessedRow === 0) {
      logToSheet('INFO', 'Первый запуск инкрементального обновления', 
        `Инициализирую счетчик с ${lastRow}`);
      
      // Сохраняем текущую последнюю строку как обработанную
      PropertiesService.getScriptProperties().setProperty(
        'TOP_DATA_LAST_PROCESSED_ROW', 
        lastRow.toString()
      );
      
      return {
        success: true,
        message: 'Инициализирован счетчик обработанных строк',
        lastProcessedRow: lastRow,
        type: 'initialization'
      };
    }
    
    // Рассчитываем диапазон для обработки
    const startRow = Math.max(2, lastProcessedRow + 1);
    const rowsToProcess = Math.min(batchSize, lastRow - startRow + 1);
    
    if (rowsToProcess <= 0) {
      logToSheet('INFO', 'Нет новых строк для обработки', 
        `Последняя обработанная: ${lastProcessedRow}, Всего строк: ${lastRow}`);
      return {
        success: true,
        message: 'Нет новых строк для обработки',
        rowsProcessed: 0,
        type: 'incremental'
      };
    }
    
    // Получаем новые данные
    const dataRange = mainSheet.getRange(startRow, 1, rowsToProcess, 19);
    const newData = dataRange.getValues();
    
    logToSheet('INFO', 'Обработка новых строк', 
      `С ${startRow} по ${startRow + rowsToProcess - 1}, Всего: ${rowsToProcess} строк`);
    
    // Проверяем и готовим ТОП лист
    let topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    
    // Если ТОП листа нет - делаем полное обновление один раз
    if (!topSheet) {
      logToSheet('INFO', 'ТОП лист не найден, создаю полное обновление');
      
      // Делаем полное обновление
      const fullUpdateResult = updateTopData();
      
      // После полного обновления устанавливаем lastProcessedRow
      PropertiesService.getScriptProperties().setProperty(
        'TOP_DATA_LAST_PROCESSED_ROW', 
        lastRow.toString()
      );
      
      return {
        ...fullUpdateResult,
        type: 'full_instead_of_incremental'
      };
    }
    
    // Получаем существующие данные из ТОП листа
    const existingData = readExistingTopData(topSheet);
    
    // Обрабатываем новые данные
    const newResults = processNewDataForTopSheet(newData, existingData);
    
    // Объединяем результаты
    const mergedSuppliers = mergeArrays(existingData.suppliers, newResults.suppliers);
    const mergedPhoneSuppliers = mergePhoneSuppliers(existingData.phoneSuppliers, newResults.phoneSuppliers);
    
    // Сортируем и ограничиваем
    const sortedSuppliers = mergedSuppliers.sort().slice(0, 5000);
    const sortedPhoneSuppliers = mergedPhoneSuppliers
      .sort((a, b) => b.suppliers.length - a.suppliers.length)
      .slice(0, 3000);
    
    // Записываем обновленные данные
    writeTopSheetDataSafe(topSheet, sortedSuppliers, sortedPhoneSuppliers);
    
    const elapsed = new Date() - startTime;
    
    // Сохраняем метаданные
    const metaRow = Math.max(sortedSuppliers.length, sortedPhoneSuppliers.length) + 3;
    writeMetaData(topSheet, metaRow, lastRow - 1, sortedSuppliers.length, 
                  sortedPhoneSuppliers.length, elapsed, 'INCREMENTAL');
    
    // Сохраняем новую последнюю обработанную строку
    const newLastProcessedRow = startRow + rowsToProcess - 1;
    PropertiesService.getScriptProperties().setProperty(
      'TOP_DATA_LAST_PROCESSED_ROW', 
      newLastProcessedRow.toString()
    );
    
    logToSheet('SUCCESS', 'ИНКРЕМЕНТАЛЬНОЕ обновление завершено', 
      `Новые строки: ${rowsToProcess}, ` +
      `Всего поставщиков: ${sortedSuppliers.length}, ` +
      `Телефонов: ${sortedPhoneSuppliers.length}, ` +
      `Время: ${elapsed}мс, ` +
      `Последняя обработанная строка: ${newLastProcessedRow}`);
    
    return {
      success: true,
      suppliers: sortedSuppliers.length,
      phones: sortedPhoneSuppliers.length,
      rowsProcessed: rowsToProcess,
      newRows: rowsToProcess,
      processingTime: elapsed,
      lastProcessedRow: newLastProcessedRow,
      type: 'incremental'
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка инкрементального обновления ТОП данных', error.toString());
    return {
      success: false,
      error: error.toString(),
      suppliers: 0,
      type: 'incremental'
    };
  }
}

// ==================== БЕЗОПАСНАЯ ЗАПИСЬ ТОП ДАННЫХ ====================
function writeTopSheetDataSafe(topSheet, suppliersArray, phoneSuppliersArray) {
  // Очищаем данные начиная со строки 2 (оставляем заголовок)
  const lastRow = topSheet.getLastRow();
  if (lastRow > 1) {
    topSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }
  
  // Создаем структуру если ее нет
  if (topSheet.getLastRow() === 0 || !topSheet.getRange('A1').getValue()) {
    createTopSheetStructure(topSheet);
  }
  
  // Записываем поставщиков
  if (suppliersArray.length > 0) {
    for (let i = 0; i < suppliersArray.length; i++) {
      topSheet.getRange(i + 2, 1).setValue(suppliersArray[i]);
    }
  }
  
  // Записываем телефон-поставщики
  if (phoneSuppliersArray.length > 0) {
    for (let i = 0; i < phoneSuppliersArray.length; i++) {
      const item = phoneSuppliersArray[i];
      topSheet.getRange(i + 2, 2).setValue(item.phone);
      topSheet.getRange(i + 2, 3).setValue(item.suppliers);
      topSheet.getRange(i + 2, 4).setValue(item.shortPhone);
    }
  }
  
  // Форматирование
  topSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#e3f2fd');
  topSheet.autoResizeColumns(1, 4);
  topSheet.setFrozenRows(1);
}

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ clearTopSheet ====================
function clearTopSheet(topSheet) {
  // Безопасный метод очистки
  const lastRow = topSheet.getLastRow();
  if (lastRow > 1) {
    try {
      topSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
      return true;
    } catch (error) {
      logToSheet('WARN', 'Не удалось очистить ТОП лист', error.toString());
      return false;
    }
  }
  return true; // Если лист пуст или содержит только заголовок
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function processDataForTopSheet(data, totalRows) {
  const suppliersMap = new Map();
  const phoneSuppliersMap = {};
  
  for (let i = 0; i < data.length; i++) {
    const phone = data[i][2] ? data[i][2].toString().trim() : '';
    const supplier = data[i][4] ? data[i][4].toString().trim() : '';
    
    if (supplier && supplier !== '') {
      const supplierLower = supplier.toLowerCase();
      if (!suppliersMap.has(supplierLower)) {
        suppliersMap.set(supplierLower, supplier);
      }
      
      if (phone && phone !== '') {
        const cleanPhone = normalizePhone(phone);
        if (!phoneSuppliersMap[cleanPhone]) {
          phoneSuppliersMap[cleanPhone] = new Set();
        }
        const originalSupplier = suppliersMap.get(supplierLower) || supplier;
        phoneSuppliersMap[cleanPhone].add(originalSupplier);
      }
    }
  }
  
  const suppliersArray = Array.from(suppliersMap.values()).sort();
  const phoneSuppliersArray = Object.entries(phoneSuppliersMap)
    .map(([phone, suppliersSet]) => ({
      phone,
      suppliers: Array.from(suppliersSet).join('|'),
      shortPhone: phone.slice(-7)
    }))
    .sort((a, b) => b.suppliers.length - a.suppliers.length);
  
  return {
    suppliersArray,
    phoneSuppliersArray,
    suppliersMap,
    phoneSuppliersMap
  };
}

// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ processNewDataForTopSheet ====================
function processNewDataForTopSheet(newData, existingData) {
  // Проверяем и нормализуем existingData
  if (!existingData.suppliers) existingData.suppliers = [];
  if (!existingData.phoneSuppliers) existingData.phoneSuppliers = {};
  
  // Используем Set для поставщиков
  const newSuppliers = new Set(existingData.suppliers || []);
  const newPhoneSuppliers = { ...existingData.phoneSuppliers };
  
  // Обрабатываем новые данные
  for (let i = 0; i < newData.length; i++) {
    const phone = newData[i][2] ? newData[i][2].toString().trim() : '';
    const supplier = newData[i][4] ? newData[i][4].toString().trim() : '';
    
    if (supplier && supplier !== '') {
      newSuppliers.add(supplier);
      
      if (phone && phone !== '') {
        const cleanPhone = normalizePhone(phone);
        if (!newPhoneSuppliers[cleanPhone]) {
          newPhoneSuppliers[cleanPhone] = new Set();
        }
        newPhoneSuppliers[cleanPhone].add(supplier);
      }
    }
  }
  
  // Преобразуем Set в массив
  const suppliersArray = Array.from(newSuppliers).sort();
  
  // Преобразуем phoneSuppliers в массив для совместимости
  const phoneSuppliersArray = Object.entries(newPhoneSuppliers)
    .map(([phone, suppliersSet]) => ({
      phone,
      suppliers: Array.from(suppliersSet).join('|'),
      shortPhone: phone.slice(-7),
      _suppliersSet: suppliersSet // Сохраняем Set
    }))
    .sort((a, b) => b.suppliers.length - a.suppliers.length);
  
  return {
    suppliers: suppliersArray,
    phoneSuppliers: phoneSuppliersArray, // Возвращаем массив для совместимости
    phoneSuppliersObject: newPhoneSuppliers // И объект для внутреннего использования
  };
}

// ==================== УПРОЩЕННОЕ ИНКРЕМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ ====================
function simpleUpdateTopDataIncremental() {
  try {
    const startTime = new Date();
    logToSheet('INFO', 'Упрощенное инкрементальное обновление', 'Начало');
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const mainSheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!mainSheet || mainSheet.getLastRow() <= 1) {
      logToSheet('INFO', 'Нет данных', 'Таблица пуста');
      return { success: true, message: 'Нет данных' };
    }
    
    const lastRow = mainSheet.getLastRow();
    
    // Получаем последнюю обработанную строку
    let lastProcessedRow = parseInt(
      PropertiesService.getScriptProperties().getProperty('TOP_DATA_LAST_PROCESSED_ROW') || '0'
    );
    
    // Если 0 или мало строк, делаем полное обновление
    if (lastProcessedRow === 0 || lastRow - lastProcessedRow > 100) {
      logToSheet('INFO', 'Делаю полное обновление', `lastProcessedRow: ${lastProcessedRow}`);
      return updateTopData();
    }
    
    // Обрабатываем новые строки (максимум 100)
    const startRow = lastProcessedRow + 1;
    const rowsToProcess = Math.min(100, lastRow - startRow + 1);
    
    if (rowsToProcess <= 0) {
      logToSheet('INFO', 'Нет новых строк', `lastRow: ${lastRow}, lastProcessedRow: ${lastProcessedRow}`);
      return { success: true, message: 'Нет новых строк' };
    }
    
    logToSheet('INFO', 'Обработка строк', `С ${startRow} по ${startRow + rowsToProcess - 1}, Всего: ${rowsToProcess}`);
    
    // Читаем новые данные
    const newDataRange = mainSheet.getRange(startRow, 1, rowsToProcess, 19);
    const newData = newDataRange.getValues();
    
    // Получаем текущие ТОП данные
    const topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    if (!topSheet) {
      logToSheet('INFO', 'ТОП лист не найден, создаю');
      return updateTopData();
    }
    
    // Читаем существующие данные
    const existingSuppliers = new Set();
    const existingPhoneSuppliers = {};
    
    const topData = topSheet.getDataRange().getValues();
    for (let i = 1; i < topData.length; i++) {
      const supplier = topData[i][0] ? topData[i][0].toString().trim() : '';
      const phone = topData[i][1] ? topData[i][1].toString().trim() : '';
      const suppliersStr = topData[i][2] ? topData[i][2].toString().trim() : '';
      
      if (supplier && !supplier.includes('===') && !supplier.includes('МЕТА')) {
        existingSuppliers.add(supplier);
      }
      
      if (phone && suppliersStr && !phone.includes('===') && !phone.includes('МЕТА')) {
        if (!existingPhoneSuppliers[phone]) {
          existingPhoneSuppliers[phone] = new Set();
        }
        suppliersStr.split('|').forEach(s => {
          if (s.trim()) existingPhoneSuppliers[phone].add(s.trim());
        });
      }
    }
    
    // Добавляем новые данные
    let newSuppliersCount = 0;
    let newPhonesCount = 0;
    
    for (let i = 0; i < newData.length; i++) {
      const phone = newData[i][2] ? newData[i][2].toString().trim() : '';
      const supplier = newData[i][4] ? newData[i][4].toString().trim() : '';
      
      if (supplier && supplier !== '') {
        if (!existingSuppliers.has(supplier)) {
          existingSuppliers.add(supplier);
          newSuppliersCount++;
        }
        
        if (phone && phone !== '') {
          const cleanPhone = normalizePhone(phone);
          if (!existingPhoneSuppliers[cleanPhone]) {
            existingPhoneSuppliers[cleanPhone] = new Set();
            newPhonesCount++;
          }
          existingPhoneSuppliers[cleanPhone].add(supplier);
        }
      }
    }
    
    // Подготавливаем данные для записи
    const sortedSuppliers = Array.from(existingSuppliers).sort();
    const sortedPhoneSuppliers = Object.entries(existingPhoneSuppliers)
      .map(([phone, suppliersSet]) => ({
        phone,
        suppliers: Array.from(suppliersSet).join('|'),
        shortPhone: phone.slice(-7)
      }))
      .sort((a, b) => b.suppliers.length - a.suppliers.length);
    
    // Очищаем и записываем
    clearTopSheet(topSheet);
    createTopSheetStructure(topSheet);
    writeTopSheetDataSafe(topSheet, sortedSuppliers, sortedPhoneSuppliers);
    
    const elapsed = new Date() - startTime;
    
    // Сохраняем метаданные
    const metaRow = Math.max(sortedSuppliers.length, sortedPhoneSuppliers.length) + 3;
    writeMetaData(topSheet, metaRow, lastRow - 1, sortedSuppliers.length, 
                  sortedPhoneSuppliers.length, elapsed, 'INCREMENTAL');
    
    // Обновляем счетчик
    const newLastProcessed = startRow + rowsToProcess - 1;
    PropertiesService.getScriptProperties().setProperty('TOP_DATA_LAST_PROCESSED_ROW', newLastProcessed.toString());
    
    logToSheet('SUCCESS', 'Упрощенное обновление завершено', 
      `Новые строки: ${rowsToProcess}, ` +
      `Новых поставщиков: ${newSuppliersCount}, ` +
      `Новых телефонов: ${newPhonesCount}, ` +
      `Всего поставщиков: ${sortedSuppliers.length}, ` +
      `Телефонов: ${sortedPhoneSuppliers.length}, ` +
      `Время: ${elapsed}мс`);
    
    return {
      success: true,
      newRows: rowsToProcess,
      newSuppliers: newSuppliersCount,
      newPhones: newPhonesCount,
      totalSuppliers: sortedSuppliers.length,
      totalPhones: sortedPhoneSuppliers.length,
      processingTime: elapsed,
      type: 'incremental_simple'
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка упрощенного инкрементального обновления', error.toString());
    return {
      success: false,
      error: error.toString(),
      type: 'incremental_simple'
    };
  }
}

// ==================== НАСТРОЙКА ТРИГГЕРОВ (ИСПРАВЛЕННАЯ) ====================
function setupTriggersFixed() {
  try {
    // Удаляем старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'updateTopDataIncremental') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Создаем триггер для упрощенного обновления
    ScriptApp.newTrigger('simpleUpdateTopDataIncremental')
      .timeBased()
      .everyHours(1)
      .create();
    
    // Полное обновление по воскресеньям
    ScriptApp.newTrigger('updateTopData')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(3)
      .create();
    
    logToSheet('SUCCESS', 'Триггеры настроены', 
      'Упрощенное инкрементальное: каждый час\nПолное: воскресенье в 3:00');
    
    return {
      success: true,
      triggers: [
        { type: 'incremental_simple', frequency: 'hourly', function: 'simpleUpdateTopDataIncremental' },
        { type: 'full', frequency: 'weekly (Sunday 3:00)', function: 'updateTopData' }
      ]
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка настройки триггеров', error.toString());
    return { success: false, error: error.toString() };
  }
}

function readExistingTopData(topSheet) {
  const dataRange = topSheet.getDataRange();
  const data = dataRange.getValues();
  
  const suppliers = [];
  const phoneSuppliers = {};
  
  // Читаем данные из столбцов A-C
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    const supplier = row[0] ? row[0].toString().trim() : '';
    const phone = row[1] ? row[1].toString().trim() : '';
    const suppliersStr = row[2] ? row[2].toString().trim() : '';
    
    if (supplier && supplier !== '' && !supplier.includes('===') && !supplier.includes('МЕТА')) {
      suppliers.push(supplier);
    }
    
    if (phone && suppliersStr && !phone.includes('ТЕЛЕФОН') && !phone.includes('===') && !phone.includes('МЕТА')) {
      const supplierList = suppliersStr.split('|').filter(s => s.trim() !== '');
      phoneSuppliers[phone] = new Set(supplierList);
    }
  }
  
  return {
    suppliers: [...new Set(suppliers)],
    phoneSuppliers
  };
}

function mergeArrays(arr1, arr2) {
  const merged = [...arr1, ...arr2];
  return [...new Set(merged)];
}

// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ СЛИЯНИЯ ====================
function mergePhoneSuppliers(map1, map2) {
  // Проверяем типы входных данных
  if (!map1) map1 = {};
  if (!map2) map2 = {};
  
  // Преобразуем массивы в объекты если нужно
  let map1Obj = {};
  if (Array.isArray(map1)) {
    // Если пришел массив, преобразуем в объект
    map1.forEach(item => {
      if (item && item.phone && item.suppliers) {
        map1Obj[item.phone] = new Set(Array.isArray(item.suppliers) ? item.suppliers : [item.suppliers]);
      }
    });
  } else if (typeof map1 === 'object') {
    // Если это уже объект, копируем
    map1Obj = { ...map1 };
  }
  
  let map2Obj = {};
  if (Array.isArray(map2)) {
    // Если пришел массив, преобразуем в объект
    map2.forEach(item => {
      if (item && item.phone && item.suppliers) {
        map2Obj[item.phone] = new Set(Array.isArray(item.suppliers) ? item.suppliers : [item.suppliers]);
      }
    });
  } else if (typeof map2 === 'object') {
    // Если это уже объект, копируем
    map2Obj = { ...map2 };
  }
  
  // Объединяем объекты
  const result = { ...map1Obj };
  
  Object.entries(map2Obj).forEach(([phone, suppliersSet]) => {
    if (!result[phone]) {
      result[phone] = new Set(suppliersSet);
    } else {
      suppliersSet.forEach(supplier => result[phone].add(supplier));
    }
  });
  
  // Преобразуем обратно в массив для совместимости
  return Object.entries(result)
    .map(([phone, suppliersSet]) => {
      // Преобразуем Set в строку через | или оставляем как массив
      const suppliersArray = Array.from(suppliersSet);
      return {
        phone,
        suppliers: suppliersArray.join('|'),
        shortPhone: phone.slice(-7),
        _suppliersArray: suppliersArray // Сохраняем массив на всякий случай
      };
    })
    .sort((a, b) => b.suppliers.length - a.suppliers.length);
}


function createTopSheetStructure(topSheet) {
  topSheet.getRange('A1:D1').setValues([
    ['ПОСТАВЩИКИ', 'ТЕЛЕФОН', 'ПОСТАВЩИКИ_СПИСОК', 'ТЕЛЕФОН_КОРОТКИЙ']
  ]).setFontWeight('bold').setBackground('#e3f2fd');
}

function writeTopSheetData(topSheet, suppliersArray, phoneSuppliersArray) {
  // Записываем поставщиков
  if (suppliersArray.length > 0) {
    for (let i = 0; i < suppliersArray.length; i++) {
      topSheet.getRange(i + 2, 1).setValue(suppliersArray[i]);
    }
  }
  
  // Записываем телефон-поставщики
  if (phoneSuppliersArray.length > 0) {
    for (let i = 0; i < phoneSuppliersArray.length; i++) {
      const item = phoneSuppliersArray[i];
      topSheet.getRange(i + 2, 2).setValue(item.phone);
      topSheet.getRange(i + 2, 3).setValue(item.suppliers);
      topSheet.getRange(i + 2, 4).setValue(item.shortPhone);
    }
  }
  
  // Форматирование
  topSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#e3f2fd');
  topSheet.autoResizeColumns(1, 4);
  topSheet.setFrozenRows(1);
}

function writeMetaData(topSheet, metaRow, totalRows, suppliersCount, phonesCount, elapsed, updateType) {
  const metaData = [
    ['МЕТА-ДАННЫЕ', '', '', ''],
    ['Обновлено', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'), '', ''],
    ['Тип обновления', updateType, '', ''],
    ['Всего записей в таблице', totalRows, '', ''],
    ['Уникальных поставщиков', suppliersCount, '', ''],
    ['Телефонов с историей', phonesCount, '', ''],
    ['Время обработки', `${elapsed} мс`, '', ''],
    ['Последняя обработанная строка', 
      PropertiesService.getScriptProperties().getProperty('TOP_DATA_LAST_PROCESSED_ROW') || '1', 
      '', '']
  ];
  
  topSheet.getRange(metaRow, 1, metaData.length, 4).setValues(metaData);
  topSheet.getRange(metaRow, 1, 1, 4).setFontWeight('bold').setBackground('#f3e5f5');
}

// ==================== ФУНКЦИЯ ОБРАБОТКИ CORS ====================
function handleCORS() {
    return HtmlService.createHtmlOutput(JSON.stringify({
        success: true,
        message: 'CORS headers set'
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function doOptions() {
  // CORS preflight request
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.append(JSON.stringify({
    success: true,
    message: 'CORS headers set'
  }));
  
  // Устанавливаем заголовки отдельно
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  
  // В Google Apps Script заголовки устанавливаются по-другому
  return output;
}

// ==================== ОБНОВЛЕННЫЙ doGet ====================
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'ping';
    
    let response;
    
    // Новые оптимизированные методы
    if (action === 'get_top_data') {
      response = handleGetTopData();
    } else if (action === 'get_suppliers_optimized' && params.phone) {
      response = handleGetSuppliersOptimized(params.phone);
    } else if (action === 'get_brands_optimized') {
      response = handleGetPopularBrandsOptimized();
    } 
    // Получение обновлений статуса для PWA
    else if (action === 'get_status_updates' && params.phone) {
      const sinceTimestamp = params.timestamp ? parseInt(params.timestamp) : null;
      response = handleGetStatusUpdates(params.phone, sinceTimestamp);
    }
    // Получение PWA уведомлений
    else if (action === 'get_pwa_notifications' && params.phone) {
      const lastUpdate = params.lastUpdate || null;
      response = handleGetPWANotifications(params.phone, lastUpdate);
    }
    // Получение истории регистраций водителя
    else if (action === 'get_driver_history' && params.phone) {
      response = handleGetDriverHistory(params.phone);
    }
    // Получение общих обновлений для PWA
    else if (action === 'get_pwa_updates' && params.phone) {
      const lastUpdate = params.lastUpdate || null;
      response = handleGetPWAUpdates(params.phone, lastUpdate);
    }
    // Старые методы (для обратной совместимости)
    else if (action === 'get_suppliers' && params.phone) {
      response = handleGetSuppliersOptimized(params.phone);
    } else if (action === 'get_popular_brands') {
      response = handleGetPopularBrandsOptimized();
    }
    // Остальные действия без изменений
    else if (action === 'register_driver' && params.data) {
      try {
        const data = JSON.parse(params.data);
        response = handleRegisterDriver(data);
      } catch (error) {
        response = {
          success: false,
          message: 'Ошибка парсинга данных: ' + error.toString()
        };
      }
    } else if (action === 'ping') {
      response = {
        success: true,
        message: 'API работает нормально',
        timestamp: new Date().toISOString(),
        version: '1.5',
        features: ['optimized_search', 'suppliers_only', 'status_updates', 'pwa_notifications']
      };
    } else if (action === 'clear_cache') {
      response = clearSupplierCache();
    } else if (action === 'update_top_data') {
      response = updateTopData();
    } else if (action === 'cleanup_old_notifications') {
      response = cleanupOldPWANotifications();
    } else {
      response = {
        success: true,
        message: 'GET запрос принят',
        action: action,
        params: params
      };
    }
    
    // Единообразный JSON-ответ
    return createResponse(response);
      
  } catch (error) {
    Logger.log('❌ Ошибка в doGet:', error.toString());
    return createErrorResponse('Ошибка в doGet: ' + error.toString());
  }
}


// ==================== УПРОЩЕННЫЙ ЛИЧНЫЙ КАБИНЕТ ====================
function openSimpleDriverCabinet() {
    try {
        // Пробуем получить телефон
        let driverPhone = registrationState.data.phone;
        let driverName = registrationState.data.fio || '';
        
        if (!driverPhone) {
            const lastRegistration = localStorage.getItem('last_registration');
            if (lastRegistration) {
                try {
                    const lastRegData = JSON.parse(lastRegistration);
                    driverPhone = lastRegData.phone || '';
                    driverName = lastRegData.fio || '';
                } catch (e) {
                    console.log('Ошибка парсинга:', e);
                }
            }
        }
        
        if (!driverPhone) {
            showNotification('Введите номер телефона для доступа к личному кабинету', 'error');
            showStep(1);
            return;
        }
        
        // Показываем простой личный кабинет без запросов к серверу
        showSimpleCabinet(driverPhone, driverName);
        
    } catch (error) {
        console.log('Ошибка открытия упрощенного кабинета:', error);
        showNotification('Ошибка открытия личного кабинета', 'error');
    }
}

function showSimpleCabinet(driverPhone, driverName) {
    const modalHtml = `
        <div class="modal-overlay" onclick="closeDriverCabinet()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">👤 Личный кабинет водителя</h3>
                    <button class="modal-close" onclick="closeDriverCabinet()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="info-box" style="margin-bottom: 20px;">
                        <p><strong>👤 Водитель:</strong> ${driverName || 'Не указано'}</p>
                        <p><strong>📱 Телефон:</strong> ${formatPhoneDisplay(driverPhone)}</p>
                    </div>
                    
                    <div class="warning-box" style="margin-bottom: 20px;">
                        <p>⚠️ <strong>Внимание!</strong></p>
                        <p>Полная версия личного кабинета находится в разработке.</p>
                        <p>В ближайшее время здесь будет доступна:</p>
                        <ul style="margin-left: 20px; margin-top: 10px;">
                            <li>История ваших регистраций</li>
                            <li>Текущий статус заездов</li>
                            <li>Уведомления о назначении ворот</li>
                            <li>Информация о проблемах</li>
                        </ul>
                    </div>
                    
                    <div class="info-box">
                        <p>📱 Для получения информации о текущем статусе обратитесь к диспетчеру.</p>
                        <p>🚪 Ворота будут назначены и информация появится в вашем кабинете.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeDriverCabinet()">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('driver-cabinet-modal');
    if (oldModal) oldModal.remove();
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'driver-cabinet-modal';
    document.body.appendChild(modalContainer);
}

function handleGetDriverHistory(phone) {
  try {
    Logger.log('Получение истории водителя для телефона:', phone);
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        success: true,
        registrations: [],
        message: 'Таблица пуста'
      };
    }
    
    const cleanPhone = normalizePhone(phone);
    const lastRow = sheet.getLastRow();
    
    // Получаем все записи с этим телефоном
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 19);
    const data = dataRange.getValues();
    
    const registrations = [];
    
    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      const rowPhone = rowData[2] ? rowData[2].toString() : '';
      
      if (normalizePhone(rowPhone) === cleanPhone) {
        // Форматируем дату и время правильно
        const dateStr = rowData[0] ? formatDateFromCell(rowData[0]) : '';
        const timeStr = rowData[1] ? formatTimeFromCell(rowData[1]) : '';
        
        const registration = {
          rowNumber: i + 2,
          date: dateStr,
          time: timeStr,
          phone: rowData[2] || '',
          fio: rowData[3] || '',
          supplier: rowData[4] || '',
          legalEntity: rowData[5] || '',
          productType: rowData[6] || '',
          vehicleType: rowData[7] || '',
          vehicleNumber: rowData[8] || '',
          pallets: rowData[9] || 0,
          orderNumber: rowData[10] || '',
          etrn: rowData[11] || '',
          transit: rowData[12] || '',
          defaultGate: rowData[13] || '',
          assignedGate: rowData[14] || '',
          status: rowData[15] || 'Зарегистрирован',
          problemType: rowData[16] || '',
          chatId: rowData[17] || '',
          scheduleViolation: rowData[18] || 'Нет',
          displayDate: dateStr && timeStr ? `${dateStr} ${timeStr}` : dateStr || timeStr || ''
        };
        
        registrations.push(registration);
      }
    }
    
    // Сортируем по дате (новые сначала)
    registrations.sort((a, b) => {
      const dateA = parseDateForSorting(a.date, a.time);
      const dateB = parseDateForSorting(b.date, b.time);
      return dateB - dateA;
    });
    
    Logger.log('Найдено регистраций:', registrations.length);
    
    return {
      success: true,
      registrations: registrations,
      count: registrations.length,
      driverPhone: cleanPhone,
      driverName: registrations.length > 0 ? registrations[0].fio : ''
    };
    
  } catch (error) {
    Logger.log('Ошибка получения истории водителя:', error.toString());
    return {
      success: false,
      error: error.toString(),
      registrations: []
    };
  }
}
// Вспомогательная функция для форматирования даты из ячейки
function formatDateFromCell(cellValue) {
  try {
    if (!cellValue) return '';
    
    if (cellValue instanceof Date) {
      const timeZone = Session.getScriptTimeZone();
      return Utilities.formatDate(cellValue, timeZone, 'dd.MM.yyyy');
    }
    
    const strValue = cellValue.toString().trim();
    if (strValue.includes('.')) {
      // Уже в формате dd.MM.yyyy
      return strValue;
    }
    
    return strValue;
    
  } catch (e) {
    Logger.log('Ошибка форматирования даты:', e.toString());
    return cellValue ? cellValue.toString() : '';
  }
}
// Вспомогательная функция для форматирования времени из ячейки
function formatTimeFromCell(cellValue) {
  try {
    if (!cellValue) return '';
    
    if (cellValue instanceof Date) {
      const timeZone = Session.getScriptTimeZone();
      return Utilities.formatDate(cellValue, timeZone, 'HH:mm');
    }
    
    const strValue = cellValue.toString().trim();
    if (strValue.includes(':')) {
      // Уже в формате HH:mm
      return strValue;
    }
    
    return strValue;
    
  } catch (e) {
    Logger.log('Ошибка форматирования времени:', e.toString());
    return cellValue ? cellValue.toString() : '';
  }
}


// Функция для парсинга даты для сортировки
function parseDateForSorting(dateStr, timeStr) {
  try {
    if (!dateStr) return new Date(0);
    
    // Формат dd.MM.yyyy
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date(0);
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    let hours = 0, minutes = 0;
    
    if (timeStr) {
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
    }
    
    return new Date(year, month, day, hours, minutes, 0);
    
  } catch (e) {
    return new Date(0);
  }
}

function parseRegistrationDate(dateStr, timeStr) {
  try {
    if (!dateStr) return new Date(0);
    
    // Формат dd.MM.yyyy
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date(0);
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    let hours = 0, minutes = 0, seconds = 0;
    
    if (timeStr) {
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        seconds = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;
      }
    }
    
    return new Date(year, month, day, hours, minutes, seconds);
    
  } catch (e) {
    return new Date(0);
  }
}

// ==================== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ОБНОВЛЕНИЙ СТАТУСА ====================
function handleGetStatusUpdates(phone, sinceTimestamp = null) {
  try {
    if (!phone) {
      return {
        success: false,
        message: 'Телефон не указан'
      };
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        success: true,
        updates: []
      };
    }
    
    const cleanPhone = normalizePhone(phone);
    const lastRow = sheet.getLastRow();
    
    // Получаем все записи с этим телефоном
    const phoneRange = sheet.getRange(2, 3, lastRow - 1, 1);
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 19);
    
    const phones = phoneRange.getValues();
    const data = dataRange.getValues();
    
    const updates = [];
    const seenUpdates = new Set(); // Для предотвращения дубликатов
    
    for (let i = 0; i < phones.length; i++) {
      const rowPhone = phones[i][0] ? phones[i][0].toString() : '';
      if (normalizePhone(rowPhone) === cleanPhone) {
        const rowData = data[i];
        
        // Создаем уникальный ID для этого обновления (строка + статус + ворота)
        const updateId = `row_${i + 2}_${rowData[15] || ''}_${rowData[14] || ''}`;
        
        // Проверяем, не обрабатывали ли мы уже это обновление
        if (seenUpdates.has(updateId)) {
          continue;
        }
        
        seenUpdates.add(updateId);
        
        // Формируем обновление
        const update = {
          registrationId: updateId,
          driverId: cleanPhone,
          rowNumber: i + 2,
          timestamp: new Date().toISOString(),
          newStatus: rowData[15] || '', // Статус (P)
          oldStatus: '', // Можно получать из истории
          assignedGate: rowData[14] || '', // Ворота назначенные (O)
          supplier: rowData[4] || '', // Поставщик (E)
          fio: rowData[3] || '', // ФИО (D)
          phone: rowData[2] || '', // Телефон (C)
          problemType: rowData[16] || '', // Тип проблемы (Q)
          productType: rowData[6] || '', // Тип товара (G)
          legalEntity: rowData[5] || '', // Юрлицо (F)
          transit: rowData[12] || '', // Транзит (M)
          vehicleNumber: rowData[8] || '', // Номер ТС (I)
          orderNumber: rowData[10] || '' // Номер заказа (K)
        };
        
        // Фильтруем по времени если указано
        if (!sinceTimestamp || i + 2 >= sinceTimestamp) {
          updates.push(update);
        }
      }
    }
    
    // Сортируем по номеру строки (новые сначала)
    updates.sort((a, b) => b.rowNumber - a.rowNumber);
    
    return {
      success: true,
      updates: updates,
      count: updates.length,
      lastUpdate: updates.length > 0 ? updates[0].timestamp : null,
      driverPhone: cleanPhone
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка получения обновлений статуса', error.toString());
    return {
      success: false,
      error: error.toString(),
      updates: []
    };
  }
}


// Основная функция doPost

function doPost(e) {
  try {
    logToSheet('INFO', 'doPost вызван', 'Начало обработки');
    
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        logToSheet('ERROR', 'Ошибка парсинга JSON', parseError.toString());
        return createErrorResponse('Неверный JSON формат: ' + parseError.toString());
      }
    }
    
    const action = data.action || 'unknown';
    logToSheet('INFO', 'Обработка действия', action);
    
    let response;
    
    switch(action) {
      case 'register_driver':
        response = handleRegisterDriver(data.data || {});
        break;
      case 'get_suppliers':
        response = handleGetSuppliers(data.phone || '');
        break;
      case 'get_popular_brands':
        response = handleGetPopularBrands();
        break;
      case 'check_driver':
        response = handleCheckDriver(data.phone || '');
        break;
      case 'test':
        response = {
          success: true,
          message: 'Тест успешен',
          timestamp: new Date().toISOString()
        };
        break;
      default:
        response = {
          success: false,
          message: 'Неизвестное действие: ' + action
        };
    }
    
    logToSheet('INFO', 'Ответ для действия', `${action}: ${response.success ? 'успех' : 'ошибка'}`);
    
    return createResponse(response);
      
  } catch (error) {
    logToSheet('ERROR', 'Критическая ошибка в doPost', error.toString());
    
    return createErrorResponse('Серверная ошибка: ' + error.toString());
  }
  
}

function handleRegisterDriver(driverData) {
  try {
    logToSheet('INFO', 'Регистрация водителя', 'Начало обработки');
    
    // ПРЯМОЕ ИСПРАВЛЕНИЕ В GAS:
    
    // 1. Нормализуем телефон прямо здесь, независимо от того, что пришло
    if (driverData.phone) {
      driverData.phone = normalizePhone(driverData.phone.toString());
      console.log('✅ Телефон нормализован в GAS:', driverData.phone);
    }
    
    // 2. Удаляем поле gate если оно есть
    if (driverData.gate !== undefined) {
      console.log('⚠️ Удаляю поле gate из данных:', driverData.gate);
      delete driverData.gate;
    }
    
    // Проверяем обязательные поля
    if (!driverData.phone) {
      return {
        success: false,
        message: 'Не указан номер телефона'
      };
    }
    
    if (!driverData.fio) {
      return {
        success: false,
        message: 'Не указаны ФИО'
      };
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    // Создаем таблицу если она не существует
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      const headers = [
        'Дата', 'Время', 'Телефон', 'ФИО', 'Поставщик', 'Юр Лицо', 'Тип товара',
        'Марка авто', 'Номер ТС', 'Поддоны', 'Номер заказа', 'ЭТрН', 'Транзит',
        'Ворота по умолчанию', 'Ворота назначенные', 'Статус', 'Типы проблем', 
        'Chat ID', 'Опоздание по графику'
      ];
      sheet.getRange('A1:S1').setValues([headers]);
      sheet.getRange('A1:S1').setFontWeight('bold');
      sheet.getRange('A1:S1').setBackground('#e3f2fd');
    }
    
    // Подготавливаем данные
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
    
    // Получаем данные из driverData
    const transit = driverData.transit || 'Нет';
    
    // ВОРОТА ПО УМОЛЧАНИЮ
    const defaultGate = getDefaultGate(driverData.legalEntity, driverData.productType);
    
    // Столбец O ВСЕГДА пустой
    const assignedGate = '';
    
    const problemTypes = '';
    const scheduleViolation = driverData.scheduleViolation || 'Нет';
    const status = 'Зарегистрирован';
    const chatId = '';
    
    // Формируем строку для записи - ПРОСТО вставляем значения
    const rowData = [
      dateStr,                    // A: Дата (просто текст)
      timeStr,                    // B: Время (просто текст)
      driverData.phone || '',     // C: Телефон (уже нормализованный)
      driverData.fio || '',       // D: ФИО
      driverData.supplier || '',  // E: Поставщик
      driverData.legalEntity || '', // F: Юр Лицо
      driverData.productType || '', // G: Тип товара
      driverData.vehicleType || '', // H: Марка авто
      driverData.vehicleNumber || '', // I: Номер ТС
      driverData.pallets || 0,    // J: Поддоны
      driverData.orderNumber || '', // K: Номер заказа
      driverData.etrn || '',      // L: ЭТрН
      transit,                    // M: Транзит
      defaultGate,                // N: Ворота по умолчанию
      assignedGate,               // O: Ворота назначенные (ПУСТО)
      status,                     // P: Статус
      problemTypes,               // Q: Типы проблем (ПУСТО)
      chatId,                     // R: Chat ID (ПУСТО)
      scheduleViolation           // S: Опоздание
    ];
    
    console.log('📝 Данные для записи:');
    console.log('Телефон:', rowData[2]);
    console.log('Ворота N:', rowData[13]);
    console.log('Ворота O:', rowData[14]);
    
    // Добавляем строку в конец
    const lastRow = sheet.getLastRow();
    const targetRow = lastRow + 1;
    
    // ПРОСТО записываем данные - БЕЗ изменения форматирования
    sheet.getRange(targetRow, 1, 1, 19).setValues([rowData]);
    
    console.log('✅ Записано в строку:', targetRow);
    
    return {
      success: true,
      message: 'Водитель успешно зарегистрирован',
      data: {
        date: dateStr,
        time: timeStr,
        defaultGate: defaultGate,
        assignedGate: assignedGate,
        transit: transit,
        scheduleViolation: scheduleViolation,
        status: status,
        rowNumber: targetRow
      }
    };
    
  } catch (error) {
    console.log('❌ Ошибка регистрации:', error.toString());
    return {
      success: false,
      message: 'Ошибка при регистрации: ' + error.toString()
    };
  }
}

// ==================== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ВОРОТ ПО УМОЛЧАНИЮ ====================
function getDefaultGate(legalEntity, productType) {
  if (!productType || !legalEntity) {
    return 'Не определены';
  }
  
  // Возвращаем длинные ответы как в app.js
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
  
  return 'Не определены';
}


// Функция проверки проблем на стороне сервера
function checkProblemsServerSide(driverData) {
  const problems = [];
  
  // Проверяем номер заказа
  if (!driverData.orderNumber || driverData.orderNumber.toString().trim() === '' || driverData.orderNumber.toString().trim() === '0') {
    problems.push('Нет номера заказа');
  }
  
  // Проверяем ЭТрН
  if (!driverData.etrn || driverData.etrn.toString().trim() === '' || driverData.etrn.toString().trim() === '0') {
    problems.push('Нет ЭТрН');
  }
  
  // Проверяем нарушение графика
  if (driverData.scheduleViolation === 'Да') {
    problems.push('Нарушение графика');
  }
  
  return problems.length > 0 ? problems.join('; ') : 'Нет';
}
// ИСПРАВЛЕННАЯ версия с сохранением кэша между вызовами
function handleGetSuppliers(phone) {
  const startTime = new Date();
  
  try {
    logToSheet('INFO', 'Поиск поставщиков с кэшем', `Телефон: ${phone}`);
    
    if (!phone) {
      return { 
        success: true, 
        suppliers: [],
        message: 'Телефон не указан'
      };
    }
    
    // Нормализуем телефон для ключа кэша
    const cacheKey = 'supplier_' + phone.replace(/\D/g, '').slice(-7);
    const now = Date.now();
    
    // Получаем кэш из PropertiesService (сохраняется между вызовами)
    const scriptProperties = PropertiesService.getScriptProperties();
    const cacheDataStr = scriptProperties.getProperty('supplier_cache');
    
    let cache = {};
    if (cacheDataStr) {
      try {
        cache = JSON.parse(cacheDataStr);
      } catch (e) {
        logToSheet('ERROR', 'Ошибка парсинга кэша', e.toString());
      }
    }
    
    // Проверяем кэш (храним 15 минут)
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < 15 * 60 * 1000)) {
      const elapsed = new Date() - startTime;
      logToSheet('INFO', 'Результат из кэша', 
        `Телефон: ${phone}, Найдено: ${cache[cacheKey].data.suppliers.length}, Время: ${elapsed}мс`);
      
      return {
        ...cache[cacheKey].data,
        fromCache: true,
        cacheTime: cache[cacheKey].timestamp
      };
    }
    
    // Если нет в кэше, ищем
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { 
        success: true, 
        suppliers: [],
        message: 'Таблица пуста'
      };
    }
    
    const lastRow = sheet.getLastRow();
    const cleanPhone = phone.replace(/\D/g, '');
    const last7Digits = cleanPhone.slice(-7);
    
    // Используем быстрый поиск
    const suppliers = [];
    const seen = new Set();
    const chunkSize = 2000;
    
    let processedRows = 0;
    
    // Ищем с начала таблицы
    for (let startRow = 2; startRow <= lastRow; startRow += chunkSize) {
      const numRows = Math.min(chunkSize, lastRow - startRow + 1);
      
      // Читаем только столбцы C и E
      const phoneRange = sheet.getRange(startRow, 3, numRows, 1);
      const supplierRange = sheet.getRange(startRow, 5, numRows, 1);
      
      const phones = phoneRange.getValues();
      const suppliersData = supplierRange.getValues();
      
      processedRows += phones.length;
      
      // Ищем в этом чанке
      for (let i = 0; i < phones.length; i++) {
        const rowPhone = phones[i][0] ? phones[i][0].toString() : '';
        const supplier = suppliersData[i][0] ? suppliersData[i][0].toString().trim() : '';
        
        if (rowPhone && supplier) {
          const cleanRowPhone = rowPhone.replace(/\D/g, '');
          
          if (cleanRowPhone.slice(-7) === last7Digits) {
            if (!seen.has(supplier)) {
              suppliers.push(supplier);
              seen.add(supplier);
            }
          }
        }
      }
      
      // Прерываем если нашли достаточно
      if (suppliers.length >= 15) {
        break;
      }
    }
    
    const elapsed = new Date() - startTime;
    
    // Сохраняем результат в кэш
    const result = {
      success: true,
      suppliers: suppliers,
      count: suppliers.length,
      message: suppliers.length > 0 ? 
        `Найдено ${suppliers.length} поставщиков` : 
        'Поставщики не найдены',
      searchMethod: 'CACHED',
      processedRows: processedRows,
      searchTime: elapsed
    };
    
    // Обновляем кэш и сохраняем
    cache[cacheKey] = {
      data: result,
      timestamp: now
    };
    
    // Сохраняем кэш (ограничение PropertiesService: 9KB на значение)
    try {
      scriptProperties.setProperty('supplier_cache', JSON.stringify(cache));
    } catch (e) {
      logToSheet('ERROR', 'Не удалось сохранить кэш', e.toString());
      // Если кэш слишком большой, очищаем старые записи
      cleanupCache(cache);
    }
    
    logToSheet('INFO', 'Поиск завершен (сохранен в кэш)', 
      `Телефон: ${phone}, Найдено: ${suppliers.length}, Время: ${elapsed}мс`);
    
    return result;
    
  } catch (error) {
    const elapsed = new Date() - startTime;
    
    logToSheet('ERROR', 'Ошибка поиска с кэшем', 
      `Телефон: ${phone}, Время: ${elapsed}мс, Ошибка: ${error.toString()}`);
    
    return { 
      success: false, 
      suppliers: [], 
      message: 'Ошибка при поиске поставщиков',
      error: error.toString()
    };
  }
}

// Функция очистки старых записей из кэша
function cleanupCache(cache) {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 час
  
  // Удаляем записи старше 1 часа
  Object.keys(cache).forEach(key => {
    if (now - cache[key].timestamp > maxAge) {
      delete cache[key];
    }
  });
  
  // Если все еще слишком большой, оставляем только последние 50 записей
  const keys = Object.keys(cache);
  if (keys.length > 50) {
    keys.sort((a, b) => cache[b].timestamp - cache[a].timestamp);
    
    for (let i = 50; i < keys.length; i++) {
      delete cache[keys[i]];
    }
  }
  
  return cache;
}

// Функция для принудительной очистки кэша
function clearSupplierCache() {
  PropertiesService.getScriptProperties().deleteProperty('supplier_cache');
  logToSheet('INFO', 'Кэш очищен', 'Вручную');
  
  return {
    success: true,
    message: 'Кэш поставщиков очищен',
    timestamp: new Date().toISOString()
  };
}

// ИСПРАВЛЕННАЯ функция нормализации телефона для поиска
function normalizePhoneForSearch(phone) {
  if (!phone) return '';
  
  // Убираем все не-цифры
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Если номер начинается с 8 и имеет 11 цифр
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.substring(1);
  }
  
  // Если номер имеет 10 цифр (без кода страны)
  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  
  // Если номер начинается не с 7, но имеет 11 цифр
  if (cleaned.length === 11 && !cleaned.startsWith('7')) {
    // Оставляем как есть для поиска
  }
  
  // Убираем начальные нули
  cleaned = cleaned.replace(/^0+/, '');
  
  // Для российских номеров оставляем 11 цифр
  if (cleaned.startsWith('7') && cleaned.length > 11) {
    cleaned = cleaned.substring(0, 11);
  }
  
  // Если номер слишком короткий, возвращаем как есть
  if (cleaned.length < 10) {
    return phone.toString().replace(/\D/g, '');
  }
  
  return cleaned;
}

// ИСПРАВЛЕННАЯ функция нормализации телефона БЕЗ ПЛЮСА
// Принимает и строки, и числа из ячеек Google Sheets
function normalizePhone(phone) {
  if (!phone) {
    return '';
  }
  
  try {
    // Приводим к строке и убираем все не-цифры (включая плюс, пробелы и т.д.)
    let cleaned = phone.toString().replace(/[^\d]/g, '');
    
    // Убираем начальные нули если есть
    cleaned = cleaned.replace(/^0+/, '');
    
    // Если номер начинается с 8 (российский номер с 8)
    if (cleaned.startsWith('8') && cleaned.length === 11) {
      cleaned = '7' + cleaned.substring(1);
    }
    
    // Если номер 10 цифр без кода страны
    if (cleaned.length === 10) {
      cleaned = '7' + cleaned;
    }
    
    // Если номер начинается не с 7, но имеет 11 цифр - оставляем как есть
    // (это может быть международный формат)
    
    // Если номер все еще слишком длинный, обрезаем
    if (cleaned.length > 11) {
      cleaned = cleaned.slice(-11); // Берем последние 11 цифр
    }
    
    // Возвращаем БЕЗ плюса в начале
    return cleaned;
    
  } catch (error) {
    // В случае ошибки возвращаем только цифры
    return phone ? phone.toString().replace(/[^\d]/g, '') : '';
  }
}

// Получение популярных марок авто - ИСПРАВЛЕННАЯ ВЕРСИЯ
function handleGetPopularBrands() {
  try {
    logToSheet('INFO', 'Получение популярных марок авто', '');
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    const defaultBrands = ['Газель', 'Mercedes', 'Volvo', 'Scania', 'MAN', 'DAF', 'Ford', 'Renault', 'Iveco', 'Камаз'];
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { 
        success: true, 
        brands: defaultBrands,
        message: 'Используются стандартные марки (таблица пуста)'
      };
    }
    
    const lastRow = sheet.getLastRow();
    
    // Читаем последние 2000 записей для статистики
    const startRow = Math.max(2, lastRow - 2000);
    const numRows = Math.min(2000, lastRow - startRow + 1);
    
    // Столбец H (8) - Марка авто
    const brandRange = sheet.getRange(startRow, 8, numRows, 1);
    const brandData = brandRange.getValues();
    
    const brandCount = {};
    let totalBrands = 0;
    
    // Считаем частоту марок
    for (let i = 0; i < brandData.length; i++) {
      let brand = brandData[i][0];
      if (brand) {
        brand = brand.toString().trim();
        if (brand !== '') {
          brandCount[brand] = (brandCount[brand] || 0) + 1;
          totalBrands++;
        }
      }
    }
    
    // Сортируем по популярности
    const sortedBrands = Object.entries(brandCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12) // Топ-12 марок
      .map(entry => entry[0]);
    
    // Добавляем популярные по умолчанию если нужно
    for (const brand of defaultBrands) {
      if (!sortedBrands.includes(brand) && sortedBrands.length < 15) {
        sortedBrands.push(brand);
      }
    }
    
    logToSheet('INFO', 'Популярные марки получены', 
      `Всего записей: ${totalBrands}, Уникальных марок: ${Object.keys(brandCount).length}, Топ: ${sortedBrands.length}`);
    
    return { 
      success: true, 
      brands: sortedBrands,
      count: sortedBrands.length,
      totalBrands: totalBrands,
      uniqueBrands: Object.keys(brandCount).length,
      message: `Найдено ${sortedBrands.length} популярных марок из ${totalBrands} записей`
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка получения популярных марок', error.toString());
    return { 
      success: true, 
      brands: ['Газель', 'Mercedes', 'Volvo', 'Scania', 'MAN', 'DAF', 'Ford', 'Renault', 'Iveco'],
      message: 'Используются стандартные марки из-за ошибки'
    };
  }
}

// Проверка существования водителя
function handleCheckDriver(phone) {
  try {
    logToSheet('INFO', 'Проверка водителя', `Телефон: ${phone}`);
    
    if (!phone) {
      return { exists: false, success: true, message: 'Телефон не указан' };
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { exists: false, success: true };
    }
    
    const data = sheet.getDataRange().getValues();
    const normalizedPhone = normalizePhone(phone);
    
    // Ищем с конца (последние записи)
    for (let i = data.length - 1; i >= 1; i--) {
      const rowPhone = data[i][2] || '';
      if (normalizePhone(rowPhone.toString()) === normalizedPhone) {
        logToSheet('INFO', 'Водитель найден', 
          `Телефон: ${phone}, ФИО: ${data[i][3] || 'нет'}`);
        
        return {
          exists: true,
          success: true,
          driver: {
            fio: data[i][3] || '',
            phone: data[i][2] || '',
            lastDate: data[i][0] || '',
            lastTime: data[i][1] || '',
            supplier: data[i][4] || '',
            legalEntity: data[i][5] || '',
            productType: data[i][6] || ''
          }
        };
      }
    }
    
    logToSheet('INFO', 'Водитель не найден', `Телефон: ${phone}`);
    return { exists: false, success: true };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка проверки водителя', error.toString());
    return { 
      exists: false, 
      success: false, 
      error: error.toString(),
      message: 'Ошибка при проверке водителя'
    };
  }
}

function checkScheduleViolation(productType, registrationTime) {
  if (!productType) return false;
  
  const schedules = {
    'Сухой': { end: 16, endMinutes: 30 },
    'ФРЕШ': { start: 7, end: 14, endMinutes: 0 },
    'ФРОВ': { start: 7, end: 14, endMinutes: 0 },
    'Акциз': { start: 7, end: 13, endMinutes: 0 }
  };
  
  const schedule = schedules[productType];
  if (!schedule) return false;
  
  const hours = registrationTime.getHours();
  const minutes = registrationTime.getMinutes();
  
  return hours > schedule.end || (hours === schedule.end && minutes > schedule.endMinutes);
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

// Функции логирования
function logToSheet(level, message, details = '') {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
    
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
      const headers = ['Дата', 'Время', 'Уровень', 'Событие', 'Детали'];
      logSheet.getRange('A1:E1').setValues([headers]).setFontWeight('bold');
    }
    
    const now = new Date();
    const date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    const time = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
    
    const trimmedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
    const trimmedDetails = details && details.length > 500 ? details.substring(0, 500) + '...' : details;
    
    logSheet.appendRow([date, time, level, trimmedMessage, trimmedDetails]);
    
    // Ограничиваем лог (оставляем последние 1000 записей)
    if (logSheet.getLastRow() > 1000) {
      logSheet.deleteRow(2);
    }
    
    // Цветовое выделение в зависимости от уровня
    const lastRow = logSheet.getLastRow();
    const cellRange = logSheet.getRange(lastRow, 3, 1, 1);
    
    if (level === 'ERROR') {
      cellRange.setBackground('#ffebee').setFontColor('#c62828');
    } else if (level === 'WARN') {
      cellRange.setBackground('#fff3e0').setFontColor('#ef6c00');
    } else if (level === 'SUCCESS') {
      cellRange.setBackground('#e8f5e9').setFontColor('#2e7d32');
    } else if (level === 'INFO') {
      cellRange.setBackground('#e3f2fd').setFontColor('#1565c0');
    }
    
    // Автоматически подгоняем ширину столбцов
    logSheet.autoResizeColumns(1, 5);
    
    // Также логируем в консоль Apps Script
    console.log(`[${level}] ${message}`, details ? `\nДетали: ${details}` : '');
    
    return true;
  } catch (error) {
    console.error('Ошибка записи в лог:', error);
    return false;
  }
}

function logToConsole(level, message, details) {
  // ИСПРАВЛЕНИЕ: Функция была объявлена, но в handleGetSuppliers использовалась logToConsole
  // Исправьте вызов в handleGetSuppliers на logToSheet или добавьте эту функцию:
  console.log(`[${level}] ${message}`, details || '');
}

// Функции для создания ответов
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: message,
    timestamp: new Date().toISOString()
  }))
  .setMimeType(ContentService.MimeType.JSON);
}

function debugRegistrationData(driverData) {
  console.log('=== ДЕБАГ РЕГИСТРАЦИОННЫХ ДАННЫХ ===');
  console.log('Полученные данные от PWA:');
  console.log('Телефон (оригинал):', driverData.phone);
  console.log('Телефон тип:', typeof driverData.phone);
  console.log('Поле gate в данных:', driverData.gate);
  console.log('Все ключи в данных:', Object.keys(driverData));
  
  // Проверяем normalizePhone
  const normalized = normalizePhone(driverData.phone);
  console.log('Нормализованный телефон:', normalized);
  console.log('Сравнение:', driverData.phone === normalized ? '✅ Совпадают' : '❌ Разные');
  
  return normalized;
}

// Сверхбыстрая функция поиска (только по последним 100 записям)
function handleGetSuppliersFast(phone) {
  try {
    const searchPhone = normalizePhone(phone.trim());
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, suppliers: [] };
    }
    
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 100); // Последние 100 записей
    
    // Читаем только последние 100 строк
    const range = sheet.getRange(startRow, 3, Math.min(100, lastRow - startRow + 1), 3);
    const data = range.getValues(); // [телефон, ФИО, поставщик]
    
    const suppliers = [];
    const seen = new Set();
    
    for (let i = data.length - 1; i >= 0; i--) {
      const rowPhone = data[i][0] ? data[i][0].toString().trim() : '';
      const supplier = data[i][2] ? data[i][2].toString().trim() : '';
      
      if (rowPhone && supplier) {
        const normalizedRowPhone = normalizePhone(rowPhone);
        
        if (normalizedRowPhone === searchPhone || 
            normalizedRowPhone.slice(-7) === searchPhone.slice(-7)) {
          
          if (!seen.has(supplier)) {
            suppliers.push(supplier);
            seen.add(supplier);
          }
        }
      }
    }
    
    return { 
      success: true, 
      suppliers: suppliers,
      count: suppliers.length 
    };
    
  } catch (error) {
    return { success: false, suppliers: [], error: error.toString() };
  }
}

// Создайте индексную таблицу для быстрого поиска
function createSupplierIndex() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'Нет данных для индекса' };
    }
    
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 3, lastRow - 1, 3).getValues(); // C, D, E
    
    // Создаем индекс
    const index = {};
    
    for (let i = 0; i < data.length; i++) {
      const phone = data[i][0] ? data[i][0].toString().trim() : '';
      const supplier = data[i][2] ? data[i][2].toString().trim() : '';
      
      if (phone && supplier) {
        const normalizedPhone = normalizePhone(phone);
        
        if (!index[normalizedPhone]) {
          index[normalizedPhone] = new Set();
        }
        
        index[normalizedPhone].add(supplier);
      }
    }
    
    // Сохраняем индекс в Script Properties (до 9KB)
    const indexData = {};
    Object.keys(index).forEach(phone => {
      indexData[phone] = Array.from(index[phone]);
    });
    
    PropertiesService.getScriptProperties().setProperty(
      'supplier_index', 
      JSON.stringify(indexData)
    );
    
    logToSheet('SUCCESS', 'Индекс создан', 
      `Уникальных телефонов: ${Object.keys(index).length}`);
    
    return {
      success: true,
      indexedPhones: Object.keys(index).length
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка создания индекса', error.toString());
    return { success: false, error: error.toString() };
  }
}

// Быстрый поиск по индексу
function handleGetSuppliersIndexed(phone) {
  const startTime = new Date();
  
  try {
    const normalizedPhone = normalizePhone(phone);
    
    // Получаем индекс
    const indexJson = PropertiesService.getScriptProperties().getProperty('supplier_index');
    
    if (!indexJson) {
      // Если индекс не создан, используем обычный поиск
      return handleGetSuppliers(phone);
    }
    
    const index = JSON.parse(indexJson);
    
    // Ищем в индексе
    let suppliers = [];
    
    // Проверяем точное совпадение
    if (index[normalizedPhone]) {
      suppliers = index[normalizedPhone];
    }
    
    // Если не нашли, проверяем по последним цифрам
    if (suppliers.length === 0) {
      const last7Digits = normalizedPhone.slice(-7);
      
      Object.keys(index).forEach(indexPhone => {
        if (indexPhone.slice(-7) === last7Digits) {
          suppliers = suppliers.concat(index[indexPhone]);
        }
      });
    }
    
    // Убираем дубликаты
    const uniqueSuppliers = [...new Set(suppliers)];
    
    const elapsed = new Date() - startTime;
    
    logToSheet('INFO', 'Поиск по индексу', 
      `Телефон: ${phone}, Найдено: ${uniqueSuppliers.length}, Время: ${elapsed}мс`);
    
    return {
      success: true,
      suppliers: uniqueSuppliers,
      count: uniqueSuppliers.length,
      message: uniqueSuppliers.length > 0 ? 
        `Найдено ${uniqueSuppliers.length} поставщиков` : 
        'Поставщики не найдены',
      searchMethod: 'INDEX'
    };
    
  } catch (error) {
    const elapsed = new Date() - startTime;
    logToSheet('ERROR', 'Ошибка поиска по индексу', 
      `Время: ${elapsed}мс, Ошибка: ${error.toString()}`);
    
    return handleGetSuppliers(phone); // Fallback
  }
}

// Функция для очистки логов (опционально)
function clearLogs() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
    
    if (logSheet) {
      logSheet.clear();
      const headers = ['Дата', 'Время', 'Уровень', 'Событие', 'Детали'];
      logSheet.getRange('A1:E1').setValues([headers]).setFontWeight('bold');
      logToSheet('INFO', 'Логи очищены', '');
      return 'Логи успешно очищены';
    }
    
    return 'Лог таблица не найдена';
  } catch (error) {
    return 'Ошибка при очистке логов: ' + error.toString();
  }
}


// САМЫЙ БЫСТРЫЙ способ найти всех поставщиков
function findAllSuppliersFast() {
  const myPhone = '79176004862';
  const cleanPhone = myPhone.replace(/\D/g, '');
  const last7Digits = cleanPhone.slice(-7);
  
  console.log('=== САМЫЙ БЫСТРЫЙ ПОИСК ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    
    // Используем Google Sheets Query для быстрого поиска
    const query = `=QUERY('${SHEET_NAME}'!A:S, 
      "SELECT E, C, A, B 
       WHERE C CONTAINS '${last7Digits}' 
       ORDER BY A DESC, B DESC", 0)`;
    
    // Создаем временный лист для запроса
    const tempSheet = spreadsheet.insertSheet('FastSearch_' + new Date().getTime());
    tempSheet.getRange('A1').setFormula(query);
    
    // Ждем вычисления
    SpreadsheetApp.flush();
    Utilities.sleep(1000);
    
    const results = tempSheet.getDataRange().getValues();
    
    // Удаляем временный лист
    spreadsheet.deleteSheet(tempSheet);
    
    const suppliers = [];
    const seen = new Set();
    
    // Пропускаем заголовок QUERY (строка 1)
    for (let i = 1; i < results.length; i++) {
      const supplier = results[i][0] ? results[i][0].toString().trim() : '';
      const phone = results[i][1] ? results[i][1].toString() : '';
      const date = results[i][2] || '';
      const time = results[i][3] || '';
      
      if (supplier && !seen.has(supplier)) {
        suppliers.push({
          supplier: supplier,
          phone: phone,
          date: date,
          time: time,
          index: i
        });
        seen.add(supplier);
      }
    }
    
    console.log(`Найдено уникальных поставщиков: ${suppliers.length}`);
    
    suppliers.forEach((item, index) => {
      console.log(`${index + 1}. ${item.supplier}`);
      console.log(`   Телефон: ${item.phone}`);
      console.log(`   Дата: ${item.date} ${item.time}`);
    });
    
    // Ищем целевого поставщика
    const target = suppliers.find(item => 
      item.supplier.includes('Трейд') || 
      item.supplier.includes('Трейд-логистик')
    );
    
    if (target) {
      console.log(`\n✅ Целевой поставщик найден: ${target.supplier}`);
    } else {
      console.log(`\n❌ Целевой поставщик не найден`);
      console.log(`Поставщики в таблице: ${suppliers.map(s => s.supplier).join(', ')}`);
    }
    
    return {
      success: true,
      suppliers: suppliers.map(item => item.supplier),
      count: suppliers.length,
      targetFound: !!target,
      allSuppliers: suppliers
    };
    
  } catch (error) {
    console.error('Ошибка быстрого поиска:', error);
    return { success: false, error: error.toString() };
  }
}

function checkTableHeaders() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    console.log('❌ Таблица не найдена');
    return;
  }
  
  const headers = sheet.getRange('A1:Q1').getValues()[0];
  
  console.log('=== ЗАГОЛОВКИ ТАБЛИЦЫ ===');
  headers.forEach((header, index) => {
    console.log(`${String.fromCharCode(65 + index)} (${index + 1}): ${header || '(пусто)'}`);
  });
  
  console.log(`\nВсего строк: ${sheet.getLastRow()}`);
  
  // Проверим последнюю запись
  if (sheet.getLastRow() > 1) {
    const lastRow = sheet.getLastRow();
    const lastData = sheet.getRange(lastRow, 1, 1, 17).getValues()[0];
    
    console.log('\n=== ПОСЛЕДНЯЯ ЗАПИСЬ ===');
    console.log(`Строка: ${lastRow}`);
    lastData.forEach((value, index) => {
      console.log(`${String.fromCharCode(65 + index)}: ${value || '(пусто)'}`);
    });
  }
  
  return headers;
}

// ==================== РУЧНОЕ ОБНОВЛЕНИЕ ====================
function manualUpdateTopData() {
  const result = updateTopData();
  
  if (result.success) {
    return `✅ ТОП данные обновлены успешно!
Поставщиков: ${result.suppliers}
Марок авто: ${result.brands}
Телефонов: ${result.phones}
Время: ${result.processingTime} мс`;
  } else {
    return `❌ Ошибка: ${result.error}`;
  }
}

// ==================== НАСТРОЙКА ТРИГГЕРОВ ====================
function setupTriggers() {
  try {
    // Удаляем старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    
    // Создаем триггер для инкрементального обновления - каждый час
    ScriptApp.newTrigger('updateTopDataIncremental')
      .timeBased()
      .everyHours(1)
      .create();
    
    // Создаем триггер для полного обновления - в 3:00 ночи по воскресеньям
    ScriptApp.newTrigger('updateTopData')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(3)
      .create();
    
    logToSheet('SUCCESS', 'Триггеры настроены', 
      'Инкрементальное: каждый час\nПолное: воскресенье в 3:00');
    
    return {
      success: true,
      message: 'Триггеры успешно настроены',
      triggers: [
        { type: 'incremental', frequency: 'hourly', function: 'updateTopDataIncremental' },
        { type: 'full', frequency: 'weekly (Sunday 3:00)', function: 'updateTopData' }
      ]
    };
    
  } catch (error) {
    logToSheet('ERROR', 'Ошибка настройки триггеров', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}


// ==================== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ТОП ДАННЫХ ====================
function forceCleanUpdateTopData() {
  try {
    console.log('=== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ТОП ДАННЫХ ===\n');
    
    // 1. Очищаем все кэши
    PropertiesService.getScriptProperties().deleteProperty('top_data_cache_v2');
    PropertiesService.getScriptProperties().deleteProperty('top_data_cache_time_v2');
    PropertiesService.getScriptProperties().deleteProperty('TOP_DATA_LAST_UPDATED');
    PropertiesService.getScriptProperties().deleteProperty('simple_top_data_cache');
    PropertiesService.getScriptProperties().deleteProperty('simple_top_data_cache_time');
    
    console.log('✅ Кэши очищены');
    
    // 2. Удаляем старый лист ТОП_ДАННЫЕ если есть
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    if (topSheet) {
      spreadsheet.deleteSheet(topSheet);
      console.log('✅ Старый лист ТОП_ДАННЫЕ удален');
    }
    
    // 3. Обновляем ТОП данные
    console.log('\n🔄 Обновляю ТОП данные...');
    const updateResult = updateTopData();
    
    if (!updateResult.success) {
      throw new Error('Ошибка обновления: ' + updateResult.error);
    }
    
    console.log('✅ ТОП данные обновлены');
    console.log(`   Топ марок авто: ${updateResult.topBrands ? updateResult.topBrands.length : 0}`);
    console.log(`   Всего поставщиков: ${updateResult.suppliersCount || 0}`);
    console.log(`   Время: ${updateResult.processingTime || 0} мс`);
    
    // 4. Проверяем что записалось
    Utilities.sleep(3000);
    const newTopSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    if (newTopSheet) {
      const brands = [];
      const range = newTopSheet.getRange('A2:A10'); // Первые 10 строк столбца A
      const values = range.getValues();
      
      console.log('\n📊 Проверка записанных марок авто:');
      for (let i = 0; i < values.length; i++) {
        const brand = values[i][0];
        if (brand && brand.toString().trim() !== '') {
          const cleanBrand = brand.toString().trim();
          console.log(`${i + 1}. "${cleanBrand}"`);
          brands.push(cleanBrand);
        }
      }
      
      if (brands.length === 0) {
        console.log('❌ Марки авто не найдены в столбце A!');
      } else {
        console.log(`✅ Найдено ${brands.length} марок авто`);
      }
    }
    
    // 5. Тестируем поиск для вашего номера
    console.log('\n🔍 Тестирую поиск для вашего номера...');
    const testPhone = '79176004862';
    const searchResult = handleGetSuppliersOptimized(testPhone);
    
    console.log(`Телефон: ${testPhone}`);
    console.log(`Успех: ${searchResult.success ? '✅' : '❌'}`);
    console.log(`Найдено поставщиков: ${searchResult.count || 0}`);
    
    if (searchResult.suppliers && searchResult.suppliers.length > 0) {
      console.log('Поставщики:');
      searchResult.suppliers.forEach((supplier, index) => {
        console.log(`  ${index + 1}. ${supplier}`);
      });
    }
    
    return {
      success: true,
      update: updateResult,
      search: searchResult,
      message: 'ТОП данные успешно обновлены и очищены'
    };
    
  } catch (error) {
    console.log('❌ Ошибка принудительного обновления:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ФУНКЦИЯ ДЛЯ ПРОВЕРКИ И ВОССТАНОВЛЕНИЯ ТОП ДАННЫХ ====================
function checkAndFixTopData() {
  try {
    console.log('=== ПРОВЕРКА И ВОССТАНОВЛЕНИЕ ТОП ДАННЫХ ===\n');
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const topSheet = spreadsheet.getSheetByName('ТОП_ДАННЫЕ');
    
    if (!topSheet) {
      console.log('❌ Лист ТОП_ДАННЫЕ не найден');
      console.log('🔄 Создаю новый лист...');
      const updateResult = updateTopData();
      console.log('✅ Лист создан');
      return {
        success: true,
        action: 'created',
        result: updateResult
      };
    }
    
    const lastRow = topSheet.getLastRow();
    console.log(`Текущий лист: ${lastRow} строк`);
    
    if (lastRow <= 1) {
      console.log('⚠️ Лист пуст или содержит только заголовок');
      console.log('🔄 Обновляю данные...');
      createTopSheetStructure(topSheet);
      const updateResult = updateTopDataIncremental();
      console.log('✅ Данные обновлены');
      return {
        success: true,
        action: 'updated',
        result: updateResult
      };
    }
    
    // Проверяем структуру
    const headers = topSheet.getRange('A1:D1').getValues()[0];
    console.log('Заголовки:', headers);
    
    if (!headers[0] || headers[0] !== 'ПОСТАВЩИКИ') {
      console.log('⚠️ Неправильная структура заголовков');
      console.log('🔄 Восстанавливаю структуру...');
      createTopSheetStructure(topSheet);
    }
    
    // Проверяем данные
    const data = topSheet.getRange(2, 1, Math.min(10, lastRow - 1), 1).getValues();
    console.log('Первые 10 поставщиков:', data.filter(row => row[0]).map(row => row[0]));
    
    console.log('\n✅ Проверка завершена успешно');
    return {
      success: true,
      action: 'checked',
      rows: lastRow
    };
    
  } catch (error) {
    console.log('❌ Ошибка проверки:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== ТЕСТИРОВАНИЕ ИНКРЕМЕНТАЛЬНОГО ОБНОВЛЕНИЯ ====================
function testIncrementalUpdate() {
  console.log('=== ТЕСТ ИНКРЕМЕНТАЛЬНОГО ОБНОВЛЕНИЯ ===\n');
  
  try {
    // Сбрасываем счетчик обработанных строк
    PropertiesService.getScriptProperties().setProperty('TOP_DATA_LAST_PROCESSED_ROW', '1');
    
    console.log('1. Счетчик сброшен');
    
    // Запускаем инкрементальное обновление
    console.log('2. Запускаю инкрементальное обновление...');
    const result = updateTopDataIncremental(50); // Обрабатываем 50 строк
    
    if (result.success) {
      console.log('✅ Успех!');
      console.log(`   Обработано строк: ${result.rowsProcessed}`);
      console.log(`   Поставщиков: ${result.suppliers}`);
      console.log(`   Телефонов: ${result.phones}`);
      console.log(`   Время: ${result.processingTime} мс`);
    } else {
      console.log('❌ Ошибка:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.log('❌ Критическая ошибка:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

function setupOnEditTrigger() {
  try {
    Logger.log('=== НАСТРОЙКА ТРИГГЕРОВ ONEDIT ===');
    
    // Удаляем старые триггеры onEdit
    const allTriggers = ScriptApp.getProjectTriggers();
    allTriggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onEdit') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log('Удален старый триггер onEdit');
      }
    });
    
    // Создаем новый триггер для onEdit
    const trigger = ScriptApp.newTrigger('onEdit')
      .forSpreadsheet(SpreadsheetApp.openById(SHEET_ID))
      .onEdit()
      .create();
    
    Logger.log('✅ Триггер onEdit успешно установлен');
    Logger.log('Триггер ID:', trigger.getUniqueId());
    Logger.log('Тип события:', trigger.getEventType());
    
    return {
      success: true,
      message: 'Триггер onEdit установлен успешно',
      triggerId: trigger.getUniqueId()
    };
    
  } catch (error) {
    Logger.log('❌ Ошибка установки триггера onEdit:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Функции для логирования изменений статуса
function logStatusChange(row, oldStatus, newStatus, supplier, gate, fio, phone, problemType) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let logSheet = spreadsheet.getSheetByName('Логи_статусов');
    
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('Логи_статусов');
      const headers = ['Дата', 'Время', 'Строка', 'Статус_старый', 'Статус_новый', 
                      'Поставщик', 'Ворота', 'ФИО', 'Телефон', 'Тип_проблемы'];
      logSheet.getRange('A1:J1').setValues([headers]).setFontWeight('bold');
    }
    
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
    
    logSheet.appendRow([dateStr, timeStr, row, oldStatus, newStatus, 
                       supplier, gate, fio, phone, problemType]);
    
    // Ограничиваем логи (оставляем последние 1000 записей)
    if (logSheet.getLastRow() > 1000) {
      logSheet.deleteRow(2);
    }
    
  } catch (error) {
    Logger.log('Ошибка логирования изменения статуса: ' + error.toString());
  }
}

// Запустите эту функцию один раз в GAS
function setupOnEditTrigger() {
  try {
    // Удаляем старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onEdit') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Создаем новый триггер
    ScriptApp.newTrigger('onEdit')
      .forSpreadsheet(SpreadsheetApp.openById(SHEET_ID))
      .onEdit()
      .create();
    
    Logger.log('✅ Триггер onEdit установлен');
    
  } catch (error) {
    Logger.log('❌ Ошибка установки триггера:', error.toString());
  }
}


