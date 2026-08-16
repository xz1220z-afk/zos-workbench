import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

function focusableDocument() {
  const listeners = new Map();
  const eventTarget = new EventTarget();
  const trigger = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const input = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const sheet = { contains: (target) => target === input };
  const document = {
    activeElement: trigger,
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); },
    getElementById() { return null; },
    querySelector(selector) {
      if (selector === '[data-mobile-ai-command]') return trigger;
      if (selector === '[data-mobile-ai-command-sheet] [data-ai-command-input]') return input;
      if (selector === '[data-mobile-ai-command-sheet]') return sheet;
      return null;
    },
    defaultView: eventTarget,
  };
  return {
    document, eventTarget, trigger, input,
    emit(type, event) { for (const listener of listeners.get(type) || []) listener(event); },
  };
}

test('Task 1 open event is the single mobile sheet entry and keeps focus in the dialog', () => {
  const browser = focusableDocument();
  const app = createCeoOsApplication({
    document: browser.document, storage: memoryStorage(), createOperatingRuntime: false,
    weatherFetchImpl: async () => ({ ok: false }),
  });
  app.start();
  browser.eventTarget.dispatchEvent(new Event('zos:open-ai-command'));
  assert.equal(app.viewModel().mobileAiSheetOpen, true);
  assert.equal(browser.input.focusCalls, 1);

  browser.emit('click', { target: { closest: (selector) => selector === '[data-mobile-ai-command]' ? browser.trigger : null } });
  assert.equal(browser.input.focusCalls, 1);

  browser.emit('focusin', { target: {} });
  assert.equal(browser.input.focusCalls, 2);

  browser.emit('keydown', { key: 'Escape' });
  assert.equal(app.viewModel().mobileAiSheetOpen, false);
  assert.equal(browser.trigger.focusCalls, 1);
  app.stop();
});
