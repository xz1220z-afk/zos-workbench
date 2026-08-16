import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

class FakeRecognition {
  static instances = [];

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }

  result(text, final = true) {
    const value = [{ transcript: text }];
    value.isFinal = final;
    this.onresult?.({ resultIndex: 0, results: [value] });
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createVoiceBrowser() {
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const clock = {
    innerWidth: 390,
    setTimeout(callback, delay = 0) {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  const document = {
    defaultView: clock,
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    getElementById() { return null; },
    querySelector(selector) {
      return selector === '.page.active' ? { id: 'page-settings' } : null;
    },
    querySelectorAll() { return []; },
  };
  return {
    document,
    emit(type, event) {
      for (const listener of listeners.get(type) || []) listener({ ...event, type });
    },
    runDelay(delay) {
      const due = [...timers.entries()].filter(([, timer]) => timer.delay === delay);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

function voiceButton() {
  return {
    closest(selector) { return selector === '[data-ai-voice-toggle]' ? this : null; },
  };
}

const outsideTarget = { closest() { return null; } };

function createPointerVoiceApp(t) {
  FakeRecognition.instances = [];
  const browser = createVoiceBrowser();
  const app = createCeoOsApplication({
    document: browser.document,
    storage: memoryStorage(),
    createOperatingRuntime: false,
    SpeechRecognition: FakeRecognition,
  });
  app.start();
  t.after(() => app.stop());
  return { app, browser };
}

test('hold-to-talk stops on its matching pointerup outside the button and then commits speech', (t) => {
  const { app, browser } = createPointerVoiceApp(t);
  const button = voiceButton();
  app.setAiCommandInput('保留这段键盘草稿');

  browser.emit('pointerdown', { target: button, pointerId: 7, pointerType: 'touch', button: 0 });
  browser.runDelay(240);
  const recognition = FakeRecognition.instances[0];
  recognition.result('这是本次语音');

  assert.equal(app.viewModel().aiCommand.input, '保留这段键盘草稿');
  browser.emit('pointerup', { target: outsideTarget, pointerId: 99, pointerType: 'touch' });
  assert.equal(recognition.stopped, undefined);
  browser.emit('pointerup', { target: outsideTarget, pointerId: 7, pointerType: 'touch' });
  assert.equal(recognition.stopped, true);
  assert.equal(recognition.aborted, undefined);
  assert.equal(app.viewModel().aiCommand.input, '这是本次语音');
});

test('pointerleave before the hold threshold cancels the delayed voice start', (t) => {
  const { browser } = createPointerVoiceApp(t);
  const button = voiceButton();

  browser.emit('pointerdown', { target: button, pointerId: 8, pointerType: 'touch', button: 0 });
  browser.emit('pointerleave', { target: button, pointerId: 8, pointerType: 'touch' });
  browser.runDelay(240);

  assert.equal(FakeRecognition.instances.length, 0);
});

test('pointercancel aborts hold-to-talk, discards temporary speech, and ignores late results', (t) => {
  const { app, browser } = createPointerVoiceApp(t);
  const button = voiceButton();
  app.setAiCommandInput('不能丢的键盘草稿');

  browser.emit('pointerdown', { target: button, pointerId: 9, pointerType: 'touch', button: 0 });
  browser.runDelay(240);
  const recognition = FakeRecognition.instances[0];
  recognition.result('应该丢弃的临时语音');
  browser.emit('pointercancel', { target: outsideTarget, pointerId: 9, pointerType: 'touch' });

  assert.equal(recognition.aborted, true);
  assert.equal(recognition.stopped, undefined);
  assert.equal(app.viewModel().aiCommand.input, '不能丢的键盘草稿');
  assert.notEqual(app.viewModel().aiCommand.voice.state, 'listening');
  recognition.result('取消后的迟到结果');
  assert.equal(app.viewModel().aiCommand.input, '不能丢的键盘草稿');
});

test('closing the mobile sheet cancels a pending hold and aborts an active hold without replacing typed input', (t) => {
  const { app, browser } = createPointerVoiceApp(t);
  const button = voiceButton();
  app.openMobileAiSheet();
  app.setAiCommandInput('关闭后仍保留的草稿');

  browser.emit('pointerdown', { target: button, pointerId: 10, pointerType: 'touch', button: 0 });
  app.closeMobileAiSheet();
  browser.runDelay(240);
  assert.equal(FakeRecognition.instances.length, 0);

  app.openMobileAiSheet();
  browser.emit('pointerdown', { target: button, pointerId: 11, pointerType: 'touch', button: 0 });
  browser.runDelay(240);
  const recognition = FakeRecognition.instances[0];
  recognition.result('关闭时必须丢弃的语音');
  app.closeMobileAiSheet();

  assert.equal(recognition.aborted, true);
  assert.equal(recognition.stopped, undefined);
  assert.equal(app.viewModel().aiCommand.input, '关闭后仍保留的草稿');
  assert.notEqual(app.viewModel().aiCommand.voice.state, 'listening');
});
