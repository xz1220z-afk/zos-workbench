import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bucketMerchantActions,
  buildMerchantProfile,
  searchMerchants,
} from '../src/app/merchant-center.mjs';

test('merchant profile separates incomplete actions from missing evidence', () => {
  const profile = buildMerchantProfile({
    id: 'm1', merchantName: '老街奶茶', isListed: true, isActive: false,
    paymentGmv: 12800, redeemedGmv: 7600,
    actions: [
      { id: 'a1', title: '上线团购', status: 'done' },
      { id: 'a2', title: '发布视频', status: 'todo', dueAt: '2026-08-01T10:00:00+08:00' },
    ],
    expectedActionLabels: ['上线团购', '发布视频', '复盘核销'],
  }, { now: '2026-08-03T00:00:00+08:00' });

  assert.deepEqual(profile.actions.done.map((item) => item.title), ['上线团购']);
  assert.deepEqual(profile.actions.overdue.map((item) => item.title), ['发布视频']);
  assert.deepEqual(profile.actions.unrecorded, ['复盘核销']);
  assert.equal(profile.metrics.paymentGmv, 12800);
});

test('merchant search returns disambiguation instead of picking a same-name merchant', () => {
  const result = searchMerchants([
    { id: '1', merchantName: '茶里' },
    { id: '2', merchantName: '茶里' },
  ], '茶里');
  assert.equal(result.state, 'ambiguous');
  assert.deepEqual(result.matches.map((item) => item.id), ['1', '2']);
});

test('merchant search is whitespace and case tolerant with explicit empty states', () => {
  const merchants = [
    { id: '1', merchantName: 'Ocean Coffee', merchantId: 'M-001' },
    { id: '2', merchantName: '海岸咖啡', merchantId: 'M-002' },
    { id: '3', merchantName: 'Ocean Coffee Lab', merchantId: 'M-003' },
  ];
  assert.equal(searchMerchants(merchants, ' ocean  coffee ').state, 'matched');
  assert.equal(searchMerchants(merchants, 'coffee').state, 'multiple');
  assert.equal(searchMerchants(merchants, '不存在').state, 'not_found');
  assert.equal(searchMerchants(merchants, '').state, 'empty_query');
});

test('local linked tasks merge into merchant actions without overwriting Feishu facts', () => {
  const profile = buildMerchantProfile({ id: 'm1', merchantName: '茶里', stage: '执行中' }, {
    now: '2026-08-03T00:00:00+08:00',
    tasks: [
      { id: 't1', title: '拍摄门店视频', status: 'todo', businessEntityId: 'm1' },
      { id: 't2', title: '其他商家任务', status: 'done', businessEntityId: 'm2' },
    ],
  });
  assert.deepEqual(profile.actions.pending.map((item) => item.id), ['t1']);
  assert.equal(profile.stage, '执行中');
});

test('action bucket handles done pending overdue and unrecorded deterministically', () => {
  const result = bucketMerchantActions([
    { id: '2', title: '待跟进', status: 'todo' },
    { id: '1', title: '已完成', status: 'completed' },
    { id: '3', title: '逾期', status: 'todo', dueAt: '2026-08-01T00:00:00+08:00' },
  ], ['已完成', '待跟进', '逾期', '没有证据'], { now: '2026-08-03T00:00:00+08:00' });
  assert.deepEqual(result.done.map((item) => item.id), ['1']);
  assert.deepEqual(result.pending.map((item) => item.id), ['2']);
  assert.deepEqual(result.overdue.map((item) => item.id), ['3']);
  assert.deepEqual(result.unrecorded, ['没有证据']);
});
