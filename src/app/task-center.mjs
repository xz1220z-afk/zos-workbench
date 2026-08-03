const VALID_PRIORITIES = new Set([0, 1, 2, 3]);
const COMPLETED_STATES = new Set(['done', 'completed', 'cancelled']);

function uniqueStrings(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function legacyEndOfDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? `${value}T23:59:59.999+08:00`
    : null;
}

function normalizeSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      ...item,
      id: String(item?.id || `subtask-${index + 1}`),
      title: String(item?.title || '').trim(),
      completed: Boolean(item?.completed),
    }))
    .filter((item) => item.title);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => ({
    id: String(item?.id || `attachment-${index + 1}`),
    name: String(item?.name || '').trim(),
    type: String(item?.type || '').trim(),
    size: Math.max(0, Number(item?.size) || 0),
    url: String(item?.url || '').trim(),
  })).filter((item) => item.name || item.url);
}

function zonedDateParts(value, timeZone) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const entries = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]);
  const parts = Object.fromEntries(entries);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function compareByTime(left, right) {
  return String(left.startAt || left.dueAt || '').localeCompare(String(right.startAt || right.dueAt || ''));
}

export function normalizeTask(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('task title is required');
  const priority = Number(input.priority);
  return {
    ...input,
    title,
    description: String(input.description ?? input.desc ?? ''),
    status: String(input.status || 'todo'),
    startAt: input.startAt || null,
    dueAt: input.dueAt || legacyEndOfDay(input.dueDate),
    allDay: Boolean(input.allDay),
    priority: VALID_PRIORITIES.has(priority) ? priority : 0,
    tags: uniqueStrings(input.tags),
    listId: input.listId || null,
    company: input.company || 'ceo',
    projectId: input.projectId || null,
    businessEntityType: input.businessEntityType || null,
    businessEntityId: input.businessEntityId || null,
    assigneeIds: uniqueStrings(input.assigneeIds),
    estimateMinutes: positiveIntegerOrNull(input.estimateMinutes),
    reminderAt: input.reminderAt || null,
    recurrence: input.recurrence || null,
    subtasks: normalizeSubtasks(input.subtasks),
    attachments: normalizeAttachments(input.attachments),
    focusMinutes: Math.max(0, Number(input.focusMinutes) || 0),
    focusCount: Math.max(0, Number(input.focusCount) || 0),
  };
}

export function taskCompletion(task = {}) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const total = subtasks.length;
  const completed = subtasks.filter((item) => item.completed).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function toggleSubtask(task, subtaskId) {
  let found = false;
  const subtasks = (Array.isArray(task?.subtasks) ? task.subtasks : []).map((item) => {
    if (item.id !== subtaskId) return item;
    found = true;
    return { ...item, completed: !item.completed };
  });
  if (!found) throw new Error('subtask not found');
  return { ...task, subtasks };
}

export function groupAgenda(tasks = [], options = {}) {
  const date = String(options.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('agenda date is required');
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const groups = {
    overdue: [], allDay: [], morning: [], afternoon: [], evening: [], unscheduled: [],
  };

  for (const input of tasks) {
    const task = normalizeTask(input);
    if (COMPLETED_STATES.has(task.status)) continue;
    const start = zonedDateParts(task.startAt, timeZone);
    const due = zonedDateParts(task.dueAt, timeZone);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(task.dueDate || '')) ? task.dueDate : due?.date;

    if (dueDate && dueDate < date) {
      groups.overdue.push(task);
      continue;
    }
    if (task.allDay && (task.dueDate === date || start?.date === date || due?.date === date)) {
      groups.allDay.push(task);
      continue;
    }
    if (start?.date === date) {
      if (start.hour < 12) groups.morning.push(task);
      else if (start.hour < 18) groups.afternoon.push(task);
      else groups.evening.push(task);
      continue;
    }
    if (!task.startAt && dueDate === date) {
      groups.allDay.push(task);
      continue;
    }
    if (!task.startAt && !task.dueAt && !task.dueDate) groups.unscheduled.push(task);
  }

  for (const key of ['overdue', 'allDay', 'morning', 'afternoon', 'evening']) groups[key].sort(compareByTime);
  return groups;
}
