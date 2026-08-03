function unfold(content) {
  return String(content || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value) {
  return String(value || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parts(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!match) return null;
  return {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4] || 0), minute: Number(match[5] || 0), second: Number(match[6] || 0),
    utc: Boolean(match[7]), dateOnly: !match[4],
  };
}

function timezoneOffsetMinutes(timeZone, instant) {
  if (!timeZone || timeZone === 'UTC') return 0;
  if (timeZone === 'Asia/Shanghai') return 480;
  try {
    const fields = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
    const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
    return Math.round((asUtc - instant.getTime()) / 60_000);
  } catch {
    return 480;
  }
}

function parseDate(value, parameters = {}) {
  const parsed = parts(value);
  if (!parsed) return { iso: null, allDay: false };
  if (parsed.dateOnly || parameters.VALUE === 'DATE') {
    return { iso: new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).toISOString(), allDay: true };
  }
  const utcMillis = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second);
  if (parsed.utc) return { iso: new Date(utcMillis).toISOString(), allDay: false };
  const offset = timezoneOffsetMinutes(parameters.TZID || 'Asia/Shanghai', new Date(utcMillis));
  return { iso: new Date(utcMillis - offset * 60_000).toISOString(), allDay: false };
}

function property(line) {
  const separator = line.indexOf(':');
  if (separator < 0) return null;
  const head = line.slice(0, separator).split(';');
  const parameters = {};
  for (const item of head.slice(1)) {
    const [key, ...rest] = item.split('=');
    if (key) parameters[key.toUpperCase()] = rest.join('=');
  }
  return { key: head[0].toUpperCase(), parameters, value: line.slice(separator + 1) };
}

function eventFrom(properties) {
  const first = (key) => properties.find((item) => item.key === key);
  const uid = unescapeText(first('UID')?.value);
  const start = first('DTSTART');
  const end = first('DTEND');
  const startValue = parseDate(start?.value, start?.parameters);
  if (!uid || !startValue.iso) return null;
  const endValue = parseDate(end?.value, end?.parameters);
  const privacy = String(first('CLASS')?.value || '').toUpperCase() === 'PRIVATE' ? 'private' : 'work';
  const summary = privacy === 'private' ? '个人安排' : unescapeText(first('SUMMARY')?.value) || '外部日历事项';
  return {
    id: `external-calendar:${uid}:${startValue.iso}`,
    externalId: uid,
    title: summary,
    startAt: startValue.iso,
    endAt: endValue.iso || startValue.iso,
    allDay: startValue.allDay,
    company: privacy === 'private' ? 'life' : 'ceo',
    source: 'external_ics',
    privacy,
    owner: null,
    sourceUpdatedAt: parseDate(first('LAST-MODIFIED')?.value || first('DTSTAMP')?.value).iso,
  };
}

export function parseIcsCalendar(content) {
  const events = [];
  let current = null;
  for (const line of unfold(content)) {
    if (line === 'BEGIN:VEVENT') current = [];
    else if (line === 'END:VEVENT') {
      const event = eventFrom(current || []);
      if (event) events.push(event);
      current = null;
    } else if (current) {
      const parsed = property(line);
      if (parsed) current.push(parsed);
    }
  }
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.externalId}:${event.startAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.startAt.localeCompare(right.startAt));
}
