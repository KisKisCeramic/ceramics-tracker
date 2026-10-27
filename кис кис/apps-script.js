/**
 * Google Apps Script для интеграции с таблицей "керамика кис кис"
 * 
 * ИНСТРУКЦИЯ ПО УСТАНОВКЕ:
 * 1. Откройте таблицу
 * 2. Расширения → Apps Script
 * 3. Вставьте этот код, сохраните
 * 4. Развернуть → Веб-приложение
 * 5. Доступ: Все, у кого есть ссылка
 */

// ═══ КОНFIGУРАЦИЯ ═══
const SHEET_SALES = 'Продажи';
const SHEET_PRODUCTS = 'Товары';
const SHEET_SHIFTS = 'Смены';

// ═══ ИНИЦИАЛИЗАЦИЯ ЛИСТОВ ═══
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Лист продаж
  let salesSheet = ss.getSheetByName(SHEET_SALES);
  if (!salesSheet) {
    salesSheet = ss.insertSheet(SHEET_SALES);
    salesSheet.appendRow(['Дата', 'Артикул', 'Название', 'Цена', 'Кол-во', 'Сумма', 'Смена', 'Оплата']);
    salesSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    salesSheet.setFrozenRows(1);
  }
  
  // Лист товаров
  let productsSheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!productsSheet) {
    productsSheet = ss.insertSheet(SHEET_PRODUCTS);
    productsSheet.appendRow(['Артикул', 'Название', 'Цена', 'Остаток', 'Продано']);
    productsSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    productsSheet.setFrozenRows(1);
  } else {
    const header = productsSheet.getRange(1, 1, 1, 5).getValues()[0];
    if (!header[4]) {
      productsSheet.getRange(1, 5).setValue('Продано');
      productsSheet.getRange(1, 5).setFontWeight('bold');
    }
  }
  
  // Лист смен
  let shiftsSheet = ss.getSheetByName(SHEET_SHIFTS);
  if (!shiftsSheet) {
    shiftsSheet = ss.insertSheet(SHEET_SHIFTS);
    shiftsSheet.appendRow(['Смена', 'Дата открытия', 'Время открытия', 'Дата закрытия', 'Время закрытия', 'Время работы (мин)', 'Выручка', 'Продано (шт)', 'Топ продаж']);
    shiftsSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    shiftsSheet.setFrozenRows(1);
  }
}

// ═══ GET — получение данных ═══
function doGet(e) {
  const action = e.parameter.action || 'sales';
  
  try {
    initSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'sales') {
      const sheet = ss.getSheetByName(SHEET_SALES);
      const data = sheet.getDataRange().getValues();
      return jsonResponse({ success: true, data: data.slice(1) });
    }
    
    if (action === 'products') {
      const sheet = ss.getSheetByName(SHEET_PRODUCTS);
      const data = sheet.getDataRange().getValues();
      return jsonResponse({ success: true, data: data.slice(1) });
    }
    
    if (action === 'shifts') {
      const sheet = ss.getSheetByName(SHEET_SHIFTS);
      const data = sheet.getDataRange().getValues();
      return jsonResponse({ success: true, data: data.slice(1) });
    }
    
    return jsonResponse({ success: false, error: 'Неизвестное действие' });
    
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ═══ POST — запись данных ═══
function doPost(e) {
  try {
    initSheets();
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Ошибка парсинга JSON: ' + parseErr.toString() });
    }
    const action = body.action;
    
    if (action === 'sale') {
      return recordSale(body);
    }
    
    if (action === 'shift') {
      return recordShift(body);
    }
    
    if (action === 'updateStock') {
      return updateStock(body);
    }
    
    if (action === 'syncProducts') {
      return syncProducts(body);
    }
    
    if (action === 'deleteProducts') {
      return deleteProducts(body);
    }
    
    if (action === 'openShift') {
      return openShift(body);
    }
    
    if (action === 'closeShift') {
      return closeShift(body);
    }
    
    return jsonResponse({ success: false, error: 'Неизвестное действие: ' + action });
    
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ═══ ОТКРЫТИЕ СМЕНЫ ═══
function openShift(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SHIFTS);
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  const shiftId = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  
  // Проверяем, есть ли открытая смена
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === '' || data[i][4] === null) {
      return jsonResponse({ success: false, error: 'Уже есть открытая смена. Сначала закройте предыдущую.' });
    }
  }
  
  sheet.appendRow([shiftId, dateStr, timeStr, '', '', '', '', '', '']);
  
  return jsonResponse({ 
    success: true, 
    message: 'Смена открыта: ' + shiftId,
    shiftId: shiftId,
    date: dateStr,
    time: timeStr
  });
}

// ═══ ЗАКРЫТИЕ СМЕНЫ С ИТОГАМИ ═══
function closeShift(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SHIFTS);
  const salesSheet = ss.getSheetByName(SHEET_SALES);
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  // Находим открытую смену
  const data = sheet.getDataRange().getValues();
  let openShiftRow = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === '' || data[i][4] === null) {
      openShiftRow = i + 1;
      break;
    }
  }
  
  if (!openShiftRow) {
    return jsonResponse({ success: false, error: 'Нет открытой смены.' });
  }
  
  const shiftId = data[openShiftRow - 1][0];
  const openDate = data[openShiftRow - 1][1];
  const openTime = data[openShiftRow - 1][2];
  
  // Считаем время работы в минутах
  let diffMinutes = 0;
  try {
    const dateStrOpen = String(openDate);
    const timeStrOpen = String(openTime);
    const dParts = dateStrOpen.split('.');
    const tParts = timeStrOpen.split(':');
    if (dParts.length === 3 && tParts.length >= 2) {
      const day = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10);
      const year = parseInt(dParts[2], 10);
      const hours = parseInt(tParts[0], 10);
      const minutes = parseInt(tParts[1], 10);
      const seconds = tParts.length > 2 ? parseInt(tParts[2], 10) : 0;
      const openDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
      const diffMs = now.getTime() - openDateTime.getTime();
      diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    }
  } catch (e) {
    diffMinutes = 0;
  }
  
  // Получаем продажи за смену
  const salesData = salesSheet.getDataRange().getValues();
  let totalRevenue = 0;
  let totalCount = 0;
  let cashTotal = 0;
  let nonCashTotal = 0;
  const topSales = {};
  
  for (let i = 1; i < salesData.length; i++) {
    const saleShift = salesData[i][6];
    if (saleShift === shiftId) {
      const price = Number(salesData[i][3]) || 0;
      const qty = Number(salesData[i][4]) || 0;
      const sum = price * qty;
      totalRevenue += sum;
      totalCount += qty;
      
      const payment = String(salesData[i][7] || 'cash');
      if (payment === 'cash') {
        cashTotal += sum;
      } else if (payment === 'noncash') {
        nonCashTotal += sum;
      }
      
      const name = salesData[i][2];
      topSales[name] = (topSales[name] || 0) + qty;
    }
  }
  
  // Топ продаж (сортируем)
  const topSalesStr = Object.entries(topSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => name + ' (' + count + ')')
    .join(', ');
  
  // Записываем итоги
  sheet.getRange(openShiftRow, 4).setValue(dateStr);
  sheet.getRange(openShiftRow, 5).setValue(timeStr);
  sheet.getRange(openShiftRow, 6).setValue(diffMinutes);
  sheet.getRange(openShiftRow, 7).setValue(totalRevenue);
  sheet.getRange(openShiftRow, 8).setValue(totalCount);
  sheet.getRange(openShiftRow, 9).setValue(topSalesStr || 'Нет продаж');
  
  // Смена закрыта — отмечаем строку красным для чёткого отслеживания
  sheet.getRange(openShiftRow, 1, 1, 9).setBackground('#FFCDD2');
  
  return jsonResponse({ 
    success: true, 
    message: 'Смена закрыта',
    shiftId: shiftId,
    date: dateStr,
    time: timeStr,
    workMinutes: diffMinutes,
    revenue: totalRevenue,
    cashTotal: cashTotal,
    nonCashTotal: nonCashTotal,
    count: totalCount,
    topSales: topSalesStr || 'Нет продаж'
  });
}

// ═══ ЗАПИСЬ ПРОДАЖИ ═══
function recordSale(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SALES);
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
  const sku = body.sku;
  const name = body.name;
  const price = Number(body.price) || 0;
  const qty = Number(body.qty) || 1;
  const sum = price * qty;
  const shiftId = body.shiftId || '';
  const payment = body.payment || '';
  
  sheet.appendRow([dateStr, sku, name, price, qty, sum, shiftId, payment]);
  
  // Обновляем остаток и продано в листе товаров
  const productsSheet = ss.getSheetByName(SHEET_PRODUCTS);
  const productsData = productsSheet.getDataRange().getValues();
  
  for (let i = 1; i < productsData.length; i++) {
    if (productsData[i][0] === sku) {
      const currentStock = Number(productsData[i][3]) || 0;
      productsSheet.getRange(i + 1, 4).setValue(Math.max(0, currentStock - qty));
      
      const currentSold = Number(productsData[i][4]) || 0;
      productsSheet.getRange(i + 1, 5).setValue(currentSold + qty);
      break;
    }
  }
  
  return jsonResponse({ 
    success: true, 
    message: 'Продажа записана: ' + name,
    stock_removed: qty 
  });
}

// ═══ ЗАПИСЬ ПРОДАЖ ЗА СМЕНУ ═══
function recordShift(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SALES);
  const productsSheet = ss.getSheetByName(SHEET_PRODUCTS);
  
  const sales = body.sales || [];
  if (sales.length === 0) {
    return jsonResponse({ success: false, error: 'Нет продаж для записи' });
  }
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
  const shiftId = body.shiftId || '';
  
  // Получаем текущые остатки
  const productsData = productsSheet.getDataRange().getValues();
  const stockMap = {};
  for (let i = 1; i < productsData.length; i++) {
    stockMap[productsData[i][0]] = Number(productsData[i][3]) || 0;
  }
  
  let recorded = 0;
  sales.forEach(s => {
    const sku = s.sku;
    const name = s.name;
    const price = Number(s.price) || 0;
    const qty = Number(s.qty) || 1;
    const sum = price * qty;
    const payment = s.payment || 'cash';
    
    sheet.appendRow([dateStr, sku, name, price, qty, sum, shiftId, payment]);
    
    if (stockMap[sku] !== undefined) {
      stockMap[sku] = Math.max(0, stockMap[sku] - qty);
    }
    recorded++;
  });
  
  // Записываем обновлённые остатки и продано
  for (let i = 1; i < productsData.length; i++) {
    const sku = productsData[i][0];
    if (stockMap[sku] !== undefined) {
      productsSheet.getRange(i + 1, 4).setValue(stockMap[sku]);
    }
    const currentSold = Number(productsData[i][4]) || 0;
    const soldInShift = sales.filter(s => s.sku === sku).reduce((sum, s) => sum + (Number(s.qty) || 1), 0);
    productsSheet.getRange(i + 1, 5).setValue(currentSold + soldInShift);
  }
  
  return jsonResponse({ 
    success: true, 
    message: 'Записано продаж: ' + recorded,
    total: recorded
  });
}

// ═══ ОБНОВЛЕНИЕ ОСТАТКА ═══
function updateStock(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUCTS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sku) {
      sheet.getRange(i + 1, 4).setValue(Number(body.stock) || 0);
      return jsonResponse({ success: true, message: 'Остаток обновлён: ' + body.sku });
    }
  }
  
  // Товар не найден — добавляем новый
  sheet.appendRow([body.sku, body.name || '', Number(body.price) || 0, Number(body.stock) || 0, 0]);
  return jsonResponse({ success: true, message: 'Товар добавлен: ' + body.sku });
}

// ═══ СИНХРОНИЗАЦИЯ ТОВАРОВ ═══
function syncProducts(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUCTS);
  
  // Полностью очищаем лист и пересоздаём
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Записываем новые данные
  const products = body.products || [];
  products.forEach(p => {
    sheet.appendRow([p.sku, p.name, p.price, p.stock, p.sold || 0]);
  });
  
  return jsonResponse({ success: true, message: 'Товары синхронизированы: ' + products.length });
}

// ═══ УДАЛЕНИЕ ТОВАРОВ ═══
function deleteProducts(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUCTS);
  
  const skus = body.skus || [];
  if (skus.length === 0) {
    return jsonResponse({ success: false, error: 'Нет товаров для удаления' });
  }
  
  const data = sheet.getDataRange().getValues();
  const toDelete = [];
  for (let i = 1; i < data.length; i++) {
    if (skus.includes(data[i][0])) {
      toDelete.push(i + 1);
    }
  }
  
  // Удаляем строки с конца, чтобы индексы не сбились
  toDelete.reverse().forEach(row => {
    sheet.deleteRow(row);
  });
  
  return jsonResponse({ success: true, message: 'Удалено товаров: ' + toDelete.length });
}

// ═══ JSON RESPONSE ═══
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══ МЕНЮ ═══
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🏺 КераМика')
    .addItem('Открыть смену', 'openShiftMenu')
    .addItem('Закрыть смену', 'closeShiftMenu')
    .addItem('Статистика за сегодня', 'todayStats')
    .addToUi();
}

function openShiftMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = openShift({});
  SpreadsheetApp.getUi().alert(result.getContent());
}

function closeShiftMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = closeShift({});
  SpreadsheetApp.getUi().alert(result.getContent());
}

function todayStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SALES);
  const data = sheet.getDataRange().getValues();
  
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
  let count = 0, sum = 0;
  
  for (let i = 1; i < data.length; i++) {
    const dateCell = data[i][0];
    const dateStr = (dateCell instanceof Date) 
      ? Utilities.formatDate(dateCell, Session.getScriptTimeZone(), 'dd.MM.yyyy')
      : String(dateCell).split(' ')[0];
    if (dateStr === today) {
      count += Number(data[i][4]) || 0;
      sum += Number(data[i][5]) || 0;
    }
  }
  
  SpreadsheetApp.getUi().alert('📊 Статистика за сегодня\n\nПродано: ' + count + ' шт\nВыручка: ' + sum.toLocaleString('ru-RU') + ' ₽');
}
