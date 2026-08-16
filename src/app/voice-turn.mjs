export function createBrowserSpeechOutput(options = {}) {
  const globalObject = options.globalObject || globalThis;
  const speechSynthesis = options.speechSynthesis !== undefined
    ? options.speechSynthesis
    : globalObject.speechSynthesis;
  const Utterance = options.SpeechSynthesisUtterance !== undefined
    ? options.SpeechSynthesisUtterance
    : globalObject.SpeechSynthesisUtterance;
  const supported = Boolean(speechSynthesis
    && typeof speechSynthesis.speak === 'function'
    && typeof speechSynthesis.cancel === 'function'
    && typeof Utterance === 'function');

  return {
    supported,
    speak(text) {
      const value = String(text || '').trim();
      if (!supported || !value) return false;
      const utterance = new Utterance(value);
      utterance.lang = options.lang || 'zh-CN';
      utterance.rate = Number(options.rate) || 1;
      speechSynthesis.speak(utterance);
      return true;
    },
    stop() {
      if (!supported) return false;
      speechSynthesis.cancel();
      return true;
    },
  };
}

export function createVoiceTurn({ ask, speaker, onState = () => {} } = {}) {
  if (typeof ask !== 'function') throw new Error('voice_turn_ask_required');
  const output = speaker || { supported: false, speak: () => false, stop: () => false };
  let generation = 0;
  let destroyed = false;

  function stopAudio() {
    const stopped = output.stop?.();
    return stopped === true || (stopped !== false && output.supported === true);
  }

  return {
    async submit(payload, options = {}) {
      const turnGeneration = ++generation;
      destroyed = false;
      stopAudio();
      onState('answering');
      try {
        const response = await ask(payload);
        if (destroyed || turnGeneration !== generation) return null;
        options.onAnswer?.(response);
        onState('answered');
        if (options.speak === true && output.supported && response?.answer) {
          output.speak(response.answer);
          onState('speaking');
        }
        return response;
      } catch (error) {
        if (!destroyed && turnGeneration === generation) onState('failed');
        throw error;
      }
    },
    stopAudio,
    cancel() {
      generation += 1;
      stopAudio();
      onState('idle');
    },
    destroy() {
      destroyed = true;
      generation += 1;
      stopAudio();
    },
  };
}
