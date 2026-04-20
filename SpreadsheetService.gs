/**
 * SpreadsheetService: Members / Config シートの CRUD と、
 * 別スプレッドシート (電話帳) からの氏名ルックアップ。
 *
 * スプレッドシート ID はスクリプトプロパティ SPREADSHEET_ID を参照する。
 */

const SHEET_MEMBERS = 'Members';
const SHEET_CONFIG = 'Config';

// Members は CalendarID と Visible だけ管理。氏名は電話帳から引く。
const MEMBERS_HEADER = ['CalendarID', 'Visible', 'Color'];
const CONFIG_HEADER = ['Key', 'Value'];

const DEFAULT_CONFIG = [
  ['dayStartHour', '8'],
  ['dayEndHour', '20'],
  ['slotMinutes', '15'],
  ['timezone', 'Asia/Tokyo'],
  ['csvFolderId', '1BWBFBpOpfgX1ly8n77bad7SF4s16jAzf'],
  ['csvFileName', 'events.csv'],
  ['phoneBookId', '1GbWVn7HZ7fPWpiv2GTdpMXksU-SBzCM0UdAc7Bwb02M'],
  ['phoneBookAddressCol', '9'],  // I 列 (1-indexed)
  ['phoneBookNameCol', '6'],     // F 列 (1-indexed)
  ['phoneBookSheet', '']          // 空なら先頭シート
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
  const { sheet: configSheet, created: configCreated } = ensureSheet_(ss, SHEET_CONFIG, CONFIG_HEADER);
  if (configCreated || configSheet.getLastRow() <= 1) {
    configSheet.getRange(2, 1, DEFAULT_CONFIG.length, 2).setValues(DEFAULT_CONFIG);
  } else {
    // 既存シートに不足しているデフォルトキーだけ追記
    const existingKeys = {};
    const last = configSheet.getLastRow();
    configSheet.getRange(2, 1, last - 1, 2).getValues().forEach(r => { existingKeys[String(r[0]).trim()] = true; });
    const toAdd = DEFAULT_CONFIG.filter(([k]) => !existingKeys[k]);
    if (toAdd.length) configSheet.getRange(last + 1, 1, toAdd.length, 2).setValues(toAdd);
  }
  return 'setup done';
}

/**
 * Members シートを読み取り、{calendarId, visible, color} のリストを返す。
 * 氏名は含めない (電話帳ルックアップを Api 側で適用する)。
 */
function getMemberRows_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, MEMBERS_HEADER.length).getValues();
  return values
    .map(row => ({
      calendarId: String(row[0] || '').trim(),
      visible: row[1] === true || String(row[1]).toUpperCase() === 'TRUE',
      color: String(row[2] || '').trim()
    }))
    .filter(m => m.calendarId);
}

/**
 * CSV から取得した calendar_id 一覧で Members シートをリセット再構築する。
 * 既存のデータ行を削除してから、CSV 由来の全 calendar_id を Visible=TRUE で書き込む。
 * Color 等のカスタマイズ情報はリロードのたびに失われる。
 */
function resetMembersFromCalendarIds_(calendarIds) {
  const ss = getSpreadsheet_();
  const { sheet } = ensureSheet_(ss, SHEET_MEMBERS, MEMBERS_HEADER);
  // ヘッダを除くデータ行をクリア
  const last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, MEMBERS_HEADER.length).clearContent();
  }
  const unique = Array.from(new Set(calendarIds.filter(id => id)));
  if (unique.length === 0) return;
  const rows = unique.map(id => [id, true, '']);
  sheet.getRange(2, 1, rows.length, MEMBERS_HEADER.length).setValues(rows);
}

function setMemberVisibleInternal_(calendarId, visible) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) throw new Error('Members シートがありません。setupSpreadsheet を実行してください。');
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const values = sheet.getRange(2, 1, last - 1, MEMBERS_HEADER.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === calendarId) {
      sheet.getRange(i + 2, 2).setValue(visible ? true : false);
      return true;
    }
  }
  // 無ければ新規追加
  sheet.appendRow([calendarId, visible ? true : false, '']);
  return true;
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

/**
 * 電話帳スプレッドシートからアドレス→氏名のマップを返す。
 * デフォルトは I 列=アドレス、F 列=氏名。Config で列番号を変更可能。
 */
function getPhoneBookMap_() {
  const cfg = getConfigMap_();
  const phoneId = String(cfg.phoneBookId || '').trim();
  if (!phoneId) return {};
  const addressCol = Number(cfg.phoneBookAddressCol) || 9;
  const nameCol = Number(cfg.phoneBookNameCol) || 6;
  const sheetName = String(cfg.phoneBookSheet || '').trim();

  let ss;
  try {
    ss = SpreadsheetApp.openById(phoneId);
  } catch (e) {
    throw new Error('電話帳スプレッドシートが開けません: ' + e.message);
  }
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) return {};
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const lastCol = Math.max(addressCol, nameCol);
  const values = sheet.getRange(2, 1, last - 1, lastCol).getValues();
  const map = {};
  values.forEach(row => {
    const addr = String(row[addressCol - 1] || '').trim().toLowerCase();
    const name = String(row[nameCol - 1] || '').trim();
    if (addr) map[addr] = name;
  });
  return map;
}
