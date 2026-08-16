import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMobileCommandSheetHtml } from '../src/app/views/mobile-command-sheet.mjs';

test('mobile command sheet keeps voice optional and typed input available', () => {
  const html = renderMobileCommandSheetHtml({
    open: true,
    input: '查一下万嘉今天的数据',
    scope: 'wanjia',
    state: 'idle',
    voice: { supported: false, state: 'unsupported' },
  });
  assert.match(html, /data-mobile-ai-command-sheet/);
  assert.match(html, /查一下万嘉今天的数据/);
  assert.match(html, /data-ai-command-input/);
  assert.match(html, /当前浏览器不支持快捷语音/);
  assert.doesNotMatch(html, /disabled[^>]*data-ai-command-input/);
});

test('mobile command sheet labels its keyboard task input', () => {
  const html = renderMobileCommandSheetHtml({ open: true, voice: { supported: true, state: 'idle' } });
  assert.match(html, /<label for="mobileAiCommandInput">任务<\/label>/);
  assert.match(html, /<textarea id="mobileAiCommandInput"[^>]*data-ai-command-input/);
});
