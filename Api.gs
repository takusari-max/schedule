/**
 * Api.gs: google.script.run から呼び出されるクライアント公開関数。
 */

function getConfig() {
  const members = getMembers_();
  const config = getConfigMap_();
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

  const members = getMembers_().filter(m => m.visible);
  const visMap = getEventVisibilityMap_();
  const allEvents = [];
  const unavailable = [];

  members.forEach(member => {
    const result = fetchEventsForMember_(member.calendarId, start, end);
    if (!result.accessible) {
      unavailable.push({ calendarId: member.calendarId, name: member.name, error: result.error });
      return;
    }
    result.events.forEach(ev => {
      const visKey = ev.calendarId + '\t' + ev.eventKey;
      ev.showDetails = visMap[visKey] === true;
      allEvents.push(ev);
    });
  });

  return { events: allEvents, unavailable: unavailable };
}

function setMemberVisible(calendarId, visible) {
  const ok = setMemberVisibleInternal_(String(calendarId), !!visible);
  return { ok: ok };
}

function setEventShowDetails(calendarId, eventKey, showDetails) {
  upsertEventVisibility_(String(calendarId), String(eventKey), !!showDetails);
  return { ok: true };
}
