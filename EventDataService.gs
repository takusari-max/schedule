/**
 * EventDataService: Drive 上の event.csv から予定データを読み込み、クライアント向けに整形する。
 *
 * CSV 列:
 *   calendar_id, start_time, end_time, event_name, author, where,
 *   description, is_free_busy, is_google_plus_event, visibility,
 *   published, updated, participants
 */

const CSV_COL = {
  calendar_id: 0,
  start_time: 1,
  end_time: 2,
  event_name: 3,
  author: 4,
  where: 5,
  description: 6,
  is_free_busy: 7,
  is_google_plus_event: 8,
  visibility: 9,
  published: 10,
  updated: 11,
  participants: 12
};

/**
 * 指定された Drive フォルダ配下の event.csv を探して内容を返す。
 */
function readEventCsv_(folderId, fileName) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) {
    throw new Error('CSV ファイルが見つかりません: folderId=' + folderId + ', fileName=' + fileName);
  }
  const file = files.next();
  const blob = file.getBlob();
  // 文字コードを推定: UTF-8 を試し、置換文字が混ざったら Shift_JIS にフォールバック
  let text;
  try {
    text = blob.getDataAsString('UTF-8');
    if (text.indexOf('\uFFFD') !== -1) throw new Error('replacement char detected');
  } catch (e) {
    text = blob.getDataAsString('Shift_JIS');
  }
  return Utilities.parseCsv(text);
}

/**
 * 期間内イベントを全件返す。UI 側の表示対象 (visible=true) フィルタは呼び出し側で行う想定。
 * 返り値: {events: [{calendarId, eventId, eventKey, title, startMs, endMs, allDay}], calendarIds: [...]}
 */
function fetchEventsFromCsv_(folderId, fileName, rangeStart, rangeEnd) {
  const rows = readEventCsv_(folderId, fileName);
  if (rows.length === 0) return { events: [], calendarIds: [] };

  // ヘッダ行を検出 (先頭行が列名と一致すればスキップ)
  let startIdx = 0;
  const first = rows[0].map(v => String(v).trim().toLowerCase());
  if (first[CSV_COL.calendar_id] === 'calendar_id') startIdx = 1;

  const events = [];
  const idSet = {};
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const calendarId = String(row[CSV_COL.calendar_id] || '').trim();
    if (!calendarId) continue;

    const start = parseDateTime_(row[CSV_COL.start_time]);
    const end = parseDateTime_(row[CSV_COL.end_time]);
    if (!start || !end) continue;

    // 期間外は除外
    if (end.getTime() <= rangeStartMs || start.getTime() >= rangeEndMs) continue;

    const allDay = isAllDayRange_(start, end, row[CSV_COL.start_time], row[CSV_COL.end_time]);
    const title = String(row[CSV_COL.event_name] || '').trim() || '(無題)';
    // CSV には event_id 列が無いため、calendar_id + 時刻 + タイトルで複合キーを作る
    const eventKey = calendarId + '|' + start.getTime() + '|' + end.getTime() + '|' + title;

    events.push({
      calendarId: calendarId,
      eventId: eventKey,
      eventKey: eventKey,
      title: title,
      startMs: start.getTime(),
      endMs: end.getTime(),
      allDay: allDay
    });
    idSet[calendarId] = true;
  }

  return { events: events, calendarIds: Object.keys(idSet) };
}

/**
 * 一意の calendar_id 一覧 (期間フィルタなし) を CSV から取得。
 * Members シート自動同期用。
 */
function listCalendarIdsFromCsv_(folderId, fileName) {
  const rows = readEventCsv_(folderId, fileName);
  if (rows.length === 0) return [];
  let startIdx = 0;
  const first = rows[0].map(v => String(v).trim().toLowerCase());
  if (first[CSV_COL.calendar_id] === 'calendar_id') startIdx = 1;
  const set = {};
  for (let i = startIdx; i < rows.length; i++) {
    const id = String((rows[i] && rows[i][CSV_COL.calendar_id]) || '').trim();
    if (id) set[id] = true;
  }
  return Object.keys(set);
}

/**
 * 日時文字列を Date に変換。
 * ISO 8601 を最優先で試し、ダメなら日本式 (YYYY/MM/DD HH:MM(:SS)) を試す。
 */
function parseDateTime_(value) {
  if (value instanceof Date) return value;
  const s = String(value || '').trim();
  if (!s) return null;

  // 1) Date コンストラクタで解釈できるなら採用 (ISO 8601 含む多くの形式)
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1;

  // 2) YYYY/MM/DD HH:MM(:SS) を明示的にパース
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
    const h = Number(m[4] || '0'), mi = Number(m[5] || '0'), se = Number(m[6] || '0');
    const d2 = new Date(y, mo, da, h, mi, se);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

/**
 * 終日判定: 時刻情報が無い (日付のみ) 文字列、または 00:00 開始で 24h ぴったり以上続く場合を終日扱い。
 */
function isAllDayRange_(start, end, rawStart, rawEnd) {
  const noTime = (s) => typeof s === 'string' && !/\d:\d/.test(s);
  if (noTime(rawStart) && noTime(rawEnd)) return true;
  if (start.getHours() === 0 && start.getMinutes() === 0 &&
      end.getHours() === 0 && end.getMinutes() === 0 &&
      (end.getTime() - start.getTime()) % (24 * 3600 * 1000) === 0 &&
      (end.getTime() - start.getTime()) >= 24 * 3600 * 1000) {
    return true;
  }
  return false;
}
