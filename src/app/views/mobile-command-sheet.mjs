import { escapeHtml } from './view-utils.mjs?v=2.10.0';

export function renderMobileCommandSheetHtml(model = {}) {
  if (!model.open) return '';
  const voice = model.voice || { supported: false, state: 'unsupported' };
  const listening = voice.state === 'listening';
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
      <p>${voice.supported ? '只在你主动操作时收音，不保存原始音频。' : '当前浏览器不支持语音；键盘输入仍可使用。'}</p>
    </aside>`;
}

export function renderMobileCommandSheet(container, model = {}) {
  if (container) container.innerHTML = renderMobileCommandSheetHtml(model);
}
