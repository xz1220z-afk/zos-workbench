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
  assert.match(app, /\[data-intelligence-question-form\] button\[type="submit"\], \[data-refresh-intelligence\]/);
  assert.match(app, /setBusy\('\[data-refresh-all\]', runtime\.autoRefresh\?\.phase === 'refreshing'\)/);
  assert.match(app, /let aiCommandWork = null/);
  assert.match(app, /if \(aiCommandWork\) return aiCommandWork/);
  assert.match(app, /let intelligenceQuestionWork = null/);
  assert.match(app, /if \(intelligenceQuestionWork\) return intelligenceQuestionWork/);
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
