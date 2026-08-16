import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

const agentOsIndex = {
  schemaVersion: 'agent-os-index-v1', generatedAt: '2026-08-16T10:00:00.000Z', sourceRoot: 'test',
  agents: [{ agentId: 'WANJIA-001', name: '万嘉运营 Agent', status: 'pilot', relativePath: 'WANJIA-001.md', hash: 'wanjia-hash', updatedAt: '2026-08-16', skillIds: [], workflowIds: [], evidenceIds: [], logIds: [], runbookIds: [], knowledgeEntries: [], sections: { mission: '经营诊断' } }],
  skills: [], workflows: [], evaluations: [], logs: [], runbooks: [],
};

function analysisApp(askAi) {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: memoryStorage(), createOperatingRuntime: false, askAi,
    now: () => '2026-08-16T10:00:00.000Z',
  });
  app.importAgentOsIndexText(JSON.stringify(agentOsIndex));
  app.saveTask({ ...app.invokeAgent('WANJIA-001'), title: '核验今日商家风险' });
  return { app, archive: app.viewModel().agentTaskArchives[0] };
}

test('Agent task analysis coalesces a double click, clears failure busy state, and permits retry', async () => {
  const failedGate = deferred();
  const retryGate = deferred();
  let calls = 0;
  const { app, archive } = analysisApp(() => [failedGate, retryGate][calls++].promise);

  const first = app.analyzeAgentTask(archive.id);
  const duplicate = app.analyzeAgentTask(archive.id);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.deepEqual(app.runtime.localBusy.agentTaskArchives, [archive.id]);
  failedGate.reject(new Error('offline'));
  await assert.rejects(first, /offline/);
  await assert.rejects(duplicate, /offline/);
  assert.deepEqual(app.runtime.localBusy.agentTaskArchives, []);
  assert.equal(app.viewModel().agentTaskArchives[0].phase, 'draft');
  assert.equal(app.viewModel().agentContextCandidates.length, 0);

  const retry = app.analyzeAgentTask(archive.id);
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.deepEqual(app.runtime.localBusy.agentTaskArchives, [archive.id]);
  retryGate.resolve({ answer: '可执行的核验建议', sources: [] });
  await retry;
  assert.deepEqual(app.runtime.localBusy.agentTaskArchives, []);
  assert.equal(app.viewModel().agentTaskArchives[0].phase, 'result_ready');
  assert.equal(app.viewModel().agentContextCandidates.length, 1);
});

function refreshDocument(buttons) {
  const node = () => ({ innerHTML: '', textContent: '', style: {} });
  return {
    defaultView: { innerWidth: 390 },
    getElementById: () => node(), addEventListener() {},
    querySelector: (selector) => selector === '.page.active' ? { id: 'page-dashboard' } : null,
    querySelectorAll(selector) {
      if (selector === '[data-refresh-source]') return [...buttons.values()];
      const match = selector.match(/data-refresh-source="([^"]+)"/);
      return match ? [buttons.get(match[1])].filter(Boolean) : [];
    },
  };
}

function busyButton() {
  const attributes = new Set();
  return { disabled: false, toggleAttribute(name, value) { if (value) attributes.add(name); else attributes.delete(name); }, hasAttribute(name) { return attributes.has(name); } };
}

test('concurrent source refreshes keep each source button busy until its own promise settles', async () => {
  const gates = { wanjia: deferred(), huahuo: deferred() };
  const buttons = new Map([['wanjia', busyButton()], ['huahuo', busyButton()]]);
  for (const [source, button] of buttons) button.dataset = { refreshSource: source };
  const app = createCeoOsApplication({
    document: refreshDocument(buttons), storage: memoryStorage(), createOperatingRuntime: false,
    operatingRuntime: { operatingLoop: { refresh: (source) => gates[source].promise, confirmTargets() {}, ensureDailyBrief() { return null; }, getState() { return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {} }; } } },
  });
  const left = app.refreshSource('wanjia');
  const right = app.refreshSource('huahuo');
  await Promise.resolve();
  assert.deepEqual(app.runtime.localBusy.refreshSources.sort(), ['huahuo', 'wanjia']);
  assert.equal(buttons.get('wanjia').hasAttribute('aria-busy'), true);
  assert.equal(buttons.get('huahuo').hasAttribute('aria-busy'), true);
  gates.wanjia.resolve();
  await left;
  assert.equal(buttons.get('wanjia').hasAttribute('aria-busy'), false);
  assert.equal(buttons.get('huahuo').hasAttribute('aria-busy'), true);
  gates.huahuo.resolve();
  await right;
  assert.equal(buttons.get('huahuo').hasAttribute('aria-busy'), false);
});

test('interleaved intelligence questions keep Q2 visible when Q1 fails later', async () => {
  const gates = [deferred(), deferred()];
  let calls = 0;
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: memoryStorage(), createOperatingRuntime: false,
    askAi: () => gates[calls++].promise,
  });
  for (const externalId of ['q1', 'q2']) app.store.saveEntity('intelligence', {
    id: `intelligence:${externalId}`, externalId, title: externalId, sourceName: '行业媒体', factSummary: `${externalId} fact`, credibility: 'medium', relevantCompanies: ['ceo'], capturedAt: '2026-08-16T10:00:00.000Z', status: 'candidate',
  });
  app.runtime.intelligence = app.store.load().collections.intelligence;
  app.openIntelligenceQuestion('q1');
  const q1 = app.askIntelligenceQuestion('q1', 'Q1 是什么？');
  app.openIntelligenceQuestion('q2');
  const q2 = app.askIntelligenceQuestion('q2', 'Q2 是什么？');
  await Promise.resolve();
  assert.equal(calls, 2);
  gates[0].reject(new Error('offline'));
  await q1;
  assert.equal(app.runtime.intelligenceQuestion.externalId, 'q2');
  assert.notEqual(app.runtime.intelligenceAnswer?.state, 'error');
  gates[1].resolve({ answer: 'Q2 answer', sources: [] });
  await q2;
  assert.equal(app.runtime.intelligenceAnswer.directAnswer, 'Q2 answer');
});

test('Agent drawer and mobile AI sheet close controls have a 44px touch target', async () => {
  const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.agent-detail-drawer > header > button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  assert.match(css, /\.mobile-ai-sheet header button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
});
