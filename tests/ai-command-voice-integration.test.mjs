import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

class FakeRecognition {
  static instance = null;
  constructor() { FakeRecognition.instance = this; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
  result(text, final = true) {
    const value = [{ transcript: text }];
    value.isFinal = final;
    this.onresult?.({ resultIndex: 0, results: [value] });
  }
  end() { this.onend?.(); }
}

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('voice stays lazy, updates the same editable input and stops on demand', () => {
  FakeRecognition.instance = null;
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false, SpeechRecognition: FakeRecognition,
  });
  assert.equal(FakeRecognition.instance, null);
  assert.equal(app.viewModel().aiCommand.voice.supported, true);
  app.setAiCommandScope('wanjia');
  app.setAiCommandInput('原文字');
  app.startAiVoice();
  assert.equal(FakeRecognition.instance.started, true);
  FakeRecognition.instance.result('查一下万嘉今天的数据');
  assert.equal(app.viewModel().aiCommand.input, '查一下万嘉今天的数据');
  assert.equal(app.viewModel().aiCommand.scope, 'wanjia');
  app.stopAiVoice();
  assert.equal(FakeRecognition.instance.stopped, true);
  FakeRecognition.instance.end();
  assert.equal(app.viewModel().aiCommand.voice.state, 'idle');
  app.stop();
  assert.equal(FakeRecognition.instance.aborted, true);
});

test('unsupported voice does not block typed command input', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false, SpeechRecognition: null,
  });
  assert.equal(app.startAiVoice(), false);
  app.setAiCommandInput('仍然可以键盘输入');
  assert.equal(app.viewModel().aiCommand.input, '仍然可以键盘输入');
  assert.equal(app.viewModel().aiCommand.voice.state, 'unsupported');
});

test('mobile sheet uses the same AI command state and preserves text when voice is unavailable', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false, SpeechRecognition: null,
  });
  app.openMobileAiSheet();
  app.setAiCommandInput('生成今天的 CEO 行动建议');
  assert.equal(app.viewModel().mobileAiSheetOpen, true);
  assert.equal(app.viewModel().aiCommand.input, '生成今天的 CEO 行动建议');
  assert.equal(app.startAiVoice(), false);
  assert.equal(app.viewModel().aiCommand.input, '生成今天的 CEO 行动建议');
});

test('closing the mobile sheet stops an active voice recognition session', () => {
  FakeRecognition.instance = null;
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false, SpeechRecognition: FakeRecognition,
  });
  app.openMobileAiSheet();
  app.startAiVoice();
  app.closeMobileAiSheet();
  assert.equal(FakeRecognition.instance.stopped, true);
  assert.equal(app.viewModel().mobileAiSheetOpen, false);
  assert.notEqual(app.viewModel().aiCommand.voice.state, 'listening');
});
