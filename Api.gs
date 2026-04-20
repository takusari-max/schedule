/**
 * Api.gs: google.script.run から呼び出されるクライアント公開関数。
 */

function getConfig() {
  const config = getConfigMap_();
  const memberRows = getMemberRows_();
  const members = resolveMemberNames_(memberRows);
  return { members: members, config: config };
}

function getSchedules(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('日付が不正です: ' + startISO + ' / ' + endISO);
  }
  if (end <= start) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  const config = getConfigMap_();
  const folderId = String(config.csvFolderId || '').trim();
  const fileName = String(config.csvFileName || 'events.csv').trim();
  if (!folderId) throw new Error('Config シートに csvFolderId が未設定です。');

  // CSV から期間内イベントを取得
  const { events, calendarIds } = fetchEventsFromCsv_(folderId, fileName, start, end);

  // 新しく登場した calendar_id は Members シートに自動登録 (Visible=TRUE)
  syncMembersFromCalendarIds_(calendarIds);

  // Members で visible=TRUE のものだけを残す
  const memberRows = getMemberRows_();
  const visibleSet = {};
  memberRows.forEach(m => { if (m.visible) visibleSet[m.calendarId] = true; });

  const filtered = events.filter(ev => visibleSet[ev.calendarId]);

  const members = resolveMemberNames_(memberRows);
  return { events: filtered, members: members };
}

function setMemberVisible(calendarId, visible) {
  const ok = setMemberVisibleInternal_(String(calendarId), !!visible);
  return { ok: ok };
}

/**
 * Members シート行と電話帳を結合し、表示用の氏名を付与する。
 */
function resolveMemberNames_(memberRows) {
  let phoneMap = {};
  try {
    phoneMap = getPhoneBookMap_();
  } catch (e) {
    // 電話帳が読めなくてもメンバー一覧は返す
    console.warn('電話帳取得失敗: ' + (e && e.message));
  }
  return memberRows.map(m => {
    const key = m.calendarId.toLowerCase();
    const name = phoneMap[key] || m.calendarId;
    return {
      calendarId: m.calendarId,
      name: name,
      visible: m.visible,
      color: m.color
    };
  });
}
