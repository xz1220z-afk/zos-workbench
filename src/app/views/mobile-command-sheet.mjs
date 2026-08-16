import { escapeHtml } from './view-utils.mjs?v=2.10.0';

export function renderMobileCommandSheetHtml(model = {}) {
  if (!model.open) return '';
  const voice = model.voice || { supported: false, state: 'unsupported' };
  const listening = voice.state === 'listening';
  const realtime = model.realtimeVoice || { supported: false, state: 'unsupported', muted: false, captionsEnabled: true, caption: '' };
  const realtimeActive = ['connecting', 'reconnecting', 'listening', 'speaking', 'muted', 'idle_warning'].includes(realtime.state);
  const realtimeControls = realtimeActive
    ? `<section class="mobile-realtime-voice" data-ai-realtime-state="${escapeHtml(realtime.state)}">
        <strong>${realtime.state === 'speaking' ? 'ChatGPT 正在回答' : realtime.state === 'muted' ? '麦克风已静音' : '实时对话已连接'}</strong>
        ${realtime.captionsEnabled && realtime.caption ? `<p aria-live="polite">${escapeHtml(realtime.caption)}</p>` : ''}
        <div><button type="button" data-ai-realtime-interrupt ${realtime.state === 'speaking' ? '' : 'disabled'}>打断</button><button type="button" data-ai-realtime-mute>${realtime.muted ? '恢复麦克风' : '静音'}</button><button type="button" data-ai-realtime-captions>${realtime.captionsEnabled ? '隐藏字幕' : '显示字幕'}</button><button type="button" data-ai-realtime-stop>结束</button></div>
      </section>`
    : `<button type="button" class="mobile-realtime-start" data-ai-realtime-start ${realtime.supported ? '' : 'disabled'}>实时对话</button>`;
  return `<div class="mobile-ai-backdrop" data-mobile-ai-close></div>
    <aside class="mobile-ai-sheet" data-mobile-ai-command-sheet role="dialog" aria-modal="true" aria-labelledby="mobileAiTitle">
      <header><div><small>AI OFFICE</small><h2 id="mobileAiTitle">说出或输入任务</h2></div><button type="button" data-mobile-ai-close aria-label="关闭">×</button></header>
      <form data-ai-command-form>
        <label for="mobileAiCommandInput">任务</label>
        <textarea id="mobileAiCommandInput" data-ai-command-input name="command" rows="4">${escapeHtml(model.input || '')}</textarea>
        <div class="mobile-ai-controls">
          <button type="button" data-ai-voice-toggle aria-pressed="${listening}">${listening ? '松开结束' : '按住说话'}</button>
          <button type="submit" class="v13-action v13-action-primary">交给 AI</button>
        </div>
      </form>
      ${realtimeControls}
      <p>${voice.supported ? '快捷语音只转成可编辑文字；实时对话不保存原始音频。' : '当前浏览器不支持快捷语音；键盘输入仍可使用。'}</p>
    </aside>`;
}

export function renderMobileCommandSheet(container, model = {}) {
  if (container) container.innerHTML = renderMobileCommandSheetHtml(model);
}
