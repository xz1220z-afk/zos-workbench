import test from 'node:test';
import assert from 'node:assert/strict';

import { feishuNumber, feishuText, roundMoney } from '../supabase/functions/_shared/feishu-values.mjs';

test('Feishu rich text, people and option fields become human-readable text', () => {
  assert.equal(feishuText([{ type: 'text', text: '蜀粤香养生头疗馆' }]), '蜀粤香养生头疗馆');
  assert.equal(feishuText([{ name: '朱帅', id: 'ou_1' }]), '朱帅');
  assert.equal(feishuText({ label: '执行中', value: 'running' }), '执行中');
  assert.equal(feishuText({ unexpected: { nested: true } }, '未知商家'), '未知商家');
  assert.doesNotMatch(feishuText({ unexpected: true }, '未指定'), /\[object Object\]/);
});

test('Feishu numeric values and money totals remain finite and currency-safe', () => {
  assert.equal(feishuNumber('2,882,883.60'), 2882883.6);
  assert.equal(feishuNumber({ value: '128.35' }), 128.35);
  assert.equal(feishuNumber([{ value: 20.1 }]), 20.1);
  assert.equal(roundMoney(2882883.6000000043), 2882883.6);
});
