import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('app starts realtime voice only from an explicit command and exposes session controls', async () => {
  const calls = [];
  let callbacks;
  const client = {
    async start(context) { calls.push(['start', context]); callbacks.onState({ supported: true, state: 'listening', muted: false, captionsEnabled: true, caption: '' }); return true; },
    interrupt() { calls.push(['interrupt']); return true; },
    setMuted(value) { calls.push(['mute', value]); callbacks.onState({ supported: true, state: value ? 'muted' : 'listening', muted: value, captionsEnabled: true, caption: '' }); return true; },
    setCaptions(value) { calls.push(['captions', value]); callbacks.onState({ supported: true, state: 'listening', muted: false, captionsEnabled: value, caption: '' }); return value; },
    stop(reason) { calls.push(['stop', reason]); callbacks.onState({ supported: true, state: 'ended', muted: false, captionsEnabled: true, caption: '', reason }); return true; },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false,
    exchangeRealtimeSdp: async () => 'v=0',
    realtimeVoiceFactory: (options) => { callbacks = options; return client; },
    RTCPeerConnection: function FakePeer() {}, mediaDevices: { getUserMedia() {} },
  });

  assert.equal(calls.length, 0);
  await app.startRealtimeVoice();
  assert.deepEqual(calls[0], ['start', { page: { route: 'dashboard', title: '' }, agentId: '', knowledgeRefs: [] }]);
  assert.equal(app.viewModel().aiCommand.realtimeVoice.state, 'listening');
  app.interruptRealtimeVoice();
  app.toggleRealtimeVoiceMute();
  app.toggleRealtimeVoiceCaptions();
  assert.deepEqual(calls.slice(1, 4), [['interrupt'], ['mute', true], ['captions', false]]);
  app.stopRealtimeVoice();
  assert.deepEqual(calls.at(-1), ['stop', 'user']);
});

test('closing the mobile AI sheet also ends its realtime microphone session', async () => {
  const calls = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false,
    exchangeRealtimeSdp: async () => 'v=0', RTCPeerConnection: function FakePeer() {}, mediaDevices: { getUserMedia() {} },
    realtimeVoiceFactory: ({ onState }) => ({
      start: async () => { onState({ supported: true, state: 'listening', muted: false, captionsEnabled: true, caption: '' }); return true; },
      stop: (reason) => calls.push(reason),
    }),
  });
  app.openMobileAiSheet();
  await app.startRealtimeVoice();
  app.closeMobileAiSheet();
  assert.deepEqual(calls, ['sheet_close']);
});

test('app stop always tears down an active realtime voice session', async () => {
  const calls = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false,
    exchangeRealtimeSdp: async () => 'v=0', RTCPeerConnection: function FakePeer() {}, mediaDevices: { getUserMedia() {} },
    realtimeVoiceFactory: ({ onState }) => ({
      start: async () => { onState({ supported: true, state: 'listening', muted: false, captionsEnabled: true, caption: '' }); return true; },
      stop: (reason) => calls.push(reason),
    }),
  });
  await app.startRealtimeVoice();
  app.stop();
  assert.deepEqual(calls, ['application_stop']);
});

test('backgrounding the app ends realtime voice instead of leaving the microphone open', async () => {
  const listeners = new Map();
  const calls = [];
  const document = {
    visibilityState: 'visible', defaultView: null,
    getElementById: () => null, querySelector: () => null,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const app = createCeoOsApplication({
    document, storage: memoryStorage(), createOperatingRuntime: false,
    exchangeRealtimeSdp: async () => 'v=0', RTCPeerConnection: function FakePeer() {}, mediaDevices: { getUserMedia() {} },
    realtimeVoiceFactory: ({ onState }) => ({
      start: async () => { onState({ supported: true, state: 'listening', muted: false, captionsEnabled: true, caption: '' }); return true; },
      stop: (reason) => calls.push(reason),
    }),
  });
  app.start();
  await app.startRealtimeVoice();
  document.visibilityState = 'hidden';
  listeners.get('visibilitychange')?.();
  assert.deepEqual(calls, ['background']);
  app.stop();
});
