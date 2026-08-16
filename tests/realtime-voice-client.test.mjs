import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRealtimeSessionExchange,
  createRealtimeVoice,
} from '../src/app/realtime-voice.mjs';

class FakeDataChannel {
  constructor() { this.readyState = 'open'; this.sent = []; }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 'closed'; this.closed = true; }
  message(payload) { this.onmessage?.({ data: JSON.stringify(payload) }); }
}

class FakePeerConnection {
  static instances = [];
  constructor() {
    this.connectionState = 'new';
    this.channel = new FakeDataChannel();
    FakePeerConnection.instances.push(this);
  }
  createDataChannel() { return this.channel; }
  addTrack(track, stream) { this.added = { track, stream }; }
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\no=client' }; }
  async setLocalDescription(description) { this.localDescription = description; }
  async setRemoteDescription(description) { this.remoteDescription = description; }
  close() { this.closed = true; }
  connect(state) { this.connectionState = state; this.onconnectionstatechange?.(); }
}

function fakeMedia() {
  const track = { enabled: true, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  return { track, stream, mediaDevices: { calls: 0, async getUserMedia(constraints) { this.calls += 1; this.constraints = constraints; return stream; } } };
}

function fakeClock() {
  const timers = new Map();
  let id = 0;
  return {
    setTimeout(callback, delay) { const key = ++id; timers.set(key, { callback, delay }); return key; },
    clearTimeout(key) { timers.delete(key); },
    run(delay) {
      for (const [key, timer] of [...timers]) if (timer.delay === delay) { timers.delete(key); timer.callback(); }
    },
    pending: () => [...timers.values()].map((timer) => timer.delay),
  };
}

test('realtime voice is gesture-gated and exchanges SDP with bounded context', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const states = [];
  const contexts = [];
  const audio = { async play() { this.played = true; }, pause() { this.paused = true; }, srcObject: null };
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection,
    mediaDevices: media.mediaDevices,
    createAudioElement: () => audio,
    exchangeSdp: async (sdp, context) => { contexts.push({ sdp, context }); return 'v=0\r\no=server'; },
    onState: (state) => states.push(state.state),
  });

  assert.equal(media.mediaDevices.calls, 0);
  await voice.start({ page: { route: 'dashboard', title: '工作首页' }, agentId: 'CEO-001', knowledgeRefs: ['k1'] });
  assert.equal(media.mediaDevices.calls, 1);
  assert.deepEqual(media.mediaDevices.constraints, { audio: true });
  assert.deepEqual(contexts, [{
    sdp: 'v=0\r\no=client',
    context: { page: { route: 'dashboard', title: '工作首页' }, agentId: 'CEO-001', knowledgeRefs: ['k1'] },
  }]);
  assert.deepEqual(FakePeerConnection.instances[0].remoteDescription, { type: 'answer', sdp: 'v=0\r\no=server' });
  assert.equal(states.includes('connecting'), true);
  assert.equal(voice.state().state, 'listening');
  assert.equal(audio.played, true);
});

test('realtime voice supports caption events, interruption and microphone mute', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const captions = [];
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media.mediaDevices,
    createAudioElement: () => ({ play: async () => {}, pause() {}, srcObject: null }),
    exchangeSdp: async () => 'v=0\r\no=server', onCaption: (caption) => captions.push(caption),
  });
  await voice.start({ page: { route: 'dashboard' } });
  const channel = FakePeerConnection.instances[0].channel;
  channel.message({ type: 'response.output_audio_transcript.delta', delta: '你好' });
  channel.message({ type: 'response.output_audio_transcript.delta', delta: '，朱帅' });
  channel.message({ type: 'output_audio_buffer.started' });
  assert.equal(voice.state().state, 'speaking');
  assert.equal(captions.at(-1).text, '你好，朱帅');

  assert.equal(voice.interrupt(), true);
  assert.deepEqual(channel.sent.map((item) => item.type), ['response.cancel', 'output_audio_buffer.clear']);
  assert.equal(voice.state().state, 'listening');
  assert.equal(voice.setMuted(true), true);
  assert.equal(media.track.enabled, false);
  assert.equal(voice.state().muted, true);
  voice.setMuted(false);
  assert.equal(media.track.enabled, true);
});

test('realtime voice stops every media resource and never persists audio or transcript', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const writes = [];
  const audio = { play: async () => {}, pause() { this.paused = true; }, srcObject: null };
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media.mediaDevices,
    createAudioElement: () => audio, exchangeSdp: async () => 'v=0\r\no=server',
    storage: { setItem: (...args) => writes.push(args) },
  });
  await voice.start({ page: { route: 'dashboard' } });
  const peer = FakePeerConnection.instances[0];
  voice.stop('user');
  assert.equal(media.track.stopped, true);
  assert.equal(peer.channel.closed, true);
  assert.equal(peer.closed, true);
  assert.equal(audio.paused, true);
  assert.equal(audio.srcObject, null);
  assert.equal(writes.length, 0);
  assert.equal(voice.state().state, 'ended');
});

test('realtime voice warns at 90 seconds idle, ends after grace and caps sessions at 15 minutes', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const clock = fakeClock();
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media.mediaDevices, clock,
    createAudioElement: () => ({ play: async () => {}, pause() {}, srcObject: null }),
    exchangeSdp: async () => 'v=0\r\no=server',
  });
  await voice.start({ page: { route: 'dashboard' } });
  assert.deepEqual(clock.pending().sort((a, b) => a - b), [90_000, 900_000]);
  clock.run(90_000);
  assert.equal(voice.state().state, 'idle_warning');
  clock.run(10_000);
  assert.equal(voice.state().state, 'ended');

  const media2 = fakeMedia();
  const clock2 = fakeClock();
  const voice2 = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media2.mediaDevices, clock: clock2,
    createAudioElement: () => ({ play: async () => {}, pause() {}, srcObject: null }),
    exchangeSdp: async () => 'v=0\r\no=server',
  });
  await voice2.start({ page: { route: 'dashboard' } });
  clock2.run(900_000);
  assert.equal(voice2.state().state, 'ended');
});

test('realtime voice retries a failed connection only once', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media.mediaDevices,
    createAudioElement: () => ({ play: async () => {}, pause() {}, srcObject: null }),
    exchangeSdp: async () => 'v=0\r\no=server',
  });
  await voice.start({ page: { route: 'dashboard' } });
  FakePeerConnection.instances[0].connect('failed');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(FakePeerConnection.instances.length, 2);
  FakePeerConnection.instances[1].connect('failed');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(FakePeerConnection.instances.length, 2);
  assert.equal(voice.state().state, 'failed');
});

test('realtime voice deduplicates double start and keeps the hard cap after reconnect', async () => {
  FakePeerConnection.instances = [];
  const media = fakeMedia();
  const clock = fakeClock();
  let releaseMedia;
  media.mediaDevices.getUserMedia = async function getUserMedia() {
    this.calls += 1;
    await new Promise((resolve) => { releaseMedia = resolve; });
    return media.stream;
  };
  const voice = createRealtimeVoice({
    RTCPeerConnection: FakePeerConnection, mediaDevices: media.mediaDevices, clock,
    createAudioElement: () => ({ play: async () => {}, pause() {}, srcObject: null }),
    exchangeSdp: async () => 'v=0\r\no=server',
  });
  const first = voice.start({ page: { route: 'dashboard' } });
  const second = voice.start({ page: { route: 'dashboard' } });
  assert.equal(media.mediaDevices.calls, 1);
  releaseMedia();
  assert.equal(await first, true);
  assert.equal(await second, true);
  FakePeerConnection.instances[0].connect('failed');
  await new Promise((resolve) => setImmediate(resolve));
  releaseMedia();
  await new Promise((resolve) => setImmediate(resolve));
  clock.run(900_000);
  assert.equal(voice.state().state, 'ended');
});

test('realtime SDP exchange uses the signed-in Edge Function and returns only SDP text', async () => {
  const calls = [];
  const exchange = createRealtimeSessionExchange({
    url: 'https://project.supabase.co', anonKey: 'anon', getAccessToken: async () => 'owner-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, text: async () => 'v=0\r\no=answer' };
    },
  });
  const answer = await exchange('v=0\r\no=offer', { page: { route: 'dashboard' }, agentId: 'CEO-001' });
  assert.equal(answer, 'v=0\r\no=answer');
  assert.equal(calls[0].url, 'https://project.supabase.co/functions/v1/zos-ai-realtime-session');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer owner-token');
  assert.equal(calls[0].init.headers.apikey, 'anon');
  assert.equal(await calls[0].init.body.get('sdp').text(), 'v=0\r\no=offer');
  assert.deepEqual(JSON.parse(await calls[0].init.body.get('context').text()), {
    page: { route: 'dashboard', title: '' }, agentId: 'CEO-001', knowledgeRefs: [],
  });
});
