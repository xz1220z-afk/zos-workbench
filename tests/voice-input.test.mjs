import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceInput } from '../src/app/voice-input.mjs';

class FakeRecognition {
  static instances = [];

  constructor() {
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    this.lang = '';
    this.continuous = true;
    this.interimResults = false;
    FakeRecognition.instances.push(this);
  }

  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
  emitResult(text, isFinal = true) {
    const result = [{ transcript: text }];
    result.isFinal = isFinal;
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  emitError(error) { this.onerror?.({ error }); }
  emitEnd() { this.onend?.(); }
}

function resetFake() { FakeRecognition.instances.length = 0; }

test('voice input never starts until the explicit start call', () => {
  resetFake();
  const states = [];
  const voice = createVoiceInput({ Recognition: FakeRecognition, onState: (state) => states.push(state) });
  assert.equal(voice.supported, true);
  assert.equal(FakeRecognition.instances.length, 1);
  assert.equal(FakeRecognition.instances[0].started, false);
  assert.equal(voice.state(), 'idle');
  voice.start();
  assert.equal(FakeRecognition.instances[0].started, true);
  assert.equal(voice.state(), 'listening');
  assert.deepEqual(states, ['listening']);
});

test('recognition returns an editable transcript and stops after release', () => {
  resetFake();
  const transcripts = [];
  const states = [];
  const voice = createVoiceInput({
    Recognition: FakeRecognition,
    onTranscript: (text, meta) => transcripts.push({ text, final: meta.final }),
    onState: (state) => states.push(state),
  });
  voice.start();
  FakeRecognition.instances[0].emitResult('查一下万嘉今天的数据', false);
  FakeRecognition.instances[0].emitResult('查一下万嘉今天的数据', true);
  voice.stop();
  assert.deepEqual(transcripts, [
    { text: '查一下万嘉今天的数据', final: false },
    { text: '查一下万嘉今天的数据', final: true },
  ]);
  assert.equal(FakeRecognition.instances[0].stopped, true);
  assert.equal(voice.state(), 'transcribing');
  FakeRecognition.instances[0].emitEnd();
  assert.equal(voice.state(), 'idle');
  assert.deepEqual(states, ['listening', 'transcribing', 'idle']);
});

test('permission denial exposes a safe state and does not retry itself', () => {
  resetFake();
  const errors = [];
  const voice = createVoiceInput({ Recognition: FakeRecognition, onError: (error) => errors.push(error) });
  voice.start();
  FakeRecognition.instances[0].emitError('not-allowed');
  assert.equal(voice.state(), 'permission_denied');
  assert.deepEqual(errors, ['permission_denied']);
  assert.equal(FakeRecognition.instances[0].started, true);
});

test('unsupported recognition keeps keyboard mode available', () => {
  const voice = createVoiceInput({ Recognition: null, globalObject: {} });
  assert.equal(voice.supported, false);
  assert.equal(voice.state(), 'unsupported');
  assert.equal(voice.start(), false);
  assert.equal(voice.stop(), false);
});

test('destroy aborts an active recognition session without persisting audio', () => {
  resetFake();
  const voice = createVoiceInput({ Recognition: FakeRecognition });
  voice.start();
  voice.destroy();
  assert.equal(FakeRecognition.instances[0].aborted, true);
  assert.equal(voice.state(), 'idle');
  assert.equal(Object.hasOwn(voice, 'audio'), false);
});
