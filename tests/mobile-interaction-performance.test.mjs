import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCeoOsApplication } from '../src/app.mjs';

const root = new URL('../', import.meta.url);
const [css, app, legacy] = await Promise.all([
  readFile(new URL('assets/app.css', root), 'utf8'),
  readFile(new URL('src/app.mjs', root), 'utf8'),
  readFile(new URL('src/legacy-app.mjs', root), 'utf8'),
]);

test('mobile interaction uses targeted motion, safe-area spacing and current-region rendering', () => {
  assert.match(css, /--mobile-press-duration:\s*120ms/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.match(app, /renderCurrentPage/);
  assert.doesNotMatch(app, /data-mobile-ai-command[\s\S]{0,300}renderAllPages/);
});

test('current-page rendering uses a page-scoped model instead of eagerly building the whole workspace', () => {
  assert.match(app, /function pageViewModel\(pageId\)/);
  assert.match(app, /const baseModel = pageViewModel\(activePage\)/);
  assert.doesNotMatch(app, /const baseModel = activePage === 'local-life' \? wanjiaViewModel\(\) : viewModel\(\)/);
});

test('page-scoped models leave unrelated expensive domains unbuilt', () => {
  const application = createCeoOsApplication({
    document: interactionDocument(busyButton()),
    storage: { getItem() { return null; }, setItem() {} },
  });
  const decisions = application.pageViewModel('decisions');
  assert.equal(decisions.wanjiaOps, null);
  assert.equal(decisions.agentOsIndex, null);
  assert.deepEqual(decisions.calendar, []);
  assert.deepEqual(decisions.searchResults, []);
});

test('startup and the focus ticker never rebuild the whole workspace model', () => {
  const startBlock = app.slice(app.indexOf('async function start()'), app.indexOf('function stop()', app.indexOf('async function start()')));
  assert.match(startBlock, /return pageViewModel\(activePageId\(\)\)/);
  assert.match(startBlock, /if \(activePageId\(\) !== 'focus'\) return/);
  assert.match(startBlock, /const model = pageViewModel\('focus'\)/);
  assert.doesNotMatch(startBlock, /const model = viewModel\(\)/);
  assert.doesNotMatch(startBlock, /return viewModel\(\)/);
});

test('authenticated startup refresh and push scheduling use reminder-scoped models', async (t) => {
  let wanjiaHistoryReads = 0;
  let scheduled = 0;
  const sources = {
    wanjia: {
      records: [], summary: {},
      get history() {
        wanjiaHistoryReads += 1;
        return null;
      },
    },
    huahuo: { records: [], summary: {} },
    lingli: { records: [], summary: {} },
    projects: { records: [], summary: {} },
  };
  const operatingLoop = {
    async refresh() {},
    confirmTargets() {},
    ensureDailyBrief() { return null; },
    getState() {
      return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources };
    },
  };
  const application = createCeoOsApplication({
    document: {
      defaultView: { innerWidth: 390 },
      addEventListener() {},
      getElementById() { return null; },
      querySelector(selector) { return selector === '.page.active' ? { id: 'page-dashboard' } : null; },
      querySelectorAll() { return []; },
    },
    storage: { getItem(key) { return key === 'zos_device_id' ? 'device-1' : null; }, setItem() {} },
    operatingRuntime: {
      session: { userId: 'user-1' },
      operatingLoop,
      syncController: { start() {}, async sync() {} },
      async loadIntelligence() { return { items: [], state: 'cached' }; },
      async loadExternalCalendar() { return { items: [], state: 'pending_configuration' }; },
      pushClient: {
        async status() { return { state: 'enabled', publicKey: 'test-key' }; },
        async schedule(jobs) {
          scheduled += 1;
          return { state: 'enabled', scheduled: jobs.length };
        },
      },
    },
    autoRefreshFactory: ({ refreshAll, onStatus }) => ({
      start() {}, stop() {},
      async refresh(reason) {
        onStatus({ phase: 'refreshing', reason, succeeded: [], failed: [] });
        const result = await refreshAll(reason);
        onStatus({ phase: 'idle', reason, ...result });
        return result;
      },
    }),
  });
  t.after(() => application.stop());

  await application.start();
  await application.whenIdle();

  assert.ok(scheduled > 0, 'the push-enabled startup must exercise durable reminder scheduling');
  assert.equal(wanjiaHistoryReads, 0, 'startup reminder work must not build the full Wanjia workspace model');
});

test('navigation keeps each page scroll in runtime memory and restores it after the active page changes', () => {
  assert.match(legacy, /const pageScroll = new Map\(\)/);
  assert.match(legacy, /function rememberPageScroll\(pageId\)/);
  assert.match(legacy, /function restorePageScroll\(pageId\)/);
  assert.match(legacy, /rememberPageScroll\(currentPage\)/);
  assert.match(legacy, /restorePageScroll\(pageId\)/);
  assert.doesNotMatch(legacy, /localStorage\.setItem\([^\n]*pageScroll/);
});

test('runtime scroll memory restores different positions for different pages', () => {
  const map = legacy.match(/const pageScroll = new Map\(\);/)?.[0];
  const remember = legacy.match(/function rememberPageScroll\(pageId\) \{[\s\S]*?\n  \}/)?.[0];
  const restore = legacy.match(/function restorePageScroll\(pageId\) \{[\s\S]*?\n  \}\n\n  function navigateTo\(/)?.[0]?.replace(/\n\n  function navigateTo\($/, '');
  const executable = [map, remember, restore].filter(Boolean).join('\n');
  assert.ok(executable.includes('restorePageScroll'), 'the navigation scroll contract must be present');
  const content = { scrollTop: 0 };
  const document = { getElementById: () => content, scrollingElement: { scrollTop: 0 } };
  const scroll = new Function('document', 'requestAnimationFrame', executable + '\nreturn { rememberPageScroll, restorePageScroll };')(document, (callback) => callback());

  content.scrollTop = 324;
  scroll.rememberPageScroll('dashboard');
  content.scrollTop = 68;
  scroll.rememberPageScroll('intelligence');
  content.scrollTop = 0;
  scroll.restorePageScroll('dashboard');
  assert.equal(content.scrollTop, 324);
  scroll.restorePageScroll('intelligence');
  assert.equal(content.scrollTop, 68);
});

test('AI, Agent and intelligence actions expose busy state only during their local async work', () => {
  assert.match(app, /function applyLocalBusyAttributes\(\)/);
  assert.match(app, /toggleAttribute\?\.\('aria-busy', busy\)/);
  assert.match(app, /\[data-ai-command-form\] button\[type="submit"\]/);
  assert.match(app, /\[data-intelligence-question-form\] button\[type="submit"\]/);
  assert.match(app, /\[data-refresh-intelligence\]/);
  assert.match(app, /setBusy\('\[data-refresh-all\]', runtime\.autoRefresh\?\.phase === 'refreshing'\)/);
  assert.match(app, /let aiCommandWork = null/);
  assert.match(app, /if \(aiCommandWork\) return aiCommandWork/);
  assert.match(app, /const intelligenceQuestionWork = new Map\(\)/);
  assert.match(app, /if \(intelligenceQuestionWork\.has\(id\)\) return intelligenceQuestionWork\.get\(id\)/);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

function interactionDocument(button) {
  const nodes = new Map();
  const node = () => ({ innerHTML: '', textContent: '', style: {}, querySelector() { return null; }, querySelectorAll() { return []; } });
  return {
    defaultView: { innerWidth: 390 },
    querySelector(selector) { return selector === '.page.active' ? { id: 'page-dashboard' } : null; },
    querySelectorAll(selector) { return selector.includes('[data-ai-command-form]') ? [button] : []; },
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
  };
}

function busyButton() {
  const attributes = new Set();
  return {
    disabled: false,
    toggleAttribute(name, value) { if (value) attributes.add(name); else attributes.delete(name); },
    hasAttribute(name) { return attributes.has(name); },
  };
}

test('AI command coalesces re-entry, clears busy after success and preserves input after failure', async () => {
  const successGate = deferred();
  const successButton = busyButton();
  let calls = 0;
  const app = createCeoOsApplication({
    document: interactionDocument(successButton), storage: { getItem() { return null; }, setItem() {} },
    askAi() { calls += 1; return successGate.promise; },
  });

  const first = app.submitAiCommand('整理今天待办');
  const duplicate = app.submitAiCommand('整理今天待办');
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(successButton.hasAttribute('aria-busy'), true);
  assert.equal(successButton.disabled, true);
  successGate.resolve({ answer: '已整理', actions: [] });
  await Promise.all([first, duplicate]);
  assert.equal(successButton.hasAttribute('aria-busy'), false);
  assert.equal(successButton.disabled, false);

  const failureButton = busyButton();
  const failed = createCeoOsApplication({
    document: interactionDocument(failureButton), storage: { getItem() { return null; }, setItem() {} },
    askAi() { return Promise.reject(new Error('offline')); },
  });
  await assert.rejects(failed.submitAiCommand('保留这个输入'), /ai_command_failed/);
  assert.equal(failed.runtime.aiCommand.input, '保留这个输入');
  assert.equal(failureButton.hasAttribute('aria-busy'), false);
  assert.equal(failureButton.disabled, false);
});
