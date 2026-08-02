import { humanText } from './value-utils.mjs';

export const CEO_BRIEF_SECTIONS = Object.freeze([
  'yesterday',
  'todayTop3',
  'targetGaps',
  'risks',
  'decisions',
  'cashAndDelivery',
  'aiSuggestions',
  'freshness',
]);

const HEADINGS = Object.freeze({
  yesterday: '昨日复盘',
  todayTop3: '今日 Top 3',
  targetGaps: '目标差距',
  risks: '风险',
  decisions: '待我决策',
  cashAndDelivery: '现金与交付',
  aiSuggestions: 'AI 建议',
  freshness: '数据新鲜度',
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

// Small synchronous SHA-256 implementation so the same module works in browsers and Node.
function sha256(text) {
  const maxWord = 2 ** 32;
  const words = [];
  const hash = [];
  const constants = [];
  const composite = {};
  let primeCounter = 0;
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (composite[candidate]) continue;
    for (let multiple = candidate * candidate; multiple < 313; multiple += candidate) composite[multiple] = true;
    if (primeCounter < 8) hash[primeCounter] = (candidate ** 0.5 * maxWord) | 0;
    constants[primeCounter] = (candidate ** (1 / 3) * maxWord) | 0;
    primeCounter += 1;
  }

  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) words.push(byte);
  const bitLength = words.length * 8;
  words.push(0x80);
  while ((words.length % 64) !== 56) words.push(0);
  const high = Math.floor(bitLength / maxWord);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) words.push((high >>> shift) & 255);
  for (let shift = 24; shift >= 0; shift -= 8) words.push((low >>> shift) & 255);

  for (let offset = 0; offset < words.length; offset += 64) {
    const schedule = new Array(64);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      schedule[index] = ((words[start] << 24) | (words[start + 1] << 16) | (words[start + 2] << 8) | words[start + 3]) | 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const left = schedule[index - 15];
      const right = schedule[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      schedule[index] = (schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1) | 0;
    }

    const state = hash.slice(0, 8);
    for (let index = 0; index < 64; index += 1) {
      const [a, b, c, d, e, f, g, h] = state;
      const upper1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + upper1 + choice + constants[index] + schedule[index]) | 0;
      const upper0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (upper0 + majority) | 0;
      state.unshift((temp1 + temp2) | 0);
      state[4] = (state[4] + temp1) | 0;
      state.pop();
    }
    for (let index = 0; index < 8; index += 1) hash[index] = (hash[index] + state[index]) | 0;
  }

  return hash.map((word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

export function briefFingerprint(input) {
  return sha256(JSON.stringify(stableValue(input)));
}

function previousDate(date) {
  const instant = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) throw new Error('date must be YYYY-MM-DD');
  instant.setUTCDate(instant.getUTCDate() - 1);
  return instant.toISOString().slice(0, 10);
}

function safeTask(task) {
  return {
    id: String(task.id || ''),
    title: String(task.title || '').trim(),
    status: String(task.status || ''),
    priority: Number.isFinite(task.priority) ? task.priority : null,
    dueDate: task.dueDate || null,
    completedAt: task.completedAt || null,
  };
}

function pickNumbers(summary, keys) {
  return keys.reduce((result, key) => {
    if (typeof summary?.[key] === 'number' && Number.isFinite(summary[key])) result[key] = summary[key];
    return result;
  }, {});
}

function buildSections(input = {}, date) {
  const tasks = Array.isArray(input.tasks) ? input.tasks.map(safeTask).filter((task) => task.id && task.title) : [];
  const yesterday = previousDate(date);
  const completedYesterday = tasks
    .filter((task) => task.status === 'done' && String(task.completedAt || '').slice(0, 10) === yesterday)
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));
  const dueTasks = tasks
    .filter((task) => task.status !== 'done' && (!task.dueDate || task.dueDate <= date))
    .sort((left, right) => (right.priority || 0) - (left.priority || 0)
      || String(left.dueDate || '').localeCompare(String(right.dueDate || ''))
      || left.id.localeCompare(right.id, 'zh-CN'))
    .slice(0, 3);
  const decisionActions = (Array.isArray(input.decisions) ? input.decisions : [])
    .filter((item) => item.status === 'open')
    .sort((left, right) => ({ high: 0, medium: 1, low: 2 }[left.severity] ?? 3)
      - ({ high: 0, medium: 1, low: 2 }[right.severity] ?? 3)
      || String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN'))
    .map((item) => ({
      id: `decision:${String(item.id || '')}`,
      title: humanText(item.factSummary || item.title, '待核对经营事项'),
      status: 'open',
      priority: item.severity === 'high' ? 3 : 2,
      dueDate: date,
      sourceType: 'decision',
      sourceId: String(item.id || ''),
    }))
    .filter((item) => item.sourceId && item.title !== '待核对经营事项');
  const seen = new Set(dueTasks.map((item) => item.title));
  const todayTop3 = [...dueTasks];
  for (const action of decisionActions) {
    if (todayTop3.length >= 3) break;
    if (!seen.has(action.title)) {
      todayTop3.push(action);
      seen.add(action.title);
    }
  }

  return {
    yesterday: completedYesterday,
    todayTop3,
    targetGaps: stableValue(Array.isArray(input.targetGaps) ? input.targetGaps : []),
    risks: stableValue(Array.isArray(input.risks) ? input.risks : []),
    decisions: stableValue((Array.isArray(input.decisions) ? input.decisions : []).filter((item) => ['open', 'pending_resolution'].includes(item.status))),
    cashAndDelivery: {
      wanjia: pickNumbers(input.wanjia?.summary, ['paymentGmv', 'redeemedGmv', 'estimatedCommission']),
      huahuo: pickNumbers(input.huahuo?.summary, ['receivedAmount', 'outstandingAmount', 'pendingDeliveries']),
    },
    aiSuggestions: stableValue(Array.isArray(input.aiSuggestions) ? input.aiSuggestions.map(String) : []),
    freshness: stableValue(Array.isArray(input.health) ? input.health : []),
  };
}

export function generateCeoBrief(input = {}, options = {}) {
  const date = String(options.date || '').trim();
  if (!date) throw new Error('date is required');
  const now = String(options.now || `${date}T07:30:00.000Z`);
  const sections = buildSections(input, date);
  const fingerprint = briefFingerprint(sections);
  return {
    id: `daily-brief:${date}:${fingerprint.slice(0, 16)}`,
    kind: 'daily_brief',
    date,
    generatedAt: now,
    reviewStatus: 'pending_review',
    fingerprint,
    sections,
  };
}

export function shouldGenerateBrief(existing = [], input = {}, options = {}) {
  const date = String(options.date || '').trim();
  if (!date) throw new Error('date is required');
  const fingerprint = briefFingerprint(buildSections(input, date));
  return !(Array.isArray(existing) ? existing : []).some((brief) => brief.date === date && brief.fingerprint === fingerprint);
}

function markdownValue(value) {
  if (Array.isArray(value)) return value.length ? value.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n') : '- 暂无';
  const entries = Object.entries(value || {});
  return entries.length ? entries.map(([key, item]) => `- ${key}: ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n') : '- 暂无';
}

export function ceoBriefToMarkdown(brief) {
  const lines = [
    `# CEO 每日简报｜${brief.date}`,
    '',
    '> 状态：待人工审核。不会自动外发或写入业务事实源。',
  ];
  for (const key of CEO_BRIEF_SECTIONS) {
    lines.push('', `## ${HEADINGS[key]}`, '', markdownValue(brief.sections?.[key]));
  }
  return `${lines.join('\n')}\n`;
}
