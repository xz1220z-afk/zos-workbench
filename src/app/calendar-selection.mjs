function validDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeCalendarSelection(startDate, endDate = startDate) {
  if (!validDateKey(startDate) || !validDateKey(endDate)) {
    throw new Error('calendar_selection_invalid');
  }
  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}

export function shouldBeginCalendarSelection({ pointerType = 'mouse', elapsedMs = 0 } = {}) {
  return pointerType !== 'touch' || elapsedMs >= 350;
}

function addMinutes(time, minutes) {
  const [hour, minute] = String(time || '09:00').split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('calendar_selection_time_invalid');
  }
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function calendarSelectionDraft(selection, options = {}) {
  const { startDate, endDate } = normalizeCalendarSelection(selection?.startDate, selection?.endDate);
  if ((options.view || 'month') === 'month') {
    return {
      kind: 'task',
      allDay: true,
      startAt: `${startDate}T00:00`,
      dueAt: `${endDate}T23:59`,
    };
  }
  const startTime = options.startTime || '09:00';
  return {
    kind: 'calendar',
    allDay: false,
    startAt: `${startDate}T${startTime}`,
    endAt: `${endDate}T${addMinutes(startTime, 60)}`,
  };
}
