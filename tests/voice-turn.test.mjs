import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserSpeechOutput, createVoiceTurn } from '../src/app/voice-turn.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('quick voice does not call ChatGPT until the editable transcript is submitted', async () => {
  const calls = [];
  const spoken = [];
  const answers = [];
  const turn = createVoiceTurn({
    ask: async (payload) => {
      calls.push(payload);
      return { state: 'answered', answer: '这是基于已授权知识的回答。' };
    },
    speaker: { supported: true, speak: (text) => spoken.push(text), stop() {} },
  });

  assert.equal(calls.length, 0);
  await turn.submit({ mode: 'command', question: '查一下以前的定价方法' }, {
    speak: true,
    onAnswer: (response) => answers.push(response.answer),
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(answers, ['这是基于已授权知识的回答。']);
  assert.deepEqual(spoken, ['这是基于已授权知识的回答。']);
});

test('text answer is committed before optional spoken output and audio can stop immediately', async () => {
  const order = [];
  let stops = 0;
  const turn = createVoiceTurn({
    ask: async () => ({ state: 'answered', answer: '先显示文字，再朗读。' }),
    speaker: {
      supported: true,
      speak(text) { order.push(`speak:${text}`); },
      stop() { stops += 1; order.push('stop'); },
    },
  });

  await turn.submit({ mode: 'command', question: '解释一下' }, {
    speak: true,
    onAnswer: () => order.push('answer'),
  });
  assert.deepEqual(order, ['stop', 'answer', 'speak:先显示文字，再朗读。']);
  assert.equal(turn.stopAudio(), true);
  assert.equal(stops, 2);
});

test('a stale ChatGPT result cannot overwrite a newer turn', async () => {
  const first = deferred();
  const second = deferred();
  const answers = [];
  let call = 0;
  const turn = createVoiceTurn({
    ask: () => (++call === 1 ? first.promise : second.promise),
    speaker: { supported: false, speak() {}, stop() {} },
  });

  const oldTurn = turn.submit({ question: '旧问题' }, { onAnswer: (response) => answers.push(response.answer) });
  const newTurn = turn.submit({ question: '新问题' }, { onAnswer: (response) => answers.push(response.answer) });
  first.resolve({ state: 'answered', answer: '旧回答' });
  second.resolve({ state: 'answered', answer: '新回答' });

  assert.equal(await oldTurn, null);
  assert.equal((await newTurn).answer, '新回答');
  assert.deepEqual(answers, ['新回答']);
});

test('destroy cancels speech and ignores late answers', async () => {
  const pending = deferred();
  const answers = [];
  let stops = 0;
  const turn = createVoiceTurn({
    ask: () => pending.promise,
    speaker: { supported: true, speak() {}, stop() { stops += 1; } },
  });
  const request = turn.submit({ question: '待完成' }, { speak: true, onAnswer: (response) => answers.push(response.answer) });
  turn.destroy();
  pending.resolve({ state: 'answered', answer: '不应出现' });

  assert.equal(await request, null);
  assert.deepEqual(answers, []);
  assert.equal(stops >= 1, true);
});

test('browser speech output never stores audio and safely degrades to text only', () => {
  const spoken = [];
  let cancelled = 0;
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const output = createBrowserSpeechOutput({
    speechSynthesis: { speak: (utterance) => spoken.push(utterance.text), cancel: () => { cancelled += 1; } },
    SpeechSynthesisUtterance: Utterance,
  });
  assert.equal(output.supported, true);
  output.speak('安全回答');
  output.stop();
  assert.deepEqual(spoken, ['安全回答']);
  assert.equal(cancelled, 1);
  assert.equal(Object.hasOwn(output, 'audio'), false);

  const unsupported = createBrowserSpeechOutput({ speechSynthesis: null, SpeechSynthesisUtterance: null });
  assert.equal(unsupported.supported, false);
  assert.equal(unsupported.speak('仍显示文字'), false);
});
