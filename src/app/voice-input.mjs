export function createVoiceInput(options = {}) {
  const globalObject = options.globalObject || globalThis;
  const Recognition = options.Recognition !== undefined
    ? options.Recognition
    : globalObject.SpeechRecognition || globalObject.webkitSpeechRecognition;
  if (typeof Recognition !== 'function') {
    return {
      supported: false,
      state: () => 'unsupported',
      start: () => false,
      stop: () => false,
      destroy() {},
    };
  }

  const recognition = new Recognition();
  recognition.lang = options.lang || 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  let currentState = 'idle';

  function setState(state) {
    currentState = state;
    options.onState?.(state);
  }

  recognition.onresult = (event) => {
    const start = Number.isInteger(event?.resultIndex) ? event.resultIndex : 0;
    for (let index = start; index < (event?.results?.length || 0); index += 1) {
      const result = event.results[index];
      const transcript = String(result?.[0]?.transcript || '').trim();
      if (transcript) options.onTranscript?.(transcript, { final: Boolean(result.isFinal) });
    }
  };
  recognition.onerror = (event) => {
    const error = event?.error === 'not-allowed' || event?.error === 'service-not-allowed'
      ? 'permission_denied' : 'failed';
    setState(error);
    options.onError?.(error);
  };
  recognition.onend = () => {
    if (currentState !== 'permission_denied' && currentState !== 'failed') setState('idle');
  };

  return {
    supported: true,
    state: () => currentState,
    start() {
      if (currentState === 'listening') return true;
      setState('listening');
      try {
        recognition.start();
        return true;
      } catch {
        setState('failed');
        options.onError?.('failed');
        return false;
      }
    },
    stop() {
      if (currentState !== 'listening') return false;
      setState('transcribing');
      try {
        recognition.stop();
        return true;
      } catch {
        setState('failed');
        options.onError?.('failed');
        return false;
      }
    },
    destroy() {
      try { recognition.abort?.(); } catch { /* Already stopped. */ }
      currentState = 'idle';
    },
  };
}
