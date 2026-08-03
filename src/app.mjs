import { createStateStore } from './app/state-store.mjs?v=1.8.0';
import { render as renderDashboard } from './app/views/dashboard-view.mjs';
import { render as renderDecisions } from './app/views/decision-view.mjs';
import { render as renderTargets } from './app/views/targets-view.mjs';
import { render as renderHealth } from './app/views/health-view.mjs';
import { render as renderMobile } from './app/views/mobile-view.mjs';
import { createBrowserOperatingRuntime } from './app/browser-runtime.mjs';
import { buildCalendar, calendarLayout, detectCalendarConflicts, redactLifeEventForWork } from './app/calendar-center.mjs';
import { calendarEventCapabilities, normalizeCalendarDraft } from './app/calendar-event.mjs';
import { calendarRangeKey, calendarVisibleRange, moveCalendarAnchor } from './app/calendar-range.mjs';
import { seriesMutationRecords } from './app/calendar-recurrence.mjs';
import { normalizeTask, groupAgenda } from './app/task-center.mjs';
import { createFocusSession, transitionFocus, focusSnapshot, applyFocusCompletion, summarizeFocus } from './app/focus-center.mjs';
import { normalizeCountdown, countdownDistance } from './app/countdown-center.mjs';
import { queryAvailability } from './app/availability-center.mjs';
import { searchMerchants, buildMerchantProfile } from './app/merchant-center.mjs';
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
import { render as renderTodayExecution } from './app/views/today-execution-view.mjs';
import { render as renderTaskCenter } from './app/views/task-view.mjs';
import { render as renderFocus } from './app/views/focus-view.mjs';
import { render as renderAvailability } from './app/views/availability-view.mjs';
import { render as renderMerchant } from './app/views/merchant-view.mjs';
import { createAutoRefreshController } from './app/auto-refresh-controller.mjs';
import { buildCompanyOperatingContract } from './app/company-operating-contract.mjs';
import { buildTodayTop3 } from './app/priority-engine.mjs';
import { buildReminderQueue, notifyGrantedReminders } from './app/reminder-center.mjs';
import { runCompanyAgent } from './app/company-agent-hub.mjs';

export const APP_VERSION = '1.8.0';

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
    intelligenceSources: {}, intelligenceFetchedAt: null,
    calendarView: 'week', calendarAnchor: now().slice(0, 10), calendarPanel: null,
    selectedCalendarId: null, calendarDraft: null, calendarMutationScope: 'single',
    calendarPendingMutation: null, calendarFormError: null, calendarSyncState: 'idle',
    externalCalendar: [], externalCalendarState: 'pending_configuration', externalCalendarRange: null,
    showCountdowns: true, showFocus: false, searchQuery: '', searchResults: [],
    taskDrawerOpen: false, taskDraft: null, focusDuration: 25, focusTaskId: null,
    availabilityDate: now().slice(0, 10), merchantQuery: '', selectedMerchantId: null,
    syncStatus: '等待首次同步', loopConnected: false,
    autoRefresh: {
      phase: 'idle', reason: null, lastAttemptAt: null, lastSuccessAt: null,
      succeeded: [], failed: [],
    },
  };
  let operatingRuntime = config.operatingRuntime || null;
  let autoRefreshController = null;
  let focusTicker = null;
  let unsubscribeStore = null;
  let actionsBound = false;
  let started = false;
  let startupWork = Promise.resolve();
  const notifiedReminderIds = new Set();

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
    const tasks = state.collections.tasks || [];
    const focusSessions = state.collections.focus_sessions || [];
    const countdowns = state.collections.countdowns || [];
    const calendar = buildCalendar({
      calendar: [...(state.collections.calendar || []), ...(runtime.externalCalendar || [])],
      tasks,
      projects: [...projects, ...businessRecords].map((item) => ({ ...item, dueAt: item.dueAt || item.dueDate || item.shootingDate })),
      life,
      intelligence,
      countdowns,
      focusSessions,
    }, { showCountdowns: runtime.showCountdowns, showFocus: runtime.showFocus })
      .map((item) => item.company === 'life' ? redactLifeEventForWork(item) : item);
    const calendarConflicts = detectCalendarConflicts(calendar);
    const todayTop3 = buildTodayTop3({
      tasks,
      decisions,
      risks: runtime.businessExceptions || [],
      calendarConflicts,
      intelligence,
    }, { date: now().slice(0, 10) });
    const companyIntelligence = runtime.intelligenceCompany === 'all'
      ? intelligence
      : intelligence.filter((item) => (item.relevantCompanies || []).includes(runtime.intelligenceCompany));
    const filteredIntelligence = todayMustRead(companyIntelligence, { now: now(), limit: 100 });
    const activeFocus = [...focusSessions].reverse().find((item) => ['planned', 'running', 'paused'].includes(item.state)) || null;
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
      todayTop3,
      reminderQueue: buildReminderQueue(todayTop3, { now: now() }),
      brief,
      sources,
      companyOperating: buildCompanyOperatingContract(sources),
      intelligence: filteredIntelligence,
      intelligenceCompany: runtime.intelligenceCompany,
      mustRead: todayMustRead(intelligence, { now: now() }),
      calendar,
      calendarView: runtime.calendarView,
      calendarAnchor: runtime.calendarAnchor,
      calendarLayout: calendarLayout(calendar, { view: runtime.calendarView, anchor: runtime.calendarAnchor }),
      calendarTrash: state.tombstones || [],
      showCountdowns: runtime.showCountdowns,
      showFocus: runtime.showFocus,
      calendarConflicts,
      relations: buildRelations(businessRecords),
      life,
      lifeSummary: summarizeLife(life),
      searchResults: searchWorkspace(searchIndex, runtime.searchQuery),
      today: now().slice(0, 10),
      agendaDate: now().slice(0, 10),
      agenda: groupAgenda([
        ...tasks,
        ...calendar.filter((item) => item.source !== 'local_task').map((item) => ({ ...item, status: 'todo' })),
      ], { date: now().slice(0, 10) }),
      taskDrawerOpen: runtime.taskDrawerOpen,
      taskDraft: runtime.taskDraft,
      countdowns: countdowns.map((item) => ({ ...item, distance: countdownDistance(item, { now: now() }) })),
      focusSession: activeFocus,
      focusSnapshot: activeFocus ? focusSnapshot(activeFocus, { now: now() }) : { state: 'planned', remainingSeconds: runtime.focusDuration * 60, elapsedSeconds: 0 },
      focusTasks: tasks.filter((item) => !['done', 'completed', 'cancelled'].includes(item.status)),
      focusSummary: summarizeFocus(focusSessions, { now: now() }),
      merchantSearch: runtime.merchantSearch || { state: 'empty_query', matches: [] },
      merchantProfile: runtime.merchantProfile || null,
      availability: runtime.availability || queryHuahuoAvailability({ date: runtime.availabilityDate }, { render: false }),
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
    runtime.health = ['wanjia', 'huahuo', 'lingli', 'projects', 'brain', 'sync', 'feishu_write']
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

  function safeRefreshCode(error) {
    const message = String(error?.message || error || '').toLowerCase();
    if (/authentication|登录|jwt|401/.test(message)) return 'authentication_required';
    if (/permission|权限|403/.test(message)) return 'feishu_permission_denied';
    if (/not found|不存在|404/.test(message)) return 'feishu_resource_not_found';
    if (/field|字段/.test(message)) return 'feishu_field_mismatch';
    if (/timeout|超时/.test(message)) return 'source_timeout';
    return 'source_refresh_failed';
  }

  async function refreshAllSources(reason = 'manual') {
    if (!operatingRuntime) {
      return { succeeded: [], failed: [{ source: 'all', safeCode: 'authentication_required' }] };
    }
    const syncController = operatingRuntime.syncController || config.syncController;
    const jobs = [
      ['sync', () => syncController?.sync ? syncController.sync(reason) : Promise.resolve()],
      ['wanjia', () => operatingRuntime.operatingLoop?.refresh('wanjia')],
      ['huahuo', () => operatingRuntime.operatingLoop?.refresh('huahuo')],
      ['lingli', () => operatingRuntime.operatingLoop?.refresh('lingli')],
      ['projects', () => operatingRuntime.operatingLoop?.refresh('projects')],
      ['intelligence', async () => applyIntelligenceResult(await operatingRuntime.loadIntelligence?.({ refresh: true }))],
      ['calendar', async () => refreshCalendarRange({ force: true, render: false })],
    ];
    const results = await Promise.all(jobs.map(async ([source, run]) => {
      try {
        await run();
        if (['wanjia', 'huahuo', 'lingli', 'projects'].includes(source)) updateFromOperatingLoop();
        renderAll();
        return { source, ok: true };
      } catch (error) {
        return { source, ok: false, safeCode: safeRefreshCode(error) };
      }
    }));
    if (operatingRuntime.operatingLoop) {
      const targets = store.load().collections.targets || [];
      if (targets.length) operatingRuntime.operatingLoop.confirmTargets(targets);
      const brief = operatingRuntime.operatingLoop.ensureDailyBrief();
      updateFromOperatingLoop(brief);
      if (brief && !(store.load().collections.inbox || []).some((item) => item.id === brief.id)) {
        store.saveEntity('inbox', { ...brief, title: `CEO 每日简报｜${brief.date}`, status: 'pending_review' });
      }
    }
    renderAll();
    notifyCurrentReminders();
    return {
      succeeded: results.filter((item) => item.ok).map((item) => item.source),
      failed: results.filter((item) => !item.ok).map(({ source, safeCode }) => ({ source, safeCode })),
    };
  }

  function notifyCurrentReminders() {
    const pending = viewModel().reminderQueue.filter((item) => !notifiedReminderIds.has(item.id));
    const result = notifyGrantedReminders(pending, config.notificationEnvironment || globalThis);
    if (result.state === 'sent') pending.forEach((item) => notifiedReminderIds.add(item.id));
    runtime.notificationState = result.state;
    return result;
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

  function sourceRows(source) {
    const payload = runtime.sources?.[source]?.records;
    return Array.isArray(payload) ? payload : (payload?.records || []);
  }

  function saveTask(input = {}) {
    const item = store.saveEntity('tasks', normalizeTask(input));
    runtime.taskDrawerOpen = false;
    runtime.taskDraft = null;
    signalLocalChange();
    renderAll();
    return item;
  }

  function convertIntelligenceToTask(item = {}) {
    const externalId = item.externalId || item.id;
    return saveTask({
      title: `跟进情报：${String(item.title || '').trim()}`,
      description: item.impact || item.summary || '',
      startAt: item.followUpAt || null,
      company: item.relevantCompanies?.[0] || 'ceo',
      businessEntityType: 'intelligence', businessEntityId: externalId || null,
      sourceUrl: item.sourceUrl || '', sourceName: item.sourceName || '', priority: item.priority === 'high' ? 3 : 1,
      tags: ['情报跟进', ...(item.tags || [])], status: 'todo',
    });
  }

  function saveCountdown(input = {}) {
    const item = store.saveEntity('countdowns', normalizeCountdown(input));
    signalLocalChange(); renderAll();
    return item;
  }

  function createFocus(input = {}, options = {}) {
    const item = createFocusSession({
      durationMinutes: input.durationMinutes || runtime.focusDuration,
      taskId: input.taskId || runtime.focusTaskId || null,
      title: input.title || '', mode: input.mode,
    }, options);
    runtime.focusDuration = item.durationMinutes;
    runtime.focusTaskId = item.taskId;
    const saved = store.saveEntity('focus_sessions', item);
    signalLocalChange(); renderAll();
    return saved;
  }

  function transitionCurrentFocus(action, options = {}) {
    const sessions = store.load().collections.focus_sessions || [];
    let current = [...sessions].reverse().find((item) => ['planned', 'running', 'paused'].includes(item.state));
    if (!current && action === 'start') current = createFocusSession({ durationMinutes: runtime.focusDuration, taskId: runtime.focusTaskId }, options);
    if (!current) throw new Error('no active focus session');
    const next = transitionFocus(current, action, options);
    const saved = store.saveEntity('focus_sessions', next);
    if (saved.state === 'completed' && saved.taskId) {
      const before = store.load().collections.tasks || [];
      const after = applyFocusCompletion(before, saved);
      const changed = after.find((task, index) => JSON.stringify(task) !== JSON.stringify(before[index]));
      if (changed) store.saveEntity('tasks', changed);
    }
    signalLocalChange(); renderAll();
    return saved;
  }

  function queryMerchant(query, options = {}) {
    runtime.merchantQuery = String(query || '').trim();
    const result = searchMerchants(sourceRows('wanjia'), runtime.merchantQuery);
    runtime.merchantSearch = result;
    const selected = options.id
      ? sourceRows('wanjia').find((item) => item.id === options.id)
      : result.merchant;
    runtime.selectedMerchantId = selected?.id || null;
    runtime.merchantProfile = selected ? buildMerchantProfile(selected, {
      tasks: store.load().collections.tasks || [], now: now(),
    }) : null;
    if (options.render !== false) renderAll();
    return result;
  }

  function queryHuahuoAvailability(input = {}, options = {}) {
    const date = String(input.date || runtime.availabilityDate || now().slice(0, 10)).slice(0, 10);
    runtime.availabilityDate = date;
    runtime.availability = queryAvailability(sourceRows('huahuo'), {
      date, startDate: input.startDate, endDate: input.endDate,
      busyBlocks: store.load().collections.life || [],
    });
    if (options.render !== false) renderAll();
    return runtime.availability;
  }

  function showTaskCenter() {
    const navigate = config.navigateTo || globalThis.navigateTo;
    if (typeof navigate === 'function') navigate('tasks');
  }

  function openTaskEditor(task = null) {
    runtime.taskDraft = task ? normalizeTask(task) : null;
    runtime.taskDrawerOpen = true;
    renderAll();
  }

  function closeTaskEditor() {
    runtime.taskDrawerOpen = false;
    runtime.taskDraft = null;
    renderAll();
  }

  function saveCalendar(input = {}) {
    const state = store.load();
    const existing = input.id
      ? state.collections.calendar.find((record) => record.id === input.id)
      : null;
    if (input.id && (!existing || !calendarEventCapabilities(existing).edit)) {
      throw new Error('calendar_local_event_required');
    }
    const item = store.saveEntity('calendar', normalizeCalendarDraft(input, existing || {}));
    signalLocalChange();
    renderAll();
    return item;
  }

  function captureCalendar(input = {}) {
    return saveCalendar(input);
  }

  function deleteCalendar(id) {
    const existing = store.load().collections.calendar.find((record) => record.id === id);
    if (!existing || !calendarEventCapabilities(existing).remove) throw new Error('calendar_local_event_required');
    const result = store.deleteEntity('calendar', id);
    signalLocalChange();
    renderAll();
    return result;
  }

  function restoreCalendar(id) {
    const tombstone = store.load().tombstones.find((record) => record.entity === 'calendar' && record.id === id);
    if (!tombstone || !calendarEventCapabilities(tombstone).edit) throw new Error('calendar_local_event_required');
    const result = store.restoreEntity('calendar', id);
    signalLocalChange();
    renderAll();
    return result;
  }

  function copyCalendar(id) {
    const existing = viewModel().calendar.find((record) => record.id === id);
    if (!existing || !calendarEventCapabilities(existing).copy) throw new Error('calendar_event_required');
    const {
      id: _id, revision: _revision, createdAt: _createdAt, updatedAt: _updatedAt,
      deletedAt: _deletedAt, deviceId: _deviceId, seriesId: _seriesId,
      originalStartAt: _originalStartAt, exceptionType: _exceptionType,
      recurrenceRule: _recurrenceRule, source: _source, sourceUrl: _sourceUrl, ...copy
    } = existing;
    return saveCalendar({ ...copy, title: `${existing.title}（副本）` });
  }

  function moveCalendar(id, patch = {}) {
    const existing = store.load().collections.calendar.find((record) => record.id === id);
    if (!existing || !calendarEventCapabilities(existing).drag) throw new Error('calendar_local_event_required');
    const duration = Math.max(0, new Date(existing.endAt) - new Date(existing.startAt));
    const endAt = patch.endAt || (patch.startAt
      ? new Date(new Date(patch.startAt).getTime() + duration).toISOString()
      : existing.endAt);
    return saveCalendar({ id, ...patch, endAt });
  }

  function selectedCalendarEvent(id = runtime.selectedCalendarId) {
    return viewModel().calendar.find((record) => record.id === id) || null;
  }

  function selectCalendar(id) {
    if (!selectedCalendarEvent(id)) throw new Error('calendar_event_required');
    runtime.selectedCalendarId = id;
    runtime.calendarPanel = 'detail';
    renderAll();
  }

  function openCalendarEditor(id = null) {
    const event = id ? selectedCalendarEvent(id) : null;
    if (event && !calendarEventCapabilities(event).edit) throw new Error('calendar_local_event_required');
    runtime.selectedCalendarId = id;
    runtime.calendarDraft = event ? { ...event } : {
      startAt: `${runtime.calendarAnchor}T09:00:00+08:00`,
      endAt: `${runtime.calendarAnchor}T10:00:00+08:00`,
      company: 'ceo', privacy: 'work', reminders: [],
    };
    runtime.calendarFormError = null;
    runtime.calendarPanel = 'editor';
    renderAll();
  }

  function closeCalendarPanel() {
    runtime.calendarPanel = null;
    runtime.calendarDraft = null;
    runtime.selectedCalendarId = null;
    runtime.calendarPendingMutation = null;
    runtime.calendarFormError = null;
    renderAll();
  }

  function requestCalendarMutation(id, action) {
    const event = selectedCalendarEvent(id);
    if (!event || !calendarEventCapabilities(event)[action === 'delete' ? 'remove' : 'edit']) {
      throw new Error('calendar_local_event_required');
    }
    const recurring = Boolean(event.recurrenceRule || event.originalStartAt || event.seriesId);
    if (!recurring) {
      if (action === 'delete') return deleteCalendar(id);
      openCalendarEditor(id);
      return event;
    }
    runtime.calendarPendingMutation = { id, action };
    runtime.calendarPanel = 'series';
    renderAll();
    return event;
  }

  function seriesContext(id) {
    const occurrence = selectedCalendarEvent(id);
    const baseId = occurrence?.seriesId || occurrence?.id;
    const base = store.load().collections.calendar.find((record) => record.id === baseId);
    if (!occurrence || !base) throw new Error('calendar_series_required');
    return { occurrence, base };
  }

  function deleteRecurringCalendar(id, scope) {
    const { occurrence, base } = seriesContext(id);
    if (scope === 'series') return deleteCalendar(base.id);
    const records = seriesMutationRecords(base, occurrence, 'future', {});
    if (scope === 'future') return saveCalendar(records[0]);
    if (scope !== 'single') throw new Error('calendar_series_scope_invalid');
    return saveCalendar(seriesMutationRecords(base, occurrence, 'single', { deleted: true })[0]);
  }

  function applyCalendarSeriesScope(scope) {
    const pending = runtime.calendarPendingMutation;
    if (!pending) throw new Error('calendar_series_action_required');
    if (!['single', 'future', 'series'].includes(scope)) throw new Error('calendar_series_scope_invalid');
    if (pending.action === 'delete') {
      const result = deleteRecurringCalendar(pending.id, scope);
      closeCalendarPanel();
      return result;
    }
    const { occurrence, base } = seriesContext(pending.id);
    runtime.calendarMutationScope = scope;
    runtime.calendarDraft = scope === 'series' ? { ...base } : { ...occurrence };
    runtime.calendarPanel = 'editor';
    renderAll();
    return runtime.calendarDraft;
  }

  function saveCalendarFromPanel(input = {}) {
    const pending = runtime.calendarPendingMutation;
    let saved;
    if (pending && runtime.calendarMutationScope !== 'series') {
      const { occurrence, base } = seriesContext(pending.id);
      const { id: _id, ...patch } = input;
      const records = seriesMutationRecords(base, occurrence, runtime.calendarMutationScope, patch);
      saved = records.map((record) => saveCalendar(record)).at(-1);
    } else if (pending && runtime.calendarMutationScope === 'series') {
      const { base } = seriesContext(pending.id);
      saved = saveCalendar({ ...input, id: base.id });
    } else {
      saved = saveCalendar(input);
    }
    closeCalendarPanel();
    return saved;
  }

  function generateReview(type) {
    const draft = createReviewDraft(type, { ...viewModel(), date: now().slice(0, 10), generatedAt: now() });
    const item = store.saveEntity('inbox', draft);
    signalLocalChange();
    renderAll();
    return item;
  }

  async function generateAgentDraft(agent) {
    const model = viewModel();
    const draft = await runCompanyAgent(agent, {
      companies: model.companyOperating,
      todayTop3: model.todayTop3,
      intelligence: model.mustRead,
      calendarConflicts: model.calendarConflicts,
    }, { now: now(), model: config.agentModel });
    store.saveEntity('inbox', { ...draft, title: `${agent === 'ceo' ? 'CEO' : agent} 助理建议｜${now().slice(0, 10)}` });
    signalLocalChange();
    renderAll();
    return draft;
  }

  function bindActions() {
    if (actionsBound || !document?.addEventListener) return;
    actionsBound = true;
    document.addEventListener('click', async (event) => {
      const previewButton = event.target?.closest?.('[data-preview-decision]');
      const executeButton = event.target?.closest?.('[data-execute-approval]');
      const refreshButton = event.target?.closest?.('[data-refresh-source]');
      const refreshAllButton = event.target?.closest?.('[data-refresh-all]');
      const captureButton = event.target?.closest?.('[data-quick-capture]');
      const pageButton = event.target?.closest?.('[data-page]');
      const intelligenceButton = event.target?.closest?.('[data-intelligence-status]');
      const intelligenceRefresh = event.target?.closest?.('[data-refresh-intelligence]');
      const lifeCapture = event.target?.closest?.('[data-life-capture]');
      const calendarCapture = event.target?.closest?.('[data-calendar-capture]');
      const calendarView = event.target?.closest?.('[data-calendar-view]');
      const intelligenceCompany = event.target?.closest?.('[data-intelligence-company]');
      const reviewDraft = event.target?.closest?.('[data-review-draft]');
      const agentDraft = event.target?.closest?.('[data-agent-draft]');
      const taskCapture = event.target?.closest?.('[data-task-capture], [data-mobile-add]');
      const taskEdit = event.target?.closest?.('[data-task-edit]');
      const taskClose = event.target?.closest?.('[data-task-close]');
      const taskToggle = event.target?.closest?.('[data-task-toggle]');
      const focusAction = event.target?.closest?.('[data-focus-action]');
      const focusDuration = event.target?.closest?.('[data-focus-duration]');
      const countdownCapture = event.target?.closest?.('[data-countdown-capture]');
      const calendarLayer = event.target?.closest?.('[data-calendar-layer]');
      const calendarNav = event.target?.closest?.('[data-calendar-nav]');
      const calendarToday = event.target?.closest?.('[data-calendar-today]');
      const calendarSync = event.target?.closest?.('[data-calendar-sync]');
      const calendarTrash = event.target?.closest?.('[data-calendar-trash]');
      const calendarSelect = event.target?.closest?.('[data-calendar-select]');
      const calendarEdit = event.target?.closest?.('[data-calendar-edit]');
      const calendarDelete = event.target?.closest?.('[data-calendar-delete]');
      const calendarCopy = event.target?.closest?.('[data-calendar-copy]');
      const calendarRestore = event.target?.closest?.('[data-calendar-restore]');
      const calendarClose = event.target?.closest?.('[data-calendar-close]');
      const calendarReschedule = event.target?.closest?.('[data-calendar-reschedule]');
      const calendarSeriesScope = event.target?.closest?.('[data-calendar-series-scope]');
      const merchantSelect = event.target?.closest?.('[data-merchant-select]');
      try {
        if (previewButton) await previewDecision(previewButton.dataset.previewDecision);
        else if (executeButton) await executeApproval(executeButton.dataset.executeApproval);
        else if (refreshAllButton) await autoRefreshController?.refresh('manual');
        else if (refreshButton) await refreshSource(refreshButton.dataset.refreshSource);
        else if (captureButton) quickCapture((config.prompt || globalThis.prompt)?.('记录一条想法或任务'));
        else if (intelligenceButton) {
          const current = viewModel().intelligence.find((item) => item.externalId === intelligenceButton.dataset.intelligenceId);
          const next = transitionIntelligence(current, intelligenceButton.dataset.intelligenceStatus);
          store.saveEntity('intelligence', { ...next, id: `intelligence:${next.externalId}` });
          if (next.status === 'actioned') convertIntelligenceToTask(next);
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
          setCalendarView(calendarView.dataset.calendarView);
          await refreshCalendarRange();
        } else if (calendarNav) {
          await navigateCalendar(calendarNav.dataset.calendarNav === 'prev' ? -1 : 1);
        } else if (calendarToday) {
          await goToCalendarToday();
        } else if (calendarSync) {
          await refreshCalendarRange({ force: true });
        } else if (calendarTrash) {
          runtime.calendarPanel = 'trash'; renderAll();
        } else if (calendarSelect) {
          selectCalendar(calendarSelect.dataset.calendarSelect);
        } else if (calendarEdit) {
          requestCalendarMutation(calendarEdit.dataset.calendarEdit, 'edit');
        } else if (calendarDelete) {
          requestCalendarMutation(calendarDelete.dataset.calendarDelete, 'delete');
        } else if (calendarCopy) {
          copyCalendar(calendarCopy.dataset.calendarCopy);
          closeCalendarPanel();
        } else if (calendarRestore) {
          restoreCalendar(calendarRestore.dataset.calendarRestore);
        } else if (calendarClose) {
          closeCalendarPanel();
        } else if (calendarReschedule) {
          requestCalendarMutation(calendarReschedule.dataset.calendarReschedule, 'edit');
        } else if (calendarSeriesScope) {
          applyCalendarSeriesScope(calendarSeriesScope.dataset.calendarSeriesScope);
        } else if (calendarLayer) {
          if (calendarLayer.dataset.calendarLayer === 'countdown') runtime.showCountdowns = !runtime.showCountdowns;
          if (calendarLayer.dataset.calendarLayer === 'focus') runtime.showFocus = !runtime.showFocus;
          renderAll();
        } else if (countdownCapture) {
          const ask = config.prompt || globalThis.prompt;
          const title = ask?.('倒数日名称');
          const date = title && ask?.('日期（YYYY-MM-DD）', now().slice(0, 10));
          if (title && date) saveCountdown({ title, date });
        } else if (calendarCapture) {
          openCalendarEditor();
        } else if (lifeCapture) {
          const title = (config.prompt || globalThis.prompt)?.('记录一条生活事项');
          if (String(title || '').trim()) store.saveEntity('life', { title: String(title).trim(), area: 'review', status: 'open', privacy: 'private' });
        } else if (taskCapture) {
          showTaskCenter();
          openTaskEditor();
        }
        else if (taskEdit) openTaskEditor(viewModel().tasks.find((item) => item.id === taskEdit.dataset.taskEdit));
        else if (taskClose) closeTaskEditor();
        else if (taskToggle) {
          const task = viewModel().tasks.find((item) => item.id === taskToggle.dataset.taskToggle);
          if (task) saveTask({ ...task, status: ['done', 'completed'].includes(task.status) ? 'todo' : 'done' });
        } else if (focusDuration) {
          const value = focusDuration.dataset.focusDuration === 'custom'
            ? Number((config.prompt || globalThis.prompt)?.('专注分钟数', '25'))
            : Number(focusDuration.dataset.focusDuration);
          if (Number.isFinite(value) && value > 0) runtime.focusDuration = value;
          renderAll();
        } else if (focusAction) {
          if (!viewModel().focusSession && focusAction.dataset.focusAction === 'start') {
            createFocus({ durationMinutes: runtime.focusDuration, taskId: runtime.focusTaskId });
          }
          transitionCurrentFocus(focusAction.dataset.focusAction);
        } else if (merchantSelect) queryMerchant(runtime.merchantQuery, { id: merchantSelect.dataset.merchantSelect });
        else if (reviewDraft) generateReview(reviewDraft.dataset.reviewDraft);
        else if (agentDraft) await generateAgentDraft(agentDraft.dataset.agentDraft || 'ceo');
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
      if (event.target?.matches?.('[data-task-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        const subtasks = String(data.get('subtasks') || '').split(/\r?\n/).map((title) => title.trim()).filter(Boolean).map((title, index) => ({ id: `subtask-${index + 1}`, title, completed: false }));
        saveTask({
          id: data.get('id') || undefined, title: data.get('title'), description: data.get('description'),
          startAt: data.get('startAt') || null, dueAt: data.get('dueAt') || null,
          priority: Number(data.get('priority')), tags: String(data.get('tags') || '').split(/[、,，]/),
          allDay: data.get('allDay') === 'on', company: data.get('company'), projectId: data.get('projectId') || null,
          businessEntityType: data.get('businessEntityType') || null, businessEntityId: data.get('businessEntityId') || null,
          assigneeIds: String(data.get('assigneeIds') || '').split(/[、,，]/), listId: data.get('listId') || null,
          estimateMinutes: data.get('estimateMinutes'),
          reminderAt: data.get('reminderAt') || null, recurrence: data.get('recurrence') || null, subtasks,
        });
        return;
      }
      if (event.target?.matches?.('[data-calendar-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        const startAt = data.get('startAt');
        const frequency = data.get('recurrenceFrequency');
        const startDate = new Date(startAt);
        const recurrenceRule = frequency && frequency !== 'none' ? {
          frequency,
          interval: Math.max(1, Number(data.get('recurrenceInterval')) || 1),
          ...(frequency === 'weekly' ? { byWeekdays: [startDate.getDay() || 7] } : {}),
        } : null;
        try {
          saveCalendarFromPanel({
            id: data.get('id') || undefined,
            title: data.get('title'), startAt, endAt: data.get('endAt'),
            allDay: data.get('allDay') === 'on', company: data.get('company'),
            privacy: data.get('privacy'), notes: data.get('notes'), recurrenceRule,
            reminders: String(data.get('reminders') || '').split(/[、,，]/).map((value) => Number(value.trim())).filter(Number.isFinite),
          });
        } catch (error) {
          runtime.calendarFormError = {
            calendar_title_required: '请填写日程标题', calendar_time_invalid: '请填写有效时间',
            calendar_end_before_start: '结束时间不能早于开始时间',
          }[error?.message] || '日程未保存，请检查填写内容';
          renderAll();
        }
        return;
      }
      if (event.target?.matches?.('[data-availability-form]')) {
        event.preventDefault();
        queryHuahuoAvailability({ date: new FormData(event.target).get('date') });
        return;
      }
      if (event.target?.matches?.('[data-merchant-search]')) {
        event.preventDefault();
        queryMerchant(new FormData(event.target).get('query'));
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
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.('[data-calendar-anchor]')) {
        runtime.calendarAnchor = event.target.value || now().slice(0, 10);
        runtime.calendarPanel = null;
        renderAll();
        refreshCalendarRange().catch(() => {});
        return;
      }
      if (event.target?.matches?.('[data-focus-task]')) {
        runtime.focusTaskId = event.target.value || null;
        const active = viewModel().focusSession;
        if (active?.state === 'planned') store.saveEntity('focus_sessions', { ...active, taskId: runtime.focusTaskId });
        renderAll();
      }
    });
    document.addEventListener('dragstart', (event) => {
      const card = event.target?.closest?.('[data-calendar-event][draggable="true"]');
      if (card && event.dataTransfer) event.dataTransfer.setData('text/calendar-id', card.dataset.calendarEvent);
    });
    document.addEventListener('dragover', (event) => {
      const target = event.target?.closest?.('[data-calendar-drop-date]');
      if (!target) return;
      event.preventDefault();
      document.querySelectorAll?.('.calendar-drop-target')?.forEach?.((node) => {
        if (node !== target) node.classList?.remove?.('calendar-drop-target');
      });
      target.classList?.add?.('calendar-drop-target');
    });
    document.addEventListener('dragleave', (event) => {
      const target = event.target?.closest?.('[data-calendar-drop-date]');
      if (target && !target.contains?.(event.relatedTarget)) target.classList?.remove?.('calendar-drop-target');
    });
    document.addEventListener('drop', (event) => {
      const target = event.target?.closest?.('[data-calendar-drop-date]');
      const id = event.dataTransfer?.getData?.('text/calendar-id');
      if (!target || !id) return;
      event.preventDefault();
      target.classList?.remove?.('calendar-drop-target');
      const existing = store.load().collections.calendar.find((record) => record.id === id);
      if (!existing) return;
      const start = new Date(existing.startAt);
      const [year, month, day] = target.dataset.calendarDropDate.split('-').map(Number);
      start.setFullYear(year, month - 1, day);
      try { moveCalendar(id, { startAt: start.toISOString() }); } catch { /* External and recurring rows are not draggable. */ }
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
    renderTodayExecution(document?.getElementById('todayExecutionRoot'), model);
    renderTaskCenter(document?.getElementById('taskCenterRoot'), model);
    renderFocus(document?.getElementById('focusCenterRoot'), model);
    renderAvailability(document?.getElementById('availabilityCenterRoot'), model);
    renderMerchant(document?.getElementById('merchantCenterRoot'), model);
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
    if (!Array.isArray(result)) {
      runtime.intelligenceSources = result?.sources || {};
      runtime.intelligenceFetchedAt = result?.fetchedAt || runtime.intelligenceFetchedAt;
    }
  }

  function applyExternalCalendarResult(result) {
    runtime.externalCalendar = Array.isArray(result) ? result : (result?.items || []);
    runtime.externalCalendarState = Array.isArray(result) ? 'synced' : (result?.state || 'pending_configuration');
  }

  async function refreshCalendarRange({ force = false, render = true } = {}) {
    const range = calendarVisibleRange({ view: runtime.calendarView, anchor: runtime.calendarAnchor });
    const key = calendarRangeKey(range);
    if (!force && runtime.externalCalendarRange === key) return runtime.externalCalendar;
    if (!operatingRuntime?.loadExternalCalendar) {
      runtime.calendarSyncState = 'authentication_required';
      if (render) renderAll();
      return runtime.externalCalendar;
    }
    runtime.calendarSyncState = 'loading';
    if (render) renderAll();
    try {
      const result = await operatingRuntime.loadExternalCalendar({ start: range.queryStart, end: range.queryEnd });
      applyExternalCalendarResult(result || { items: [], state: 'pending_configuration' });
      runtime.externalCalendarRange = key;
      runtime.calendarSyncState = 'synced';
      return runtime.externalCalendar;
    } catch (error) {
      runtime.calendarSyncState = safeRefreshCode(error);
      throw error;
    } finally {
      if (render) renderAll();
    }
  }

  function setCalendarView(view) {
    runtime.calendarView = ['day', 'week', 'month', 'list'].includes(view) ? view : 'week';
    runtime.calendarPanel = null;
    renderAll();
    return runtime.calendarView;
  }

  async function navigateCalendar(direction) {
    runtime.calendarAnchor = moveCalendarAnchor(runtime.calendarAnchor, runtime.calendarView, Number(direction));
    runtime.calendarPanel = null;
    renderAll();
    await refreshCalendarRange();
    return runtime.calendarAnchor;
  }

  async function goToCalendarToday() {
    runtime.calendarAnchor = now().slice(0, 10);
    runtime.calendarPanel = null;
    renderAll();
    await refreshCalendarRange();
    return runtime.calendarAnchor;
  }

  async function initializeRemote() {
    if (config.hydrateHealth) {
      try { Object.assign(runtime, { health: await config.hydrateHealth() }); }
      catch { runtime.health = []; }
      renderAll();
    }
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
    if (!operatingRuntime) {
      runtime.intelligenceState = 'authentication_required';
      runtime.autoRefresh = { ...runtime.autoRefresh, phase: 'authentication_required' };
      renderAll();
      return viewModel();
    }
    const syncController = operatingRuntime?.syncController || config.syncController;
    syncController?.start?.();
    const factory = config.autoRefreshFactory || createAutoRefreshController;
    autoRefreshController = factory({
      refreshAll: refreshAllSources,
      eventTarget: config.eventTarget || globalThis,
      visibility: document,
      ...config.autoRefreshOptions,
      onStatus: (status) => {
        runtime.autoRefresh = status;
        runtime.syncStatus = status.phase === 'refreshing'
          ? '后台自动更新中，当前数据可继续使用'
          : status.phase === 'partial'
            ? '部分来源未更新，已保留上次成功数据'
            : status.phase === 'offline'
              ? '当前离线，显示上次缓存数据'
              : '自动更新已开启';
        renderAll();
      },
    });
    if (config.autoRefreshFactory || document?.visibilityState != null) autoRefreshController.start();
    await autoRefreshController.refresh('startup');
    config.ensureDailyBrief && Object.assign(runtime, { briefs: await config.ensureDailyBrief(viewModel()) });
    renderAll();
    return viewModel();
  }

  async function start() {
    if (started) return viewModel();
    started = true;
    unsubscribeStore = store.subscribe(renderAll);
    bindActions();
    renderAll();
    const browserWindow = document?.defaultView;
    if (browserWindow?.setInterval && !focusTicker) {
      focusTicker = browserWindow.setInterval(() => {
        const model = viewModel();
        if (model.focusSession?.state === 'running') {
          renderFocus(document?.getElementById('focusCenterRoot'), model);
        }
      }, 1000);
    }
    startupWork = initializeRemote().catch(() => {
      runtime.syncStatus = '初始化失败，请稍后重试';
      renderAll();
      return viewModel();
    });
    return viewModel();
  }

  function stop() {
    const browserWindow = document?.defaultView;
    if (focusTicker && browserWindow?.clearInterval) browserWindow.clearInterval(focusTicker);
    focusTicker = null;
    unsubscribeStore?.();
    unsubscribeStore = null;
    autoRefreshController?.stop?.();
    operatingRuntime?.syncController?.stop?.();
    started = false;
  }

  return {
    start, stop, whenIdle: () => startupWork, render: renderAll, store, runtime, viewModel,
    refreshSource, refreshAllSources, notifyCurrentReminders, confirmTarget, previewDecision, executeApproval,
    quickCapture, captureCalendar, saveCalendar, deleteCalendar, restoreCalendar, copyCalendar, moveCalendar,
    setCalendarView, navigateCalendar, goToCalendarToday, refreshCalendarRange,
    selectCalendar, openCalendarEditor, closeCalendarPanel, requestCalendarMutation, applyCalendarSeriesScope,
    saveTask, convertIntelligenceToTask, saveCountdown,
    createFocus, transitionCurrentFocus, queryMerchant, queryHuahuoAvailability,
    openTaskEditor, closeTaskEditor, generateReview, generateAgentDraft,
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
