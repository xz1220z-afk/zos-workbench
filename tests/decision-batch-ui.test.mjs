import test from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../src/app/views/decision-view.mjs';

function history(id, status = 'approved') {
  return {
    id, status, source: 'wanjia', sourceRecordId: id,
    factSummary: `历史事项 ${id}`, decisionNote: '已处理',
  };
}

test('history rows expose accessible selection and a visible batch action bar', () => {
  const container = { innerHTML: '' };
  render(container, {
    decisions: [history('a'), history('b', 'deferred')],
    decisionUi: { selectedIds: ['a'], historyLimit: 6, followUpLimit: 6 },
  });

  assert.match(container.innerHTML, /data-decision-select="a"/);
  assert.match(container.innerHTML, /aria-label="选择历史事项 a"/);
  assert.match(container.innerHTML, /data-decision-select-visible/);
  assert.match(container.innerHTML, /已选择 1 条/);
  assert.match(container.innerHTML, /data-decision-batch="review_history"/);
  assert.match(container.innerHTML, /data-decision-batch="reopen"/);
  assert.match(container.innerHTML, /data-decision-selection-clear/);
});

test('select visible only receives the currently filtered and paged history ids', () => {
  const container = { innerHTML: '' };
  render(container, {
    decisions: [history('wanjia-a'), { ...history('huahuo-b'), source: 'huahuo' }],
    decisionUi: { selectedIds: [], company: 'wanjia', historyLimit: 6, followUpLimit: 6 },
  });

  assert.match(container.innerHTML, /data-decision-visible-ids="wanjia-a"/);
  assert.doesNotMatch(container.innerHTML, /data-decision-select="huahuo-b"/);
});
