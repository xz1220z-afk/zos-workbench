const ALLOWED_FIELDS = new Set(['title', 'date', 'monthDay', 'category', 'reminderDays', 'recurring', 'privacy']);
const CATEGORIES = new Set(['relationship', 'ritual', 'family', 'health', 'personal', 'season', 'rest', 'reflection']);

function validMonthDay(value) {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`2000-${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(5, 10) === value;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePrivateDateMetadata(input) {
  let rows;
  try { rows = typeof input === 'string' ? JSON.parse(input) : input; } catch { throw new Error('invalid JSON'); }
  if (!Array.isArray(rows)) throw new Error('date metadata must be an array');
  if (rows.length > 200) throw new Error('maximum 200 records');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`record ${index + 1} is invalid`);
    const unknown = Object.keys(row).find((key) => !ALLOWED_FIELDS.has(key));
    if (unknown) throw new Error(`unsupported field: ${unknown}`);
    const title = String(row.title || '').trim();
    if (!title) throw new Error('title is required');
    if (title.length > 60) throw new Error('title is too long');
    const date = row.date == null || row.date === '' ? null : String(row.date);
    const monthDay = row.monthDay == null || row.monthDay === '' ? null : String(row.monthDay);
    if (!date && !monthDay) throw new Error('date or monthDay is required');
    if (date && !validDate(date)) throw new Error('invalid date');
    if (monthDay && !validMonthDay(monthDay)) throw new Error('invalid monthDay');
    if (row.privacy != null && row.privacy !== 'private') throw new Error('private only');
    const reminderDays = row.reminderDays == null ? [7, 1, 0] : row.reminderDays;
    if (!Array.isArray(reminderDays) || reminderDays.some((value) => !Number.isInteger(value) || value < 0 || value > 365)) {
      throw new Error('invalid reminderDays');
    }
    const category = CATEGORIES.has(row.category) ? row.category : 'personal';
    return {
      title, date, monthDay, category,
      reminderDays: [...new Set(reminderDays)],
      recurring: row.recurring == null ? Boolean(monthDay) : Boolean(row.recurring),
      privacy: 'private',
    };
  });
}
