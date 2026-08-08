import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWanjiaOpsNavigation, normalizeWanjiaOpsPane } from '../src/app/wanjia-ops-navigation.mjs';

test('defaults the Wanjia console to today operations and exposes four named contexts', () => {
  assert.equal(normalizeWanjiaOpsPane('unknown'), 'overview');
  const navigation = buildWanjiaOpsNavigation('merchant_ops');
  assert.deepEqual(navigation.items.map((item) => item.id), ['overview', 'merchant_ops', 'growth_review', 'data_analysis']);
  assert.equal(navigation.active.id, 'merchant_ops');
});
