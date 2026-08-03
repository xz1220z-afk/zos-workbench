function uniqueStrings(value) {
  const values = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  return [...new Set(values.flatMap((item) => String(item || '').split(/[、,，;；]/)).map((item) => item.trim()).filter(Boolean))];
}

function dateKey(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function overlaps(left, right) {
  if (!left.startAt || !left.endAt || !right.startAt || !right.endAt) return false;
  return new Date(left.startAt) < new Date(right.endAt) && new Date(right.startAt) < new Date(left.endAt);
}

function inRange(record, startDate, endDate) {
  const key = dateKey(record.shootingDate || record.startAt);
  return key && key >= startDate && key <= endDate;
}

export function queryAvailability(records = [], options = {}) {
  const startDate = String(options.startDate || options.date || '').slice(0, 10);
  const endDate = String(options.endDate || options.date || startDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    throw new Error('valid availability date range is required');
  }
  const selected = records.filter((record) => inRange(record, startDate, endDate)).map((record) => ({
    ...record,
    members: uniqueStrings(record.members),
    roles: uniqueStrings(record.roles),
    location: String(record.location || ''),
  })).sort((left, right) => String(left.startAt || left.shootingDate).localeCompare(String(right.startAt || right.shootingDate)));

  const assignments = selected.map((record) => ({
    projectId: record.id,
    projectName: record.projectName,
    clientName: record.clientName || '',
    shootingDate: dateKey(record.shootingDate || record.startAt),
    startAt: record.startAt || null,
    endAt: record.endAt || null,
    location: record.location,
    owner: record.owner || '',
    members: record.members,
    roles: record.roles,
  }));
  const unassigned = selected.filter((record) => record.members.length === 0);
  const gaps = selected.map((record) => {
    const fields = [];
    if (!record.startAt || !record.endAt) fields.push('time');
    if (!record.location) fields.push('location');
    if (!record.members.length) fields.push('members');
    if (!record.roles.length) fields.push('roles');
    return fields.length ? { projectId: record.id, fields } : null;
  }).filter(Boolean);

  const byPerson = new Map();
  for (const record of selected) {
    for (const person of record.members) {
      if (!byPerson.has(person)) byPerson.set(person, []);
      byPerson.get(person).push(record);
    }
  }
  const conflicts = [];
  for (const [person, rows] of byPerson) {
    for (let index = 0; index < rows.length; index += 1) {
      for (let other = index + 1; other < rows.length; other += 1) {
        if (overlaps(rows[index], rows[other])) {
          conflicts.push({ person, projectIds: [rows[index].id, rows[other].id] });
        }
      }
    }
  }
  const occupancy = [...byPerson.entries()].map(([person, rows]) => ({
    person,
    projectIds: rows.map((record) => record.id),
    intervals: rows.filter((record) => record.startAt && record.endAt).map((record) => ({ startAt: record.startAt, endAt: record.endAt })),
  }));
  const privateBusyBlocks = (options.busyBlocks || []).filter((block) => block.privacy === 'private')
    .filter((block) => inRange({ shootingDate: block.startAt }, startDate, endDate))
    .map((block) => ({ id: block.id, title: '个人安排', startAt: block.startAt, endAt: block.endAt, privacy: 'private' }));

  let availabilityState = 'scheduled_no_conflict';
  if (!selected.length) availabilityState = 'no_schedule_evidence';
  else if (unassigned.length) availabilityState = 'insufficient_roster_evidence';
  else if (conflicts.length) availabilityState = 'conflict_detected';
  else if (gaps.some((gap) => gap.fields.includes('time'))) availabilityState = 'partial_schedule_evidence';

  return {
    startDate, endDate, availabilityState, assignments, occupancy,
    conflicts, unassigned, gaps, privateBusyBlocks,
  };
}
