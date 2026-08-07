import test from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../src/app/views/company-cockpit-view.mjs';

test('company cockpit renders three evidence tiers and preserves specialist entry points', () => {
  const root = { innerHTML: '' };
  render(root, { companyCockpits: { wanjia: {
    company: 'wanjia', name: '万嘉网络',
    summary: [{ key: 'gmv', label: '支付 GMV', value: 2882, available: true, format: 'currency' }],
    analysis: [{ key: 'merchant_growth', title: '商家增长', description: '真实商家主档与动销表现', metrics: [] }],
    risks: [{ id: 'd1', factSummary: '待确认回款' }], intelligence: [{ externalId: 'i1', title: '行业趋势' }],
    source: { state: 'synced', updatedAt: '2026-08-07T08:00:00Z', recordCount: 3 },
    specialistAction: { targetId: 'merchantCenterRoot', label: '进入商家 360' },
  } } }, 'wanjia');
  assert.match(root.innerHTML, /CEO 总览/);
  assert.match(root.innerHTML, /经营分析/);
  assert.match(root.innerHTML, /原始明细与专业工具/);
  assert.match(root.innerHTML, /商家增长/);
  assert.match(root.innerHTML, /进入商家 360/);
  assert.match(root.innerHTML, /更新于/);
});
