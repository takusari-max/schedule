/**
 * CalendarService: CalendarApp を使って期間内のイベントを取得し、
 * クライアントへ返す JSON 向けに整形する。
 */

function fetchEventsForMember_(calendarId, startDate, endDate) {
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      return { accessible: false, events: [], error: 'カレンダーが見つかりません' };
    }
    const events = calendar.getEvents(startDate, endDate);
    return {
      accessible: true,
      events: events.map(ev => mapEvent_(calendarId, ev))
    };
  } catch (err) {
    return { accessible: false, events: [], error: String(err && err.message || err) };
  }
}

function mapEvent_(calendarId, ev) {
  const start = ev.getStartTime();
  const end = ev.getEndTime();
  const allDay = ev.isAllDayEvent();
  // 繰り返し予定は getId() がシリーズで同一。開始時刻も組み合わせて一意化する。
  const eventKey = ev.getId() + '@' + start.getTime();
  return {
    calendarId: calendarId,
    eventId: ev.getId(),
    eventKey: eventKey,
    title: ev.getTitle() || '(無題)',
    startMs: start.getTime(),
    endMs: end.getTime(),
    allDay: allDay
  };
}
