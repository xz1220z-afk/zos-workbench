import { createStateStore } from './app/state-store.mjs';
import { render as renderDashboard } from './app/views/dashboard-view.mjs';
import { render as renderDecisions } from './app/views/decision-view.mjs';
import { render as renderTargets } from './app/views/targets-view.mjs';
import { render as renderHealth } from './app/views/health-view.mjs';
import { render as renderMobile } from './app/views/mobile-view.mjs';
import { createBrowserOperatingRuntime } from './app/browser-runtime.mjs';

export const APP_VERSION = '1.3.0';

function browserId() {
  return globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}`;
}

export function createCeoOsApplication(config = {}) {
  const document = config.document || globalThis.document;
  const storage = config.storage || globalThis.localStorage;
  const now = config.now || (() => new Date().toISOString());
  const deviceId = storage?.getItem?.('zos_device_id') || browserId();
  const store = config.store || createStateStore({ storage, now, deviceId, createId: browserId });
  const runtime = {
    health: [], gaps: [], briefs: [], conflicts: [], approvals: [], decisions: [], targets: [],
    businessExceptions: [], syncStatus: '等待首次同步', loopConnected: false,
  };
  let operatingRuntime = config.operatingRuntime || null;
  let actionsBound = false;

  function signalLocalChange() {
    try { (config.eventTarget || globalThis).dispatchEvent(new Event('zos:local-change')); } catch { /* Optional outside browsers. */ }
  }

  function viewModel() {
    const state = store.load();
    const decisions = runtime.loopConnected ? runtime.decisions : (state.collections.decisions || []);
    const brief = runtime.brief || runtime.briefs.at(-1) || null;
    return {
      ...runtime,
      decisions,
      targets: runtime.loopConnected ? runtime.targets : (state.collections.targets || []),
      tasks: state.collections.tasks || [],
      inbox: state.collections.inbox || [],
      todayTop3: brief?.sections?.todayTop3 || [],
      brief,
    };
  }

  function updateFromOperatingLoop(brief = null) {
    if (!operatingRuntime?.operatingLoop) return;
    const next = operatingRuntime.operatingLoop.getState();
    Object.assign(runtime, next, {
      loopConnected: true,
      syncStatus: next.conflicts?.length ? '发现同步冲突' : '经营闭环已连接',
      brief: brief || next.briefs?.at(-1) || null,
    });
    const knownHealth = new Map((runtime.health || []).map((item) => [item.source, item]));
    runtime.health = ['wanjia', 'huahuo', 'projects', 'brain', 'sync', 'feishu_write']
      .map((source) => knownHealth.get(source) || { source, state: 'pending', recordCount: null, lastSuccessAt: null });
    const current = store.load();
    for (const decision of next.decisions || []) {
      const existing = current.collections.decisions.find((item) => item.id === decision.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(decision)) store.saveEntity('decisions', decision);
    }
  }

  async function refreshSource(source) {
    if (!operatingRuntime?.operatingLoop) throw new Error('请先登录 Supabase');
    await operatingRuntime.operatingLoop.refresh(source);
    const targets = store.load().collections.targets || [];
    if (targets.length) operatingRuntime.operatingLoop.confirmTargets(targets);
    const brief = operatingRuntime.operatingLoop.ensureDailyBrief();
    updateFromOperatingLoop(brief);
    renderAll();
    return viewModel();
  }

  function confirmTarget(input = {}) {
    if (!operatingRuntime?.operatingLoop) throw new Error('请先登录 Supabase');
    const metricKey = String(input.metricKey || '').trim();
    const period = String(input.period || '').trim();
    const value = Number(input.value);
    const target = store.saveEntity('targets', {
      id: input.id || `target:${metricKey}:${period}`,
      metricKey, value, period, confirmation: 'confirmed',
    });
    operatingRuntime.operatingLoop.confirmTargets(store.load().collections.targets || []);
    updateFromOperatingLoop();
    signalLocalChange();
    renderAll();
    return target;
  }

  async function previewDecision(decisionId) {
    if (!operatingRuntime?.operatingLoop) throw new Error('请先登录 Supabase');
    const decision = runtime.decisions.find((item) => item.id === decisionId);
    if (!decision?.sourceRecordId || !decision?.recommendedAction) throw new Error('此决策缺少可回写的真实记录或建议动作');
    const preview = await operatingRuntime.operatingLoop.previewFeishu({
      source: decision.source,
      recordId: decision.sourceRecordId,
      action: 'set_next_action',
      value: decision.recommendedAction,
    });
    runtime.preview = preview;
    updateFromOperatingLoop();
    runtime.preview = preview;
    renderAll();
    return preview;
  }

  async function executeApproval(approvalId) {
    if (!operatingRuntime?.operatingLoop) throw new Error('请先登录 Supabase');
    const result = await operatingRuntime.operatingLoop.executeFeishu(approvalId);
    updateFromOperatingLoop();
    runtime.preview = null;
    renderAll();
    return result;
  }

  function quickCapture(title) {
    const text = String(title || '').trim();
    if (!text) return null;
    const item = store.saveEntity('inbox', { title: text, kind: 'quick_capture', status: 'pending_review' });
    signalLocalChange();
    renderAll();
    return item;
  }

  function bindActions() {
    if (actionsBound || !document?.addEventListener) return;
    actionsBound = true;
    document.addEventListener('click', async (event) => {
      const previewButton = event.target?.closest?.('[data-preview-decision]');
      const executeButton = event.target?.closest?.('[data-execute-approval]');
      const refreshButton = event.target?.closest?.('[data-refresh-source]');
      const captureButton = event.target?.closest?.('[data-quick-capture]');
      try {
        if (previewButton) await previewDecision(previewButton.dataset.previewDecision);
        else if (executeButton) await executeApproval(executeButton.dataset.executeApproval);
        else if (refreshButton) await refreshSource(refreshButton.dataset.refreshSource);
        else if (captureButton) quickCapture((config.prompt || globalThis.prompt)?.('记录一条想法或任务'));
      } catch { runtime.syncStatus = '操作未完成，请检查登录与数据权限'; renderAll(); }
    });
    document.addEventListener('submit', (event) => {
      if (event.target?.id !== 'confirmedTargetForm') return;
      event.preventDefault();
      const data = new FormData(event.target);
      try {
        confirmTarget({ metricKey: data.get('metricKey'), value: data.get('value'), period: data.get('period') });
        event.target.reset();
      } catch { runtime.syncStatus = '目标保存失败，请检查数值和登录状态'; renderAll(); }
    });
  }

  function renderAll() {
    const model = viewModel();
    renderDashboard(document?.getElementById('ceoDashboardRoot'), model);
    renderDecisions(document?.getElementById('decisionCenterRoot'), model);
    renderTargets(document?.getElementById('targetCenterRoot'), model);
    renderHealth(document?.getElementById('healthCenterRoot'), model);
    renderMobile(document?.getElementById('mobileDashboardRoot'), model);
    const badge = document?.getElementById('decisionBadge');
    if (badge) {
      badge.textContent = String(model.decisions.filter((item) => ['open', 'pending_resolution'].includes(item.status)).length);
      badge.style.display = badge.textContent === '0' ? 'none' : '';
    }
  }

  async function start() {
    config.hydrateHealth && Object.assign(runtime, { health: await config.hydrateHealth() });
    const session = config.readSession?.();
    if (session?.refreshToken && config.refreshSession) await config.refreshSession(session.refreshToken);
    if (!operatingRuntime && config.createOperatingRuntime !== false) {
      operatingRuntime = await createBrowserOperatingRuntime({
        storage, store, deviceId, now,
        fetchImpl: config.fetchImpl || globalThis.fetch,
        eventTarget: config.eventTarget || globalThis,
        document,
      });
    }
    const syncController = operatingRuntime?.syncController || config.syncController;
    syncController?.start?.();
    if (syncController?.sync) {
      try { await syncController.sync('startup'); runtime.syncStatus = '跨端同步完成'; }
      catch { runtime.syncStatus = '跨端同步失败，可稍后重试'; }
    }
    if (operatingRuntime?.operatingLoop) {
      for (const source of ['wanjia', 'huahuo']) {
        try { await operatingRuntime.operatingLoop.refresh(source); }
        catch { runtime.health.push({ source, state: 'failed', safeCode: 'source_refresh_failed' }); }
      }
      const targets = store.load().collections.targets || [];
      if (targets.length) operatingRuntime.operatingLoop.confirmTargets(targets);
      const brief = operatingRuntime.operatingLoop.ensureDailyBrief();
      updateFromOperatingLoop(brief);
      if (brief && !(store.load().collections.inbox || []).some((item) => item.id === brief.id)) {
        store.saveEntity('inbox', { ...brief, title: `CEO 每日简报｜${brief.date}`, status: 'pending_review' });
      }
    }
    config.ensureDailyBrief && Object.assign(runtime, { briefs: await config.ensureDailyBrief(viewModel()) });
    store.subscribe(renderAll);
    bindActions();
    renderAll();
    return viewModel();
  }

  return {
    start, render: renderAll, store, runtime, viewModel,
    refreshSource, confirmTarget, previewDecision, executeApproval, quickCapture,
    get operatingRuntime() { return operatingRuntime; },
  };
}

if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  const application = createCeoOsApplication();
  application.start().catch(() => {
    application.runtime.syncStatus = '初始化失败，请刷新页面';
    application.render();
  });
  window.ZOS_CEO_OS = application;
}
