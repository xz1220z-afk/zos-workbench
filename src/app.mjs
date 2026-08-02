import { createStateStore } from './app/state-store.mjs';
import { render as renderDashboard } from './app/views/dashboard-view.mjs';
import { render as renderDecisions } from './app/views/decision-view.mjs';
import { render as renderTargets } from './app/views/targets-view.mjs';
import { render as renderHealth } from './app/views/health-view.mjs';
import { render as renderMobile } from './app/views/mobile-view.mjs';
import { createBrowserOperatingRuntime } from './app/browser-runtime.mjs';
import { buildCalendar, calendarPeriod, detectCalendarConflicts, redactLifeEventForWork } from './app/calendar-center.mjs';
import { normalizeIntelligenceItem, todayMustRead, transitionIntelligence } from './app/intelligence-center.mjs';
import { summarizeLife } from './app/life-os.mjs';
import { buildSearchIndex, searchWorkspace } from './app/search-center.mjs';
import { render as renderIntelligence } from './app/views/intelligence-view.mjs';
import { render as renderCalendar } from './app/views/calendar-view.mjs';
import { render as renderLife } from './app/views/life-view.mjs';
import { render as renderSearch } from './app/views/search-view.mjs';
import { render as renderLingli } from './app/views/lingli-view.mjs';
import { buildRelations } from './app/relation-center.mjs';
import { createReviewDraft } from './app/review-center.mjs';
import { render as renderRelations } from './app/views/relation-view.mjs';
import { render as renderReviews } from './app/views/review-view.mjs';

export const APP_VERSION = '1.4.2';

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
    businessExceptions: [], intelligence: [], intelligenceState: 'loading', intelligenceCompany: 'all',
    calendarView: 'week', searchQuery: '', searchResults: [],
    syncStatus: '等待首次同步', loopConnected: false,
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
    const intelligence = runtime.intelligence.length ? runtime.intelligence : (state.collections.intelligence || []);
    const life = state.collections.life || [];
    const sources = runtime.sources || {};
    const businessRecords = ['wanjia', 'huahuo', 'lingli'].flatMap((source) => {
      const payload = sources[source]?.records;
      const rows = Array.isArray(payload) ? payload : payload?.records || [];
      return rows.map((item) => ({ ...item, source, company: source, title: item.merchantName || item.projectName || item.name }));
    });
    const projects = state.collections.projects || [];
    const calendar = buildCalendar({
      calendar: state.collections.calendar || [],
      tasks: state.collections.tasks || [],
      projects: [...projects, ...businessRecords].map((item) => ({ ...item, dueAt: item.dueAt || item.dueDate || item.shootingDate })),
      life,
      intelligence,
    }).map((item) => item.company === 'life' ? redactLifeEventForWork(item) : item);
    const visibleCalendar = calendarPeriod(calendar, { view: runtime.calendarView, anchor: now() });
    const filteredIntelligence = runtime.intelligenceCompany === 'all'
      ? todayMustRead(intelligence, { now: now(), limit: 100 })
      : intelligence.filter((item) => (item.relevantCompanies || []).includes(runtime.intelligenceCompany));
    const searchIndex = buildSearchIndex({
      business: businessRecords,
      knowledge: runtime.brain?.notes || [],
      intelligence,
      actions: [...(state.collections.tasks || []), ...(state.collections.inbox || [])],
      life,
    });
    return {
      ...runtime,
      decisions,
      targets: runtime.loopConnected ? runtime.targets : (state.collections.targets || []),
      tasks: state.collections.tasks || [],
      inbox: state.collections.inbox || [],
      todayTop3: brief?.sections?.todayTop3 || [],
      brief,
      sources,
      intelligence: filteredIntelligence,
      intelligenceCompany: runtime.intelligenceCompany,
      mustRead: todayMustRead(intelligence, { now: now() }),
      calendar: visibleCalendar,
      calendarView: runtime.calendarView,
      calendarConflicts: detectCalendarConflicts(calendar),
      relations: buildRelations(businessRecords),
      life,
      lifeSummary: summarizeLife(life),
      searchResults: searchWorkspace(searchIndex, runtime.searchQuery),
      today: now().slice(0, 10),
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

  function captureCalendar(input = {}) {
    const title = String(input.title || '').trim();
    const start = new Date(String(input.startAt || '').replace(' ', 'T'));
    if (!title || Number.isNaN(start.getTime())) throw new Error('日程标题和时间不能为空');
    const item = store.saveEntity('calendar', {
      title, startAt: start.toISOString(), endAt: input.endAt || null,
      company: input.company || 'ceo', privacy: input.privacy || 'work', status: 'scheduled',
    });
    signalLocalChange();
    renderAll();
    return item;
  }

  function generateReview(type) {
    const draft = createReviewDraft(type, { ...viewModel(), date: now().slice(0, 10), generatedAt: now() });
    const item = store.saveEntity('inbox', draft);
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
      const pageButton = event.target?.closest?.('[data-page]');
      const intelligenceButton = event.target?.closest?.('[data-intelligence-status]');
      const intelligenceRefresh = event.target?.closest?.('[data-refresh-intelligence]');
      const lifeCapture = event.target?.closest?.('[data-life-capture]');
      const calendarCapture = event.target?.closest?.('[data-calendar-capture]');
      const calendarView = event.target?.closest?.('[data-calendar-view]');
      const intelligenceCompany = event.target?.closest?.('[data-intelligence-company]');
      const reviewDraft = event.target?.closest?.('[data-review-draft]');
      try {
        if (previewButton) await previewDecision(previewButton.dataset.previewDecision);
        else if (executeButton) await executeApproval(executeButton.dataset.executeApproval);
        else if (refreshButton) await refreshSource(refreshButton.dataset.refreshSource);
        else if (captureButton) quickCapture((config.prompt || globalThis.prompt)?.('记录一条想法或任务'));
        else if (intelligenceButton) {
          const current = viewModel().intelligence.find((item) => item.externalId === intelligenceButton.dataset.intelligenceId);
          const next = transitionIntelligence(current, intelligenceButton.dataset.intelligenceStatus);
          store.saveEntity('intelligence', { ...next, id: `intelligence:${next.externalId}` });
          if (next.status === 'actioned') quickCapture(`跟进情报：${next.title}`);
        } else if (intelligenceRefresh) {
          if (!operatingRuntime?.loadIntelligence) {
            runtime.intelligenceState = 'authentication_required'; renderAll();
          } else {
            runtime.intelligenceState = 'loading'; renderAll();
            applyIntelligenceResult(await operatingRuntime.loadIntelligence({ refresh: true }));
            renderAll();
          }
        } else if (intelligenceCompany) {
          runtime.intelligenceCompany = intelligenceCompany.dataset.intelligenceCompany || 'all';
          renderAll();
        } else if (calendarView) {
          runtime.calendarView = ['day', 'week', 'month'].includes(calendarView.dataset.calendarView) ? calendarView.dataset.calendarView : 'week';
          renderAll();
        } else if (calendarCapture) {
          const ask = config.prompt || globalThis.prompt;
          const title = ask?.('日程标题');
          if (String(title || '').trim()) {
            const startAt = ask?.('开始时间（YYYY-MM-DD HH:mm）', `${now().slice(0, 10)} 09:00`);
            captureCalendar({ title, startAt });
          }
        } else if (lifeCapture) {
          const title = (config.prompt || globalThis.prompt)?.('记录一条生活事项');
          if (String(title || '').trim()) store.saveEntity('life', { title: String(title).trim(), area: 'review', status: 'open', privacy: 'private' });
        } else if (reviewDraft) generateReview(reviewDraft.dataset.reviewDraft);
        else if (pageButton && globalThis.window?.navigateTo) globalThis.window.navigateTo(pageButton.dataset.page);
      } catch { runtime.syncStatus = '操作未完成，请检查登录与数据权限'; renderAll(); }
    });
    document.addEventListener('submit', (event) => {
      if (event.target?.id === 'globalSearchForm') {
        event.preventDefault();
        runtime.searchQuery = String(new FormData(event.target).get('query') || '').trim();
        renderAll();
        return;
      }
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
    renderIntelligence(document?.getElementById('intelligenceCenterRoot'), model);
    renderCalendar(document?.getElementById('calendarCenterRoot'), model);
    renderLife(document?.getElementById('lifeCenterRoot'), model);
    renderSearch(document?.getElementById('searchCenterRoot'), model);
    renderLingli(document?.getElementById('lingliCenterRoot'), model);
    renderRelations(document?.getElementById('relationCenterRoot'), model);
    renderReviews(document?.getElementById('reviewCenterRoot'), model);
    const badge = document?.getElementById('decisionBadge');
    if (badge) {
      badge.textContent = String(model.decisions.filter((item) => ['open', 'pending_resolution'].includes(item.status)).length);
      badge.style.display = badge.textContent === '0' ? 'none' : '';
    }
  }

  function applyIntelligenceResult(result) {
    const items = Array.isArray(result) ? result : (result?.items || []);
    runtime.intelligence = items.map(normalizeIntelligenceItem);
    const sourceState = Array.isArray(result) ? null : result?.state;
    runtime.intelligenceState = runtime.intelligence.length
      ? null
      : (sourceState === 'pending_configuration' ? 'pending_configuration' : 'empty');
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
    if (!operatingRuntime) runtime.intelligenceState = 'authentication_required';
    const syncController = operatingRuntime?.syncController || config.syncController;
    syncController?.start?.();
    if (syncController?.sync) {
      try { await syncController.sync('startup'); runtime.syncStatus = '跨端同步完成'; }
      catch { runtime.syncStatus = '跨端同步失败，可稍后重试'; }
    }
    if (operatingRuntime?.operatingLoop) {
      try {
        applyIntelligenceResult(await operatingRuntime.loadIntelligence?.());
      } catch { runtime.intelligenceState = 'failed'; }
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
    refreshSource, confirmTarget, previewDecision, executeApproval, quickCapture, captureCalendar, generateReview,
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
