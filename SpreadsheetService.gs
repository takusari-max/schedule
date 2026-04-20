/**
 * SpreadsheetService: Members / EventVisibility / Config シートの CRUD。
 * スプレッドシート ID はスクリプトプロパティ SPREADSHEET_ID を参照する。
 */

const SHEET_MEMBERS = 'Members';
const SHEET_EVENT_VIS = 'EventVisibility';
const SHEET_CONFIG = 'Config';

const MEMBERS_HEADER = ['Name', 'CalendarID', 'Visible', 'Color'];
const EVENT_VIS_HEADER = ['CalendarID', 'EventKey', 'ShowDetails', 'UpdatedAt'];
const CONFIG_HEADER = ['Key', 'Value'];

const DEFAULT_CONFIG = [
  ['dayStartHour', '8'],
  ['dayEndHour', '20'],
  ['slotMinutes', '15'],
  ['timezone', 'Asia/Tokyo']
];

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('スクリプトプロパティ SPREADSHEET_ID が未設定です。README を参照してセットアップしてください。');
  }
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name, header) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return { sheet, created: true };
  }
  const firstRow = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const hasHeader = header.every((h, i) => firstRow[i] === h);
  if (!hasHeader && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return { sheet, created: false };
}

function setupSpreadsheet() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, SHEET_MEMBERS, MEMBERS_HEADER);
  ensureSheet_(ss, SHEET_EVENT_VIS, EVENT_VIS_HEADER);
  const { sheet: configSheet, created: configCreated } = ensureSheet_(ss, SHEET_CONFIG, CONFIG_HEADER);
  if (configCreated || configSheet.getLastRow() <= 1) {
    configSheet.getRange(2, 1, DEFAULT_CONFIG.length, 2).setValues(DEFAULT_CONFIG);
  }
  return 'setup done';
}

function getMembers_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, MEMBERS_HEADER.length).getValues();
  return values
    .map(row => ({
      name: String(row[0] || '').trim(),
      calendarId: String(row[1] || '').trim(),
      visible: row[2] === true || String(row[2]).toUpperCase() === 'TRUE',
      color: String(row[3] || '').trim()
    }))
    .filter(m => m.calendarId);
}

function setMemberVisibleInternal_(calendarId, visible) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) throw new Error('Members シートがありません。setupSpreadsheet を実行してください。');
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const range = sheet.getRange(2, 1, last - 1, MEMBERS_HEADER.length);
  const values = range.getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][1]).trim() === calendarId) {
      sheet.getRange(i + 2, 3).setValue(visible ? true : false);
      return true;
    }
  }
  return false;
}

function getEventVisibilityMap_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_EVENT_VIS);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, EVENT_VIS_HEADER.length).getValues();
  const map = {};
  values.forEach(row => {
    const key = row[0] + '\t' + row[1];
    map[key] = row[2] === true || String(row[2]).toUpperCase() === 'TRUE';
  });
  return map;
}

function upsertEventVisibility_(calendarId, eventKey, showDetails) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_EVENT_VIS);
  if (!sheet) throw new Error('EventVisibility シートがありません。setupSpreadsheet を実行してください。');
  const last = sheet.getLastRow();
  const now = new Date();
  if (last >= 2) {
    const values = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === calendarId && String(values[i][1]) === eventKey) {
        sheet.getRange(i + 2, 3, 1, 2).setValues([[showDetails ? true : false, now]]);
        return;
      }
    }
  }
  sheet.appendRow([calendarId, eventKey, showDetails ? true : false, now]);
}

function getConfigMap_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  const out = {};
  DEFAULT_CONFIG.forEach(([k, v]) => { out[k] = v; });
  if (!sheet || sheet.getLastRow() < 2) return out;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  values.forEach(row => {
    const k = String(row[0] || '').trim();
    if (k) out[k] = String(row[1]);
  });
  return out;
}
