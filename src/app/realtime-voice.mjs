export const REALTIME_VOICE_IDLE_MS = 90_000;
export const REALTIME_VOICE_IDLE_GRACE_MS = 10_000;
export const REALTIME_VOICE_MAX_MS = 15 * 60 * 1000;

function normalizeClientContext(input = {}) {
  return {
    page: {
      route: String(input.page?.route || '').slice(0, 80),
      title: String(input.page?.title || '').slice(0, 160),
    },
    agentId: String(input.agentId || '').slice(0, 80),
    knowledgeRefs: [...new Set((Array.isArray(input.knowledgeRefs) ? input.knowledgeRefs : [])
      .map((value) => String(value || '').slice(0, 180)).filter(Boolean))].slice(0, 12),
  };
}

export function createRealtimeSessionExchange({ url, anonKey, getAccessToken, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !anonKey || typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function') {
    throw new Error('realtime_exchange_configuration_required');
  }
  return async (sdp, rawContext = {}) => {
    const token = await getAccessToken();
    if (!token) throw new Error('authentication_required');
    const body = new FormData();
    body.append('sdp', new Blob([String(sdp || '')], { type: 'application/sdp' }), 'offer.sdp');
    body.append('context', new Blob([JSON.stringify(normalizeClientContext(rawContext))], { type: 'application/json' }), 'context.json');
    const response = await fetchImpl(`${String(url).replace(/\/$/, '')}/functions/v1/zos-ai-realtime-session`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}` }, body,
    });
    if (!response.ok) throw new Error('realtime_session_failed');
    const answer = (await response.text()).trim();
    if (!answer.startsWith('v=0')) throw new Error('realtime_answer_invalid');
    return answer;
  };
}

export function createRealtimeVoice(options = {}) {
  const PeerConnection = options.RTCPeerConnection || globalThis.RTCPeerConnection;
  const mediaDevices = options.mediaDevices || globalThis.navigator?.mediaDevices;
  const clock = options.clock || globalThis;
  const exchangeSdp = options.exchangeSdp;
  const createAudioElement = options.createAudioElement || (() => {
    const audio = globalThis.document?.createElement?.('audio') || { play() {}, pause() {} };
    audio.autoplay = true;
    return audio;
  });
  const onState = options.onState || (() => {});
  const onCaption = options.onCaption || (() => {});
  const supported = typeof PeerConnection === 'function'
    && typeof mediaDevices?.getUserMedia === 'function'
    && typeof exchangeSdp === 'function';
  let snapshot = { supported, state: supported ? 'idle' : 'unsupported', muted: false, captionsEnabled: true, caption: '', reason: null };
  let peer = null;
  let channel = null;
  let stream = null;
  let audio = null;
  let idleTimer = null;
  let graceTimer = null;
  let maxTimer = null;
  let generation = 0;
  let reconnects = 0;
  let activeContext = null;
  let startWork = null;

  function schedule(callback, delay) {
    const timer = clock.setTimeout?.(callback, delay);
    timer?.unref?.();
    return timer;
  }

  function publish(patch = {}) {
    snapshot = { ...snapshot, ...patch };
    onState({ ...snapshot });
    return snapshot;
  }

  function clearTimers() {
    for (const timer of [idleTimer, graceTimer, maxTimer]) if (timer != null) clock.clearTimeout?.(timer);
    idleTimer = null; graceTimer = null; maxTimer = null;
  }

  function cleanupResources() {
    channel?.close?.();
    channel = null;
    peer?.close?.();
    peer = null;
    for (const track of stream?.getTracks?.() || []) track.stop?.();
    stream = null;
    audio?.pause?.();
    if (audio) audio.srcObject = null;
    audio = null;
  }

  function armIdleTimer(currentGeneration) {
    if (idleTimer != null) clock.clearTimeout?.(idleTimer);
    if (graceTimer != null) clock.clearTimeout?.(graceTimer);
    graceTimer = null;
    idleTimer = schedule(() => {
      if (currentGeneration !== generation || !peer) return;
      publish({ state: 'idle_warning', reason: 'idle' });
      graceTimer = schedule(() => {
        if (currentGeneration === generation) stopSession('idle_timeout');
      }, REALTIME_VOICE_IDLE_GRACE_MS);
    }, REALTIME_VOICE_IDLE_MS);
  }

  function stopSession(reason = 'user') {
    generation += 1;
    clearTimers();
    cleanupResources();
    publish({ state: 'ended', muted: false, reason });
    return true;
  }

  function handleServerEvent(raw, currentGeneration) {
    if (currentGeneration !== generation) return;
    let event;
    try { event = JSON.parse(raw); } catch { return; }
    armIdleTimer(currentGeneration);
    if (event.type === 'output_audio_buffer.started') publish({ state: 'speaking', reason: null });
    if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared', 'response.done', 'input_audio_buffer.speech_started'].includes(event.type)) {
      publish({ state: snapshot.muted ? 'muted' : 'listening', reason: null });
    }
    if (['response.output_audio_transcript.delta', 'response.audio_transcript.delta'].includes(event.type) && event.delta) {
      const caption = `${snapshot.caption || ''}${String(event.delta)}`.slice(-4000);
      publish({ caption });
      if (snapshot.captionsEnabled) onCaption({ text: caption, final: false });
    }
    if (event.type === 'response.output_audio_transcript.done' && event.transcript) {
      const caption = String(event.transcript).slice(-4000);
      publish({ caption });
      if (snapshot.captionsEnabled) onCaption({ text: caption, final: true });
    }
  }

  async function establish(context, { reconnect = false } = {}) {
    const currentGeneration = ++generation;
    cleanupResources();
    publish({ state: reconnect ? 'reconnecting' : 'connecting', reason: null, caption: reconnect ? snapshot.caption : '' });
    try {
      stream = await mediaDevices.getUserMedia({ audio: true });
      if (currentGeneration !== generation) { for (const track of stream?.getTracks?.() || []) track.stop?.(); return false; }
      peer = new PeerConnection();
      const currentPeer = peer;
      audio = createAudioElement();
      audio.autoplay = true;
      peer.ontrack = (event) => {
        if (currentGeneration !== generation || currentPeer !== peer) return;
        audio.srcObject = event.streams?.[0] || null;
        audio.play?.().catch?.(() => {});
      };
      for (const track of stream.getTracks?.() || []) peer.addTrack(track, stream);
      channel = peer.createDataChannel('oai-events');
      channel.onmessage = (event) => handleServerEvent(event.data, currentGeneration);
      channel.onopen = () => {
        if (currentGeneration === generation) publish({ state: snapshot.muted ? 'muted' : 'listening', reason: null });
      };
      peer.onconnectionstatechange = () => {
        if (currentGeneration !== generation || currentPeer !== peer) return;
        if (['connected', 'completed'].includes(peer.connectionState)) publish({ state: snapshot.muted ? 'muted' : 'listening', reason: null });
        if (['failed', 'disconnected'].includes(peer.connectionState)) {
          if (reconnects < 1) {
            reconnects += 1;
            establish(activeContext, { reconnect: true }).catch(() => publish({ state: 'failed', reason: 'connection_failed' }));
          } else {
            cleanupResources();
            clearTimers();
            publish({ state: 'failed', reason: 'connection_failed' });
          }
        }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerSdp = await exchangeSdp(offer.sdp, context);
      if (currentGeneration !== generation || currentPeer !== peer) return false;
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      await audio.play?.().catch?.(() => {});
      publish({ state: snapshot.muted ? 'muted' : 'listening', reason: null });
      armIdleTimer(currentGeneration);
      if (!reconnect) {
        maxTimer = schedule(() => {
          if (peer) stopSession('max_session');
        }, REALTIME_VOICE_MAX_MS);
      }
      return true;
    } catch (error) {
      if (currentGeneration !== generation) return false;
      cleanupResources();
      clearTimers();
      const reason = String(error?.name || error?.message || '').includes('NotAllowed') ? 'permission_denied' : 'start_failed';
      publish({ state: 'failed', reason });
      throw error;
    }
  }

  return {
    state: () => ({ ...snapshot }),
    async start(context = {}) {
      if (!supported) { publish({ state: 'unsupported' }); return false; }
      if (startWork) return startWork;
      if (peer) return false;
      reconnects = 0;
      activeContext = normalizeClientContext(context);
      startWork = establish(activeContext);
      try { return await startWork; }
      finally { startWork = null; }
    },
    interrupt() {
      if (!channel || channel.readyState !== 'open') return false;
      channel.send(JSON.stringify({ type: 'response.cancel' }));
      channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
      audio?.pause?.();
      publish({ state: snapshot.muted ? 'muted' : 'listening', reason: null });
      armIdleTimer(generation);
      return true;
    },
    setMuted(muted) {
      if (!stream) return false;
      const value = Boolean(muted);
      for (const track of stream.getAudioTracks?.() || stream.getTracks?.() || []) track.enabled = !value;
      publish({ muted: value, state: value ? 'muted' : 'listening' });
      armIdleTimer(generation);
      return true;
    },
    setCaptions(enabled) {
      publish({ captionsEnabled: Boolean(enabled) });
      return snapshot.captionsEnabled;
    },
    stop: stopSession,
  };
}
