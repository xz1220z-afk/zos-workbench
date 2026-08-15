import { escapeHtml } from './view-utils.mjs?v=2.8.4';

const SCOPES = Object.freeze([
  ['auto', '自动'], ['wanjia', '万嘉'], ['huahuo', '花火'], ['lingli', '玲丽'],
  ['life', '生活'], ['knowledge', '知识库'], ['intelligence', '情报'], ['agent', 'Agent OS'],
]);

const STATE_COPY = Object.freeze({
  idle: '准备好后输入或说出任务', listening: '正在听，只处理本次主动收音',
  transcribing: '正在整理语音，你仍可编辑文字', routing: '正在选择正确来源',
  answering: '正在结合来源分析', completed: '已完成分析',
  preview_required: '等待你的确认', executing: '正在执行已允许动作',
  failed: '本次没有完成，输入内容已保留', unsupported: '当前浏览器不支持语音，请继续使用键盘',
  permission_denied: '未获麦克风权限，请继续使用键盘',
});

function list(items = [], empty = '暂无') {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p class="ai-command-empty">${escapeHtml(empty)}</p>`;
}

function sourcePills(sources = []) {
  if (!sources.length) return '<span class="ai-command-source is-muted">未返回可核验来源</span>';
  return sources.map((source) => {
    const label = typeof source === 'string' ? source : source.label;
    const date = typeof source === 'object' ? source.date : '';
    return `<span class="ai-command-source">${escapeHtml(label || '来源')}${date ? ` · ${escapeHtml(date)}` : ''}</span>`;
  }).join('');
}

function resultPanel(result) {
  if (!result) return '';
  const sections = result.sections || {};
  const actions = result.execution?.actions || [];
  return `<section class="ai-command-result" aria-live="polite">
    <header><div><small>AI RESPONSE</small><h3>${escapeHtml(result.task || '本次任务')}</h3></div><span class="ai-command-level">${escapeHtml(result.execution?.level || 'L0')}</span></header>
    <div class="ai-command-sources">${sourcePills(result.sources)}</div>
    <div class="ai-command-result-grid">
      <article><h4>事实</h4>${list(sections.facts, '当前回答没有新增事实')}</article>
      <article><h4>推断</h4>${list(sections.inference, '未作额外推断')}</article>
      <article><h4>建议</h4>${list(sections.advice, '暂无建议')}</article>
      <article><h4>待确认</h4>${list(sections.pending, '暂无待确认项')}</article>
      <article><h4>下一步</h4>${list(sections.next, '可继续追问或选择下方操作')}</article>
    </div>
    ${actions.length ? `<div class="ai-command-actions">${actions.map((action, index) => `<button type="button" class="v13-action${action.type === 'save_task_draft' ? ' v13-action-primary' : ''}" data-ai-command-action="${index}">${escapeHtml(action.label || action.title || (action.type === 'navigate' ? '打开页面' : '查看操作'))}</button>`).join('')}</div>` : ''}
  </section>`;
}

function previewPanel(preview) {
  if (!preview) return '';
  return `<section class="ai-command-preview" role="region" aria-label="高风险操作预览">
    <header><div><small>L2 CONTROLLED ACTION</small><h3>等待你的确认</h3></div><span>尚未执行</span></header>
    <dl><div><dt>对象</dt><dd>${escapeHtml(preview.target || '待确认')}</dd></div><div><dt>精确变更</dt><dd>${escapeHtml(JSON.stringify(preview.changes || {}))}</dd></div><div><dt>影响范围</dt><dd>${escapeHtml(preview.impact || '待确认')}</dd></div><div><dt>测试方案</dt><dd>${escapeHtml(preview.testPlan || '执行后回读')}</dd></div><div><dt>回滚方案</dt><dd>${escapeHtml(preview.rollback || '停止执行')}</dd></div></dl>
    <button type="button" class="v13-action" data-ai-command-confirm disabled>当前仅生成预览，安全执行器未接入</button>
  </section>`;
}

export function renderAiCommandHtml(model = {}) {
  const voice = model.voice || { supported: false, state: 'unsupported' };
  const state = model.state || 'idle';
  const listening = voice.state === 'listening' || state === 'listening';
  const busy = ['routing', 'answering', 'executing'].includes(state);
  return `<section class="ai-command v25-glass-hero" data-ai-command-state="${escapeHtml(state)}">
    <header class="ai-command-heading"><div><small>AI COMMAND · CONTROLLED EXECUTION</small><h2>说出你要完成的事</h2><p>不用先找页面。系统会选择业务数据、知识库或合适的 Agent，再把事实、判断与下一步分开给你。</p></div><div class="ai-command-boundary"><strong>C 级受控执行</strong><span>查询直接完成 · 草案可撤销 · 外部动作先确认</span></div></header>
    <form data-ai-command-form>
      <label for="aiCommandInput">任务</label>
      <div class="ai-command-composer">
        <textarea id="aiCommandInput" name="task" data-ai-command-input rows="3" placeholder="例如：查一下万嘉今天最需要处理的商家，并生成可撤销的任务草案">${escapeHtml(model.input || '')}</textarea>
        <button type="button" class="ai-command-mic${listening ? ' is-listening' : ''}" data-ai-voice-toggle aria-label="按住说话或点击麦克风" aria-pressed="${listening ? 'true' : 'false'}" ${voice.supported ? '' : 'disabled'}><span aria-hidden="true">${listening ? '■' : '●'}</span><small>${listening ? '松开结束' : '说话'}</small></button>
      </div>
      <div class="ai-command-scopes" role="group" aria-label="任务范围">${SCOPES.map(([value, label]) => `<button type="button" data-ai-command-scope="${value}" class="${model.scope === value ? 'is-active' : ''}" aria-pressed="${model.scope === value ? 'true' : 'false'}">${label}</button>`).join('')}</div>
      <div class="ai-command-footer"><div><strong>${escapeHtml(STATE_COPY[state] || STATE_COPY.idle)}</strong><small>${voice.supported ? '按住或点击后才收音；不持续监听，不保存原始音频。' : '当前浏览器不支持语音；键盘输入不受影响。'}</small>${model.error ? `<em>${escapeHtml(model.error)}</em>` : ''}</div><button type="submit" class="v13-action v13-action-primary" data-ai-command-submit ${busy ? 'disabled' : ''}>${busy ? '处理中…' : '交给 AI'}</button></div>
    </form>
    ${model.undo ? `<div class="ai-command-undo"><span>草案已保存到现有任务系统，可随时撤销。</span><button type="button" class="v13-action" data-ai-command-undo>撤销本次草案</button></div>` : ''}
    ${resultPanel(model.result)}${previewPanel(model.preview)}
  </section>`;
}

export function render(container, model = {}) {
  if (container) container.innerHTML = renderAiCommandHtml(model);
}
