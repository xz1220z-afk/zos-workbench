import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCalendarHtml } from '../src/app/views/calendar-view.mjs';
import { render as renderIntelligence } from '../src/app/views/intelligence-view.mjs';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('mobile high-frequency flows preserve month calendar, intelligence actions and grouped more menu', () => {
  assert.match(renderCalendarHtml({ calendarAnchor: '2026-08-16', calendar: [] }), /calendar-month-grid/);
  assert.match(index, /data-mobile-more-group="business"/);
  assert.match(index, /data-mobile-more-group="knowledge-ai"/);
  assert.match(index, /data-mobile-more-group="personal-system"/);
  const node = { innerHTML: '' };
  renderIntelligence(node, { items: [{ id: 'intel-1', title: 'Astra 模型发布', sourceName: '公开来源' }], filters: {} });
  assert.match(node.innerHTML, /data-intelligence-question="intel-1"/);
  assert.match(node.innerHTML, /data-intelligence-read="intel-1"/);
});
