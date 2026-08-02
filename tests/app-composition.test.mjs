import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';

function fakeStore(targets = []) {
  const listeners = new Set();
  const state = {
    schemaVersion: '1.3', deviceId: 'device-1', tombstones: [],
    collections: { tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets },
  };
  return {
    load: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    saveEntity(entityType, fields) {
      state.collections[entityType] = [
        ...state.collections[entityType].filter((item) => item.id !== fields.id),
        structuredClone(fields),
      ];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(fields);
    },
  };
}

test('production application drives the authenticated operating loop on startup', async () => {
  const calls = [];
  const target = { id: 'target-1', metricKey: 'wanjia.paymentGmv', value: 10000, confirmation: 'confirmed' };
  const operatingLoop = {
    async refresh(source) { calls.push(['refresh', source]); },
    confirmTargets(targets) { calls.push(['targets', targets.map((item) => item.id)]); },
    ensureDailyBrief() { calls.push(['brief']); return { id: 'brief-1', date: '2026-08-02', kind: 'daily_brief', reviewStatus: 'pending_review', sections: { todayTop3: [] } }; },
    getState() {
      return {
        decisions: [{ id: 'decision-1', status: 'open', source: 'wanjia', sourceRecordId: 'rec-1', factSummary: '测试事实', recommendedAction: '联系负责人' }],
        targets: [target], gaps: [{ metricKey: target.metricKey, target: 10000, actual: 8000, gap: 2000 }],
        briefs: [], health: [{ source: 'wanjia', state: 'synced' }], conflicts: [], approvals: [], sources: {},
      };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore([target]), operatingRuntime: { operatingLoop, syncController: { start() { calls.push(['sync']); } } },
  });

  await app.start();

  assert.deepEqual(calls, [
    ['sync'], ['refresh', 'wanjia'], ['refresh', 'huahuo'], ['targets', ['target-1']], ['brief'],
  ]);
  assert.equal(app.viewModel().decisions[0].id, 'decision-1');
  assert.equal(app.viewModel().gaps[0].gap, 2000);
  assert.equal(app.viewModel().brief.id, 'brief-1');
});

test('application actions keep targets local and require preview before an individual Feishu execution', async () => {
  const targetCalls = [];
  const previewCalls = [];
  const executeCalls = [];
  const store = fakeStore();
  const operatingLoop = {
    async refresh() {},
    confirmTargets(targets) { targetCalls.push(structuredClone(targets)); return []; },
    ensureDailyBrief() { return null; },
    async previewFeishu(proposal) { previewCalls.push(proposal); return { approvalId: 'approval-1', fieldName: '下一步动作', before: '旧动作', after: proposal.value }; },
    async executeFeishu(approvalId) { executeCalls.push(approvalId); return { approvalId, verified: true, status: 'executed' }; },
    getState() {
      return {
        decisions: [{ id: 'decision-1', status: 'open', source: 'wanjia', sourceRecordId: 'rec-1', recommendedAction: '联系负责人' }],
        targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {},
      };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => 'device-1', setItem() {} },
    store, operatingRuntime: { operatingLoop, syncController: { start() {} } }, now: () => '2026-08-02T08:00:00.000Z',
  });
  await app.start();

  app.confirmTarget({ metricKey: 'wanjia.paymentGmv', value: 12000, period: '2026-08' });
  assert.equal(store.load().collections.targets[0].confirmation, 'confirmed');
  assert.equal(targetCalls.at(-1)[0].value, 12000);

  const preview = await app.previewDecision('decision-1');
  assert.equal(preview.approvalId, 'approval-1');
  assert.deepEqual(previewCalls[0], { source: 'wanjia', recordId: 'rec-1', action: 'set_next_action', value: '联系负责人' });
  assert.deepEqual(executeCalls, [], 'preview must not execute the Feishu write');
  await app.executeApproval('approval-1');
  assert.deepEqual(executeCalls, ['approval-1']);
});

test('service worker caches the complete transitive browser module graph', async () => {
  const root = new URL('../', import.meta.url);
  const serviceWorker = await readFile(new URL('sw.js', root), 'utf8');
  for (const asset of [
    'src/app/browser-runtime.mjs', 'src/business-data-client.mjs', 'src/supabase-auth.mjs',
    'src/supabase-transport.mjs', 'src/sync-engine.mjs', 'src/data-model.mjs',
  ]) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.')), `${asset} must be cached`);
});
