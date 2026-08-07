import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { render as renderDecisions } from '../src/app/views/decision-view.mjs';

const root = new URL('../', import.meta.url);

test('premium interaction stylesheet defines tactile, accessible decision controls', async () => {
  const css = await readFile(new URL('assets/app.css', root), 'utf8');
  assert.match(css, /--motion-fast:\s*140ms/);
  assert.match(css, /\.v13-action:active[^}]*transform:\s*scale\(\.98\)/s);
  assert.match(css, /:focus-visible[^}]*outline/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.decision-action-drawer/);
  assert.match(css, /\.decision-action-drawer[\s\S]{0,800}min-height:\s*44px/);
  assert.match(css, /\.decision-card:hover[^}]*translateY\(-2px\)/s);
});

test('hundreds of decision history records render progressively instead of blocking first paint', () => {
  const decisions = Array.from({ length: 343 }, (_, index) => ({
    id: `history-${index}`, status: 'approved', factSummary: `历史 ${index}`, decisionNote: '已处理',
  }));
  const container = { innerHTML: '' };
  renderDecisions(container, {
    decisions,
    decisionUi: { historyLimit: 6, followUpLimit: 6, search: '', company: 'all', status: 'all' },
  });
  assert.equal((container.innerHTML.match(/class="decision-history-row/g) || []).length, 6);
  assert.match(container.innerHTML, /data-decision-load-more="history"/);
});
