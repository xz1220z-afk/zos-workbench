import test from 'node:test';
import assert from 'node:assert/strict';

import { renderAiCommandHtml } from '../src/app/views/ai-command-view.mjs';
import { renderMobileCommandSheetHtml } from '../src/app/views/mobile-command-sheet.mjs';

test('AI command center clearly separates quick voice from realtime conversation', () => {
  const html = renderAiCommandHtml({
    state: 'idle', scope: 'auto', voice: { supported: true, state: 'idle' },
    realtimeVoice: { supported: true, state: 'idle', muted: false, captionsEnabled: true, caption: '' },
  });
  assert.match(html, /data-ai-voice-toggle/);
  assert.match(html, /data-ai-realtime-start/);
  assert.match(html, />实时对话</);
  assert.match(html, /快捷语音只转成可编辑文字/);
  assert.match(html, /实时对话不保存原始音频/);
});

test('mobile command sheet offers the same explicit realtime voice entry and privacy boundary', () => {
  const html = renderMobileCommandSheetHtml({
    open: true, voice: { supported: true, state: 'idle' },
    realtimeVoice: { supported: true, state: 'idle', muted: false, captionsEnabled: true, caption: '' },
  });
  assert.match(html, /data-ai-realtime-start/);
  assert.match(html, /实时对话/);
  assert.match(html, /不保存原始音频/);
});

test('active realtime conversation exposes end, interrupt, mute and caption controls', () => {
  const html = renderAiCommandHtml({
    state: 'idle', scope: 'auto', voice: { supported: true, state: 'idle' },
    realtimeVoice: { supported: true, state: 'speaking', muted: false, captionsEnabled: true, caption: '正在回答你' },
  });
  assert.match(html, /data-ai-realtime-stop/);
  assert.match(html, /data-ai-realtime-interrupt/);
  assert.match(html, /data-ai-realtime-mute/);
  assert.match(html, /data-ai-realtime-captions/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /正在回答你/);
});

test('realtime service failure stays retryable and gives an actionable safe reason', () => {
  const html = renderAiCommandHtml({
    input: '', scope: 'auto', state: 'idle', voice: { supported: true, state: 'idle' },
    realtimeVoice: { supported: true, state: 'failed', reason: 'ai_quota_exhausted', captionsEnabled: true },
  });
  assert.match(html, /OpenAI 账户额度不足/);
  assert.match(html, /data-ai-realtime-start/);
  assert.doesNotMatch(html, /data-ai-realtime-start disabled/);
  assert.doesNotMatch(html, /当前浏览器不支持实时对话/);
});
