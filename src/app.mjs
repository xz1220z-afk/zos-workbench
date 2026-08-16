import { createStateStore, readPersistedStateForBackup } from './app/state-store.mjs?v=2.11.0';
import { installSettingsSyncBridge } from './app/settings-sync-bridge.mjs?v=2.11.0';
import { render as renderDashboard } from './app/views/dashboard-view.mjs?v=2.11.0';
import { render as renderDecisions } from './app/views/decision-view.mjs?v=2.11.0';
import { render as renderTargets } from './app/views/targets-view.mjs?v=2.11.0';
import { render as renderHealth } from './app/views/health-view.mjs?v=2.11.0';
import { render as renderMobile } from './app/views/mobile-view.mjs?v=2.11.0';
import { BROWSER_SUPABASE_CONFIG, createBrowserOperatingRuntime } from './app/browser-runtime.mjs?v=2.11.0';
import { createSupabaseAuth } from './supabase-auth.mjs?v=2.11.0';
import { createAuthGate } from './app/auth-gate.mjs?v=2.11.0';
import { createOwnerSessionClient } from './app/owner-session-client.mjs?v=2.11.0';
import { createAuthenticatedBootstrap } from './app/authenticated-bootstrap.mjs?v=2.11.0';
import { renderLogin } from './app/views/login-view.mjs?v=2.11.0';
import { buildCalendar, calendarLayout, detectCalendarConflicts, redactLifeEventForWork } from './app/calendar-center.mjs?v=2.11.0';
import { calendarEventCapabilities, calendarRecordSyncState, normalizeCalendarDraft } from './app/calendar-event.mjs?v=2.11.0';
import { calendarRangeKey, calendarVisibleRange, moveCalendarAnchor } from './app/calendar-range.mjs?v=2.11.0';
import { calendarSelectionDraft, normalizeCalendarSelection, shouldBeginCalendarSelection } from './app/calendar-selection.mjs?v=2.11.0';
import { calendarExceptionId, seriesMutationRecords } from './app/calendar-recurrence.mjs?v=2.11.0';
import { normalizeTask, groupAgenda } from './app/task-center.mjs?v=2.11.0';
import { buildMobileMoreGroups } from './app/mobile-navigation.mjs?v=2.11.0';
import { createFocusSession, transitionFocus, focusSnapshot, applyFocusCompletion, summarizeFocus } from './app/focus-center.mjs?v=2.11.0';
import { normalizeCountdown, countdownDistance } from './app/countdown-center.mjs?v=2.11.0';
import { buildImportantDates } from './app/important-dates.mjs?v=2.11.0';
import { queryAvailability } from './app/availability-center.mjs?v=2.11.0';
import { searchMerchants, buildMerchantProfile } from './app/merchant-center.mjs?v=2.11.0';
import { buildMerchantDiagnostic, buildWanjiaOpsModel } from './app/wanjia-ops-center.mjs?v=2.11.0';
import { buildWanjiaOpsNavigation, normalizeWanjiaOpsPane } from './app/wanjia-ops-navigation.mjs?v=2.11.0';
import { filterIntelligence, normalizeIntelligenceItem, sortIntelligence, todayMustRead, transitionIntelligence } from './app/intelligence-center.mjs?v=2.11.0';
import { buildIntelligenceAnswer } from './app/intelligence-explainer.mjs?v=2.11.0';
import { fetchSelectedWeather, requestCurrentWeatherLocation, DEFAULT_WEATHER_LOCATION } from './app/weather-center.mjs?v=2.11.0';
import { normalizeKnowledgeContextIndex } from './knowledge-context-index.mjs?v=2.11.0';
import { buildLifeAgenda, summarizeLife } from './app/life-os.mjs?v=2.11.0';
import { upcomingRituals } from './app/ritual-calendar.mjs?v=2.11.0';
import { parsePrivateDateMetadata } from './app/private-date-import.mjs?v=2.11.0';
import { buildSearchIndex, searchWorkspace } from './app/search-center.mjs?v=2.11.0';
import { render as renderIntelligence } from './app/views/intelligence-view.mjs?v=2.11.0';
import { render as renderCalendar } from './app/views/calendar-view.mjs?v=2.11.0';
import { render as renderLife } from './app/views/life-view.mjs?v=2.11.0';
import { render as renderSearch } from './app/views/search-view.mjs?v=2.11.0';
import { render as renderLingli } from './app/views/lingli-view.mjs?v=2.11.0';
import { buildRelations } from './app/relation-center.mjs?v=2.11.0';
import { createReviewDraft } from './app/review-center.mjs?v=2.11.0';
import { render as renderRelations } from './app/views/relation-view.mjs?v=2.11.0';
import { render as renderReviews } from './app/views/review-view.mjs?v=2.11.0';
import { render as renderTodayExecution } from './app/views/today-execution-view.mjs?v=2.11.0';
import { render as renderTaskCenter } from './app/views/task-view.mjs?v=2.11.0';
import { render as renderFocus } from './app/views/focus-view.mjs?v=2.11.0';
import { render as renderAvailability } from './app/views/availability-view.mjs?v=2.11.0';
import { render as renderMerchant } from './app/views/merchant-view.mjs?v=2.11.0';
import { render as renderWanjiaOps, renderActivePanel as renderWanjiaActivePanel } from './app/views/wanjia-ops-view.mjs?v=2.11.0';
import { createAutoRefreshController } from './app/auto-refresh-controller.mjs?v=2.11.0';
import { buildCompanyOperatingContract } from './app/company-operating-contract.mjs?v=2.11.0';
import { buildCompanyCockpit } from './app/company-cockpit.mjs?v=2.11.0';
import { render as renderCompanyCockpit } from './app/views/company-cockpit-view.mjs?v=2.11.0';
import { buildTodayTop3 } from './app/priority-engine.mjs?v=2.11.0';
import { buildWorkHomepagePresence } from './app/homepage-presence.mjs?v=2.11.0';
import { buildDurableReminderSchedule, buildReminderQueue, notifyGrantedReminders } from './app/reminder-center.mjs?v=2.11.0';
import { buildDailyDigestItems, buildEveningDigest, buildMorningDigest } from './app/daily-digest.mjs?v=2.11.0';
import { enablePushNotifications, pushCapabilityState } from './app/push-notifications.mjs?v=2.11.0';
import { runCompanyAgent } from './app/company-agent-hub.mjs?v=2.11.0';
import { buildReliabilityOverview, buildSafeBackup, listRestorableItems, reminderSnoozeAt } from './app/reliability-center.mjs?v=2.11.0';
import { contentOverview, contentPerformance, evaluateExperiment, normalizeContentItem, transitionContent, buildCompoundCandidate } from './app/content-growth.mjs?v=2.11.0';
import { createBrainstorm, createKnowledgeCard, knowledgeReviewQueue, normalizeReadingItem, selectBrainstormDirection } from './app/knowledge-workspace.mjs?v=2.11.0';
import { normalizeSocialInsight, rankSocialOpportunities } from './app/social-insight-center.mjs?v=2.11.0';
import { createAgentRun, summarizeAgentRuns } from './app/agent-workbench.mjs?v=2.11.0';
import { buildAiOffice } from './app/ai-office.mjs?v=2.11.0';
import { buildExecutionLedger } from './app/execution-ledger.mjs?v=2.11.0';
import { buildContinuityPrompts } from './app/continuity-engine.mjs?v=2.11.0';
import { buildMobileAgentDirectory } from './app/mobile-agent-directory.mjs?v=2.11.0';
import { validateAgentOsIndex } from './app/agent-os-index-contract.mjs?v=2.11.0';
import {
  agentDetails, buildAgentAnalysisRequest, buildAgentInvocationDraft, buildAgentOsOverview, buildRelationReminderDrafts,
  compareAgentOsIndexes, visibleAgents,
} from './app/agent-os-center.mjs?v=2.11.0';
import {
  agentRuntimeAvailability, completeAgentTaskArchive, confirmContextCandidate,
  confirmedContextForAgent, createAgentTaskArchive, createContextCandidate, rejectContextCandidate,
} from './app/agent-task-context.mjs?v=2.11.0';
import { render as renderContentGrowth } from './app/views/content-growth-view.mjs?v=2.11.0';
import { render as renderKnowledgeWorkspace } from './app/views/knowledge-workspace-view.mjs?v=2.11.0';
import { render as renderSocialInsights } from './app/views/social-insights-view.mjs?v=2.11.0';
import { render as renderAgentWorkbench } from './app/views/agent-workbench-view.mjs?v=2.11.0';
import { buildDurableStateView, parseBackupFile, summarizeBackup } from './app/data-durability.mjs?v=2.11.0';
import { createIndexedDbSnapshotAdapter, createSnapshotRepository } from './app/snapshot-repository.mjs?v=2.11.0';
import { applyDecisionAction, applyDecisionBatch, partitionDecisions } from './app/decision-center.mjs?v=2.11.0';
import { createAiCommand, normalizeAiCommandResult, sanitizeAiActivity, transitionAiCommand } from './app/ai-command-center.mjs?v=2.11.0';
import { routeIntent } from './app/intent-router.mjs?v=2.11.0';
import { executeControlledAction } from './app/controlled-execution.mjs?v=2.11.0';
import { createVoiceInput } from './app/voice-input.mjs?v=2.11.0';
import { createBrowserSpeechOutput, createVoiceTurn } from './app/voice-turn.mjs?v=2.11.0';
import { createRealtimeVoice } from './app/realtime-voice.mjs?v=2.11.0';
import { renderMobileCommandSheet } from './app/views/mobile-command-sheet.mjs?v=2.11.0';

export const APP_VERSION = '2.11.0';
const LAST_PROTECTED_VERSION_KEY = 'zos_last_protected_app_version';
const SYNC_META_KEY = 'zos_sync_meta_v2';
const LEGACY_COLLECTION_KEYS = Object.freeze({
  tasks: 'zos_tasks', inbox: 'zos_inbox', projects: 'zos_projects', commands: 'zos_commands',
});
const LEGACY_TOMBSTONES_KEY = 'zos_tombstones';

function browserId() {
  return globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}`;
}

export function persistSyncMeta(storage, status = {}) {
  if (!status.lastSuccessAt) return null;
  const meta = { lastSuccessAt: status.lastSuccessAt };
  try {
    storage?.setItem?.(SYNC_META_KEY, JSON.stringify(meta));
    return meta;
  } catch {
    return null;
  }
}

export function createCeoOsApplication(config = {}) {
  const document = config.document || globalThis.document;
  const storage = config.storage || globalThis.localStorage;
  const now = config.now || (() => new Date().toISOString());
  const SpeechRecognition = Object.hasOwn(config, 'SpeechRecognition')
    ? config.SpeechRecognition
    : document?.defaultView?.SpeechRecognition || document?.defaultView?.webkitSpeechRecognition
      || globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const speechSynthesis = Object.hasOwn(config, 'speechSynthesis')
    ? config.speechSynthesis
    : document?.defaultView?.speechSynthesis || globalThis.speechSynthesis;
  const SpeechSynthesisUtterance = Object.hasOwn(config, 'SpeechSynthesisUtterance')
    ? config.SpeechSynthesisUtterance
    : document?.defaultView?.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  const RTCPeerConnection = Object.hasOwn(config, 'RTCPeerConnection')
    ? config.RTCPeerConnection
    : document?.defaultView?.RTCPeerConnection || globalThis.RTCPeerConnection;
  const mediaDevices = Object.hasOwn(config, 'mediaDevices')
    ? config.mediaDevices
    : document?.defaultView?.navigator?.mediaDevices || globalThis.navigator?.mediaDevices;
  const deviceId = storage?.getItem?.('zos_device_id') || browserId();
  const preUpgradeState = config.preUpgradeState || null;
  const preUpgradeRaw = config.preUpgradeRaw || globalThis.__ZOS_PRE_UPGRADE_RAW__ || null;
  const store = config.store || createStateStore({ storage, now, deviceId, createId: browserId });
  const snapshotRepository = config.snapshotRepository || createSnapshotRepository({
    adapter: createIndexedDbSnapshotAdapter(document?.defaultView?.indexedDB || globalThis.indexedDB),
    now, createId: browserId,
  });
  let syncMeta = {};
  try { syncMeta = JSON.parse(storage?.getItem?.(SYNC_META_KEY) || '{}') || {}; } catch { syncMeta = {}; }
  const runtime = {
    health: [], gaps: [], briefs: [], conflicts: [], approvals: [], decisions: [], targets: [],
    businessExceptions: [], intelligence: [], intelligenceState: 'loading', intelligenceCompany: 'all',
    intelligenceFilters: { company: 'all', source: 'all', credibility: 'all', status: 'all', age: 'all', search: '', sortBy: 'newest' },
    intelligenceFiltersDisclosureOpen: false,
    intelligenceQuestion: null, intelligenceAnswer: null, knowledgeContext: { state: 'unknown', count: 0, latestAt: null },
    contentCompany: 'all', contentOwner: 'all',
    intelligenceSources: {}, intelligenceFetchedAt: null,
    calendarView: 'month', calendarAnchor: now().slice(0, 10), calendarPanel: null,
    selectedCalendarId: null, calendarDraft: null, calendarDraftKind: 'calendar',
    calendarFilter: 'all', calendarPendingDelete: null, calendarUndoDelete: null,
    calendarSelection: null, calendarSelecting: false, calendarTouchPending: null, calendarMutationScope: 'single',
    calendarSelectedDate: null, calendarDaySheetOpen: false, calendarEventLongPress: null,
    calendarPendingMutation: null, calendarFormError: null, calendarSyncState: 'idle',
    externalCalendar: [], externalCalendarState: 'pending_configuration', externalCalendarRange: null, externalCalendarFetchedAt: null,
    notificationState: 'pending_configuration', notificationPublicKey: null, inAppNotificationState: 'permission_required',
    reminderScheduleState: 'disabled', reminderScheduleCount: 0,
    showFocus: false, importantDatesPanel: null, searchQuery: '', searchResults: [],
    taskDrawerOpen: false, taskDraft: null, taskQuickFilter: 'all', taskOwnerDeviceId: deviceId, focusDuration: 25, focusTaskId: null,
    availabilityDate: now().slice(0, 10), merchantQuery: '', selectedMerchantId: null,
    wanjiaFilters: { query: '', industry: 'all', cooperationType: 'all', owner: 'all', health: 'all', abnormal: 'all', active: 'all', live: 'all', video: 'all', groupbuyGmv: 'all' },
    wanjiaOpsPane: 'overview',
    wanjiaHistoryRange: { preset: 'today', startDate: '', endDate: '' },
    wanjiaHistoryFilters: { merchantId: '', industry: 'all', owner: 'all', cooperationType: 'all', abnormal: 'all' },
    wanjiaHistoryFeedback: null,
    syncStatus: '等待首次同步', loopConnected: false, reminderTestState: 'idle',
    snapshotCount: 0, protectionState: '本机数据已保护', lastRestoreAt: null,
    ignoredRitualIds: readJson('zos_ignored_rituals', []),
    privateDateSource: { state: 'idle', count: 0 },
    autoRefresh: {
      phase: 'idle', reason: null, lastAttemptAt: null, lastSuccessAt: null,
      succeeded: [], failed: [],
    },
    decisionUi: {
      action: null, busy: false, error: null, search: '', company: 'all', status: 'all',
      followUpLimit: 6, historyLimit: 6, undo: null,
      selectedIds: [], batchBusy: false, batchError: null,
    },
    agentOsFilter: 'all', agentOsDetailId: null, agentOsPatrol: null,
    mobileAgentDirectoryDisclosure: { organizationId: null, departmentId: null },
    agentOsImportState: 'idle', agentOsImportMessage: null, agentAnalysis: null, agentAnalysisStates: {},
    weather: { state: 'loading', location: DEFAULT_WEATHER_LOCATION },
    localBusy: { ai: false, agentIds: [], agentTaskArchives: [], intelligenceIds: [], refreshSources: [] },
    intelligenceQuestionStates: {},
    mobileAiSheetOpen: false,
    aiCommand: {
      ...createAiCommand('', { id: 'ai-command-home', now: now() }),
      voice: { supported: typeof SpeechRecognition === 'function', state: typeof SpeechRecognition === 'function' ? 'idle' : 'unsupported' },
      realtimeVoice: {
        supported: typeof RTCPeerConnection === 'function' && typeof mediaDevices?.getUserMedia === 'function',
        state: typeof RTCPeerConnection === 'function' && typeof mediaDevices?.getUserMedia === 'function' ? 'idle' : 'unsupported',
        muted: false, captionsEnabled: true, caption: '', reason: null,
      },
      interactionMode: 'text', speechState: 'idle',
      result: null, preview: null, undo: null,
    },
  };
  let operatingRuntime = config.operatingRuntime || null;
  let autoRefreshController = null;
  let focusTicker = null;
  let unsubscribeStore = null;
  let actionsBound = false;
  let started = false;
  let startupWork = Promise.resolve();
  let reminderScheduleWork = Promise.resolve();
  let reminderScheduleFingerprint = '';
  let reminderScheduleRetryTimer = null;
  let reminderScheduleRetryAttempt = 0;
  const reminderScheduleRetryDelays = Array.isArray(config.reminderScheduleRetryDelays)
    ? config.reminderScheduleRetryDelays : [5_000, 30_000, 120_000];
  const reminderClock = config.clock || document?.defaultView || globalThis;
  const notifiedReminderIds = new Set();
  let legacyProjectionRetryTimer = null;
  let legacyProjectionIdleHandle = null;
  let legacyProjectionRetryQueued = false;
  let legacyProjectionRetryAttempt = 0;
  let legacyProjectionGeneration = 0;
  let decisionUndoTimer = null;
  let decisionActionWork = null;
  let decisionReturnFocus = null;
  let wanjiaModelCache = null;
  let aiVoiceInput = null;
  let aiVoiceTurn = null;
  let aiRealtimeVoice = null;
  let aiRealtimeRoute = null;
  let realtimeVisibilityHandler = null;
  let aiVoiceInputGeneration = 0;
  let aiVoiceDraftSession = null;
  let mobileAiReturnFocus = null;
  let aiVoiceHoldTimer = null;
  let aiVoiceHoldActive = false;
  let aiVoiceHoldPointer = null;
  let aiVoiceIgnoreClick = false;
  const aiVoiceCancelDistance = 44;
  let aiCommandWork = null;
  const intelligenceQuestionWork = new Map();
  const agentAnalysisWork = new Map();
  const agentTaskAnalysisWork = new Map();
  let intelligenceRefreshWork = null;
  const refreshSourceWork = new Map();
  const legacyProjectionRetryDelays = Array.isArray(config.legacyProjectionRetryDelays)
    ? config.legacyProjectionRetryDelays : [0, 5_000, 30_000, 120_000];

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(storage?.getItem?.(key) || 'null');
      return value == null ? fallback : value;
    } catch { return fallback; }
  }

  function currentDurableState() {
    const collections = Object.fromEntries(Object.entries(LEGACY_COLLECTION_KEYS)
      .map(([type, key]) => [type, readJson(key, [])]));
    return buildDurableStateView(store.load(), {
      deviceId, collections, tombstones: readJson(LEGACY_TOMBSTONES_KEY, []), auditLog: [],
    }, { deviceId });
  }

  function mirrorLegacyWorkspace(state) {
    try {
      for (const [type, key] of Object.entries(LEGACY_COLLECTION_KEYS)) {
        storage?.setItem?.(key, JSON.stringify(state.collections?.[type] || []));
      }
      const legacyTypes = new Set(Object.keys(LEGACY_COLLECTION_KEYS));
      storage?.setItem?.(LEGACY_TOMBSTONES_KEY, JSON.stringify((state.tombstones || [])
        .filter((record) => legacyTypes.has(record.entity))));
      try {
        const browserWindow = document?.defaultView;
        browserWindow?.dispatchEvent?.(new browserWindow.CustomEvent('zos:durable-state-restored'));
      } catch { /* The persisted projection is authoritative even when no live legacy view exists. */ }
      return true;
    } catch {
      return false;
    }
  }

  function deferSafetyWork(callback) {
    if (typeof config.deferSafetyWork === 'function') return config.deferSafetyWork(callback);
    const browserWindow = document?.defaultView || globalThis;
    if (typeof browserWindow.requestIdleCallback === 'function') return browserWindow.requestIdleCallback(callback, { timeout: 1500 });
    return browserWindow.setTimeout?.(callback, 0);
  }

  function cancelSafetyWork(handle) {
    if (handle == null) return;
    if (typeof config.cancelSafetyWork === 'function') {
      config.cancelSafetyWork(handle);
      return;
    }
    const browserWindow = document?.defaultView || globalThis;
    if (typeof browserWindow.cancelIdleCallback === 'function' && typeof browserWindow.requestIdleCallback === 'function') {
      browserWindow.cancelIdleCallback(handle);
      return;
    }
    browserWindow.clearTimeout?.(handle);
  }

  function queueLegacyProjectionRetry() {
    if (legacyProjectionRetryQueued || legacyProjectionRetryTimer != null) return;
    const delay = legacyProjectionRetryDelays[Math.min(
      legacyProjectionRetryAttempt,
      Math.max(legacyProjectionRetryDelays.length - 1, 0),
    )] || 0;
    const enqueue = () => {
      legacyProjectionRetryTimer = null;
      legacyProjectionRetryQueued = true;
      const generation = legacyProjectionGeneration;
      legacyProjectionIdleHandle = deferSafetyWork(() => {
        legacyProjectionIdleHandle = null;
        if (generation !== legacyProjectionGeneration) return;
        legacyProjectionRetryQueued = false;
        let latest;
        try {
          // Do not replay the snapshot captured by the failed projection. Old
          // pages may have accepted edits meanwhile, so reconcile both current
          // surfaces again and commit that union before mirroring it.
          latest = store.replaceSnapshot(currentDurableState());
        } catch {
          legacyProjectionRetryAttempt += 1;
          queueLegacyProjectionRetry();
          return;
        }
        if (!mirrorLegacyWorkspace(latest)) {
          legacyProjectionRetryAttempt += 1;
          queueLegacyProjectionRetry();
          return;
        }
        legacyProjectionRetryAttempt = 0;
        runtime.protectionState = '本机数据已保护';
        if (started) renderAll();
      });
    };
    const browserWindow = document?.defaultView || globalThis;
    if (delay > 0 && typeof browserWindow.setTimeout === 'function') {
      legacyProjectionRetryTimer = browserWindow.setTimeout(enqueue, delay);
    } else {
      enqueue();
    }
  }

  function projectLegacyWorkspace(state) {
    if (mirrorLegacyWorkspace(state)) return true;
    runtime.protectionState = '主数据已安全保存，兼容页面稍后刷新';
    queueLegacyProjectionRetry();
    return false;
  }

  async function refreshSnapshotCount() {
    try { runtime.snapshotCount = (await snapshotRepository.list()).length; }
    catch { runtime.snapshotCount = 0; }
    if (started) renderAll();
    return runtime.snapshotCount;
  }

  function scheduleUpgradeCheckpoint() {
    const previousVersion = storage?.getItem?.(LAST_PROTECTED_VERSION_KEY);
    deferSafetyWork(async () => {
      try {
        if (previousVersion === APP_VERSION) {
          await refreshSnapshotCount();
          return;
        }
        const checkpointState = preUpgradeState || (preUpgradeRaw
          ? readPersistedStateForBackup({ rawSnapshot: preUpgradeRaw, now, deviceId, createId: browserId })
          : currentDurableState());
        await snapshotRepository.save({
          kind: 'upgrade', appVersion: previousVersion || 'pre-2.11.0',
          backup: buildSafeBackup({ state: checkpointState, baseRevisions: store.loadBaseRevisions?.() || {}, createdAt: now() }),
        });
        storage?.setItem?.(LAST_PROTECTED_VERSION_KEY, APP_VERSION);
        try { delete globalThis.__ZOS_PRE_UPGRADE_RAW__; } catch { /* Optional cleanup. */ }
        await refreshSnapshotCount();
      } catch {
        runtime.protectionState = '请先下载安全备份';
        if (started) renderAll();
      }
    });
  }

  function signalLocalChange() {
    try { (config.eventTarget || globalThis).dispatchEvent(new Event('zos:local-change')); } catch { /* Optional outside browsers. */ }
    queueReminderSchedule();
  }

  function setLocalBusy(kind, value) {
    runtime.localBusy = { ...runtime.localBusy, [kind]: value };
  }

  function setLocalBusyItem(kind, id, busy) {
    const items = new Set(runtime.localBusy?.[kind] || []);
    if (busy) items.add(id);
    else items.delete(id);
    setLocalBusy(kind, [...items]);
  }

  async function submitAiCommand(input, options = {}) {
    if (aiCommandWork) return aiCommandWork;
    aiCommandWork = (async () => {
    const text = String(input || '').trim();
    if (!text) throw new Error('ai_command_input_required');
    setLocalBusy('ai', true);
    const scope = options.scope || runtime.aiCommand?.scope || 'auto';
    const route = routeIntent(text, { scope, agentId: options.agentId || null });
    const interactionMode = options.interactionMode || runtime.aiCommand?.interactionMode || 'text';
    runtime.aiCommand = {
      ...transitionAiCommand(createAiCommand(text, { id: browserId(), scope, now: now() }), 'routing'),
      route, voice: runtime.aiCommand?.voice || { supported: false, state: 'unsupported' },
      interactionMode, speechState: runtime.aiCommand?.speechState || 'idle',
      result: null, preview: null, undo: null,
    };
    renderAll();
    try {
      const turn = ensureAiVoiceTurn();
      runtime.aiCommand = transitionAiCommand(runtime.aiCommand, 'answering');
      renderAll();
      let result = null;
      const response = await turn.submit({
        mode: 'command', question: text, interactionMode,
        page: { route: activePageId() }, agentId: route.agentId || '',
        command: { scope: route.scope, intent: route.intent, riskLevel: route.riskLevel },
      }, {
        speak: interactionMode === 'quick_voice',
        onAnswer: (answer) => {
          const actions = Array.isArray(answer?.actions) ? answer.actions.filter((action) => action && typeof action === 'object') : [];
          result = normalizeAiCommandResult(answer, {
            task: text,
            execution: { level: route.riskLevel, actions },
          });
          runtime.aiCommand = transitionAiCommand(runtime.aiCommand, 'completed', { result, error: null, updatedAt: now() });
          try {
            store.saveEntity('commands', sanitizeAiActivity(runtime.aiCommand));
            signalLocalChange();
          } catch { /* The answer remains usable even when local activity history is unavailable. */ }
          renderAll();
        },
      });
      if (!response || !result) throw new Error('ai_command_cancelled');
      return result;
    } catch {
      runtime.aiCommand = transitionAiCommand(runtime.aiCommand, 'failed', { error: 'AI 暂时不可用，请稍后重试。', updatedAt: now() });
      try {
        store.saveEntity('commands', sanitizeAiActivity(runtime.aiCommand));
        signalLocalChange();
      } catch { /* Keep the visible failure state even when activity history cannot be stored. */ }
      renderAll();
      throw new Error('ai_command_failed');
    } finally {
      setLocalBusy('ai', false);
      renderAll();
    }
    })();
    try { return await aiCommandWork; }
    finally { aiCommandWork = null; }
  }

  async function executeAiCommandAction(indexOrAction = 0) {
    const action = typeof indexOrAction === 'object'
      ? indexOrAction
      : runtime.aiCommand?.result?.execution?.actions?.[Number(indexOrAction)];
    if (!action) throw new Error('ai_command_action_required');
    const navigate = config.navigateTo || globalThis.window?.navigateTo;
    const result = await executeControlledAction(action, {
      navigate: (target) => typeof navigate === 'function' ? navigate(target) : null,
      saveTaskDraft: (draft) => saveTask({
        title: String(draft.title || 'AI 任务草案').trim(),
        description: String(draft.description || draft.summary || '').trim(),
        status: 'open', priority: draft.priority || 'normal', company: draft.company || runtime.aiCommand?.route?.scope || 'ceo',
        tags: ['ai-command', 'draft'], sourceType: 'ai_command', sourceId: runtime.aiCommand?.id,
      }),
      saveInboxDraft: (draft) => {
        const record = store.saveEntity('inbox', {
          title: String(draft.title || 'AI 收集箱草案').trim(),
          description: String(draft.description || draft.summary || '').trim(),
          status: 'draft', company: draft.company || runtime.aiCommand?.route?.scope || 'ceo',
          sourceType: 'ai_command', sourceId: runtime.aiCommand?.id,
        }, { action: 'ai_command_draft' });
        signalLocalChange();
        return record;
      },
    });
    if (result.status === 'preview_required') {
      runtime.aiCommand = transitionAiCommand(runtime.aiCommand, 'preview_required', { preview: result.preview, undo: null });
    } else {
      runtime.aiCommand = transitionAiCommand(runtime.aiCommand, 'completed', { preview: null, undo: result.undo || null });
    }
    renderAll();
    return result;
  }

  function undoAiCommandAction() {
    const undo = runtime.aiCommand?.undo;
    if (!undo?.entityType || !undo.recordId) throw new Error('ai_command_undo_unavailable');
    store.deleteEntity(undo.entityType, undo.recordId);
    runtime.aiCommand = { ...runtime.aiCommand, undo: null };
    signalLocalChange();
    renderAll();
    return true;
  }

  function setAiCommandInput(input, options = {}) {
    runtime.aiCommand = { ...runtime.aiCommand, input: String(input || ''), interactionMode: options.interactionMode || 'text' };
    if (options.render !== false) renderAll();
    return runtime.aiCommand.input;
  }

  function setAiCommandScope(scope) {
    const allowed = new Set(['auto', 'wanjia', 'huahuo', 'lingli', 'life', 'knowledge', 'intelligence', 'agent']);
    runtime.aiCommand = { ...runtime.aiCommand, scope: allowed.has(scope) ? scope : 'auto' };
    renderAll();
    return runtime.aiCommand.scope;
  }

  function ensureAiVoiceInput() {
    if (aiVoiceInput) return aiVoiceInput;
    const generation = ++aiVoiceInputGeneration;
    aiVoiceInput = createVoiceInput({
      Recognition: SpeechRecognition,
      globalObject: document?.defaultView || globalThis,
      onState: (state) => {
        if (generation !== aiVoiceInputGeneration) return;
        const session = aiVoiceDraftSession?.generation === generation ? aiVoiceDraftSession : null;
        const discard = session && ['permission_denied', 'failed'].includes(state);
        runtime.aiCommand = {
          ...runtime.aiCommand,
          ...(discard ? { input: session.originalInput } : {}),
          state,
          voice: { supported: state !== 'unsupported', state },
          error: state === 'permission_denied' ? '未获麦克风权限，请继续使用键盘。' : runtime.aiCommand.error,
        };
        const awaitingHoldRelease = session?.deferCommit
          && session.outcome === 'recording'
          && state === 'idle';
        if (discard || (session && state === 'idle' && !awaitingHoldRelease)) aiVoiceDraftSession = null;
        renderAll();
      },
      onTranscript: (transcript) => {
        if (generation !== aiVoiceInputGeneration) return;
        const session = aiVoiceDraftSession?.generation === generation ? aiVoiceDraftSession : null;
        if (session) {
          session.transcript = transcript;
          if (session.deferCommit && session.outcome === 'recording') return;
        }
        runtime.aiCommand = { ...runtime.aiCommand, input: transcript, interactionMode: 'quick_voice' };
        renderAll();
      },
      onError: (state) => {
        const message = state === 'permission_denied'
          ? '未获麦克风权限，请继续使用键盘。'
          : '语音识别暂不可用，请继续使用键盘。';
        runtime.aiCommand = { ...runtime.aiCommand, error: message };
      },
    });
    return aiVoiceInput;
  }

  function ensureAiVoiceTurn() {
    if (aiVoiceTurn) return aiVoiceTurn;
    const speaker = createBrowserSpeechOutput({
      speechSynthesis, SpeechSynthesisUtterance,
      globalObject: document?.defaultView || globalThis,
    });
    aiVoiceTurn = createVoiceTurn({
      ask: (payload) => {
        const ask = config.askAi || operatingRuntime?.aiAssistant?.ask;
        if (typeof ask !== 'function') throw new Error('ai_not_configured');
        return ask(payload);
      },
      speaker,
      onState: (speechState) => {
        runtime.aiCommand = { ...runtime.aiCommand, speechState };
        renderAll();
      },
    });
    return aiVoiceTurn;
  }

  function stopAiSpeech() {
    const stopped = aiVoiceTurn?.stopAudio?.() === true;
    runtime.aiCommand = { ...runtime.aiCommand, speechState: 'idle' };
    renderAll();
    return stopped;
  }

  function ensureRealtimeVoice() {
    if (aiRealtimeVoice) return aiRealtimeVoice;
    const factory = config.realtimeVoiceFactory || createRealtimeVoice;
    aiRealtimeVoice = factory({
      RTCPeerConnection, mediaDevices,
      clock: config.clock || document?.defaultView || globalThis,
      createAudioElement: config.createRealtimeAudioElement,
      exchangeSdp: (sdp, context) => {
        const exchange = config.exchangeRealtimeSdp || operatingRuntime?.exchangeRealtimeSdp;
        if (typeof exchange !== 'function') throw new Error('realtime_not_configured');
        return exchange(sdp, context);
      },
      onState: (realtimeVoice) => {
        runtime.aiCommand = { ...runtime.aiCommand, realtimeVoice: { ...runtime.aiCommand.realtimeVoice, ...realtimeVoice } };
        if (started) renderAll();
      },
      onCaption: ({ text }) => {
        runtime.aiCommand = {
          ...runtime.aiCommand,
          realtimeVoice: { ...runtime.aiCommand.realtimeVoice, caption: String(text || '') },
        };
        if (started) renderAll();
      },
    });
    return aiRealtimeVoice;
  }

  async function startRealtimeVoice() {
    const voice = ensureRealtimeVoice();
    const route = activePageId();
    const title = String(document?.querySelector?.('.page.active h1, .page.active h2')?.textContent || '').trim();
    aiRealtimeRoute = route;
    try {
      return await voice.start({
        page: { route, title },
        agentId: runtime.aiCommand?.route?.agentId || '',
        knowledgeRefs: [],
      });
    } catch {
      runtime.aiCommand = {
        ...runtime.aiCommand,
        realtimeVoice: { ...runtime.aiCommand.realtimeVoice, state: 'failed', reason: 'start_failed' },
      };
      renderAll();
      return false;
    }
  }

  function stopRealtimeVoice(reason = 'user') {
    aiRealtimeRoute = null;
    return aiRealtimeVoice?.stop?.(reason) || false;
  }

  function interruptRealtimeVoice() {
    return aiRealtimeVoice?.interrupt?.() || false;
  }

  function toggleRealtimeVoiceMute() {
    const muted = !runtime.aiCommand?.realtimeVoice?.muted;
    return aiRealtimeVoice?.setMuted?.(muted) || false;
  }

  function toggleRealtimeVoiceCaptions() {
    const enabled = !runtime.aiCommand?.realtimeVoice?.captionsEnabled;
    return aiRealtimeVoice?.setCaptions?.(enabled) ?? false;
  }

  function startAiVoice(options = {}) {
    const voice = ensureAiVoiceInput();
    if (!voice.supported) {
      runtime.aiCommand = { ...runtime.aiCommand, state: 'unsupported', voice: { supported: false, state: 'unsupported' } };
      renderAll();
      return false;
    }
    if (!aiVoiceDraftSession || aiVoiceDraftSession.generation !== aiVoiceInputGeneration) {
      aiVoiceDraftSession = {
        generation: aiVoiceInputGeneration,
        originalInput: runtime.aiCommand.input,
        transcript: '',
        deferCommit: options.deferCommit === true,
        outcome: 'recording',
      };
    }
    const started = voice.start();
    if (!started && aiVoiceDraftSession?.generation === aiVoiceInputGeneration) aiVoiceDraftSession = null;
    return started;
  }

  function stopAiVoice() {
    const voice = ensureAiVoiceInput();
    const session = aiVoiceDraftSession?.generation === aiVoiceInputGeneration ? aiVoiceDraftSession : null;
    if (session) {
      session.outcome = 'commit';
      if (session.transcript) runtime.aiCommand = { ...runtime.aiCommand, input: session.transcript, interactionMode: 'quick_voice' };
    }
    const stopped = voice.stop();
    if (session && !stopped && aiVoiceDraftSession === session) {
      aiVoiceDraftSession = null;
      renderAll();
    }
    return stopped;
  }

  function abortAiVoice(options = {}) {
    const session = aiVoiceDraftSession;
    aiVoiceInputGeneration += 1;
    aiVoiceInput?.destroy?.();
    aiVoiceInput = null;
    aiVoiceTurn?.destroy?.();
    aiVoiceTurn = null;
    aiVoiceDraftSession = null;
    const supported = typeof SpeechRecognition === 'function';
    runtime.aiCommand = {
      ...runtime.aiCommand,
      ...(session ? { input: session.originalInput } : {}),
      state: supported ? 'idle' : 'unsupported',
      voice: { supported, state: supported ? 'idle' : 'unsupported' },
    };
    if (options.render !== false) renderAll();
    return Boolean(session);
  }

  function toggleAiVoice() {
    return runtime.aiCommand?.voice?.state === 'listening' ? stopAiVoice() : startAiVoice();
  }

  function focusMobileAiSheetInput() {
    document?.querySelector?.('[data-mobile-ai-command-sheet] [data-ai-command-input]')?.focus?.({ preventScroll: true });
  }

  function openMobileAiSheet() {
    mobileAiReturnFocus = document?.activeElement?.matches?.('[data-mobile-ai-command]')
      ? document.activeElement
      : document?.querySelector?.('[data-mobile-ai-command]') || null;
    runtime.mobileAiSheetOpen = true;
    renderAll();
    focusMobileAiSheetInput();
  }

  function closeMobileAiSheet() {
    cancelAiVoiceHold({ abort: true, render: false });
    if (aiVoiceInput) abortAiVoice({ render: false });
    if (aiRealtimeVoice) stopRealtimeVoice('sheet_close');
    runtime.mobileAiSheetOpen = false;
    renderAll();
    mobileAiReturnFocus?.focus?.({ preventScroll: true });
    mobileAiReturnFocus = null;
  }

  function voiceHoldMatches(event) {
    return Boolean(aiVoiceHoldPointer
      && (event?.pointerId == null || event.pointerId === aiVoiceHoldPointer.pointerId));
  }

  function cancelAiVoiceHold({ abort = false, render = true, persistClickSuppression = false } = {}) {
    const clock = document?.defaultView || globalThis;
    if (aiVoiceHoldTimer) clock.clearTimeout?.(aiVoiceHoldTimer);
    aiVoiceHoldTimer = null;
    const wasActive = aiVoiceHoldActive;
    aiVoiceHoldActive = false;
    aiVoiceHoldPointer = null;
    if (wasActive) {
      if (abort) abortAiVoice({ render });
      else stopAiVoice();
    }
    if (wasActive || persistClickSuppression) {
      aiVoiceIgnoreClick = true;
      if (!persistClickSuppression) clock.setTimeout?.(() => { aiVoiceIgnoreClick = false; }, 0);
    }
    return wasActive;
  }

  function viewModel(options = {}) {
    const pageId = options.pageId || null;
    const fullWorkspace = !pageId;
    const needsPage = (...pageIds) => fullWorkspace || pageIds.includes(pageId);
    const needsCalendar = needsPage('dashboard', 'calendar', 'health', 'today');
    const needsLife = needsPage('dashboard', 'life');
    const needsAgent = needsPage('dashboard', 'agent-workbench');
    const needsContent = needsPage('content-growth', 'zos-brain', 'reviews', 'search');
    const needsBusinessRecords = needsPage('relations', 'search') || needsCalendar;
    const needsReliability = needsPage('health', 'calendar');
    const needsCompanyOperating = needsPage('dashboard', 'lingli', 'spark-media');
    const state = store.load();
    const decisions = runtime.loopConnected ? runtime.decisions : (state.collections.decisions || []);
    const brief = runtime.brief || runtime.briefs.at(-1) || null;
    const intelligence = runtime.intelligence.length ? runtime.intelligence : (state.collections.intelligence || []);
    const life = state.collections.life || [];
    const sources = runtime.sources || {};
    const businessRecords = needsBusinessRecords ? ['wanjia', 'huahuo', 'lingli'].flatMap((source) => {
      const payload = sources[source]?.records;
      const rows = Array.isArray(payload) ? payload : payload?.records || [];
      return rows.map((item) => ({ ...item, source, company: source, title: item.merchantName || item.projectName || item.name }));
    }) : [];
    const projects = state.collections.projects || [];
    const tasks = state.collections.tasks || [];
    const focusSessions = state.collections.focus_sessions || [];
    const countdowns = state.collections.countdowns || [];
    const allContentItems = needsContent ? (state.collections.content_items || []).map(normalizeContentItem) : [];
    const contentItems = allContentItems.filter((item) => {
      const companyMatches = runtime.contentCompany === 'all' || item.company === runtime.contentCompany;
      const ownerMatches = runtime.contentOwner === 'all' || item.owner === 'me';
      return companyMatches && ownerMatches;
    });
    const readingItems = needsContent ? (state.collections.reading_items || []).map(normalizeReadingItem) : [];
    const knowledgeCards = needsContent ? (state.collections.knowledge_cards || []) : [];
    const agentRuns = state.collections.agent_runs || [];
    const agentTaskArchives = state.collections.agent_task_archives || [];
    const agentContextCandidates = state.collections.agent_contexts || [];
    const agentOsRecord = needsAgent
      ? ([...(state.collections.agent_os_indexes || [])]
        .sort((left, right) => String(right.importedAt || right.updatedAt || '').localeCompare(String(left.importedAt || left.updatedAt || '')))[0] || null)
      : null;
    const agentOsIndex = agentOsRecord?.index || null;
    const agentOsOverview = agentOsIndex ? buildAgentOsOverview(agentOsIndex) : null;
    const agentOsDetails = agentOsIndex && runtime.agentOsDetailId
      ? agentDetails(agentOsIndex, runtime.agentOsDetailId) : null;
    const aiReady = typeof (config.askAi || operatingRuntime?.aiAssistant?.ask) === 'function';
    const agentOsAgents = agentOsIndex ? visibleAgents(agentOsIndex, runtime.agentOsFilter).map((agent) => ({
      ...agent,
      runtimeAvailability: agentRuntimeAvailability(agent, { aiReady }),
      confirmedContextCount: confirmedContextForAgent(agentContextCandidates, agent.agentId).length,
    })) : [];
    const allAgentOsAgents = agentOsOverview ? Object.values(agentOsOverview.categories || {}).flat() : [];
    const aiOffice = needsPage('agent-workbench') ? buildAiOffice({
      agents: allAgentOsAgents, agentRuns, taskArchives: agentTaskArchives, now: now(),
    }) : null;
    const executionLedger = needsPage('agent-workbench') ? buildExecutionLedger({
      commands: state.collections.commands || [], agentRuns, taskArchives: agentTaskArchives, approvals: runtime.approvals || [],
    }) : [];
    const capabilityRegistry = needsPage('agent-workbench') ? [
      { id: 'chatgpt-text', name: 'ChatGPT 文字问答', level: 'L0', state: aiReady ? 'ready' : 'pending', boundary: '只读回答与草稿' },
      { id: 'quick-voice', name: '快捷语音输入', level: 'L0', state: runtime.aiCommand?.voice?.supported ? 'ready' : 'unsupported', boundary: '转成可编辑文字，不留原始音频' },
      { id: 'realtime-voice', name: 'ChatGPT 实时语音', level: 'L0', state: runtime.aiCommand?.realtimeVoice?.supported ? 'ready' : 'unsupported', boundary: '会话不保存原始音频或字幕' },
      { id: 'knowledge', name: '授权知识摘要', level: 'L0', state: runtime.knowledgeContext?.state === 'ready' ? 'ready' : 'pending', boundary: '按需读取已授权摘要' },
      { id: 'draft', name: '本地草案', level: 'L1', state: 'ready', boundary: '可撤销，不自动外发' },
      { id: 'external', name: '外部写入与发送', level: 'L2', state: 'confirmation_required', boundary: '精确预览后由朱帅确认' },
    ] : [];
    const socialInsights = needsPage('intelligence', 'search') ? rankSocialOpportunities(state.collections.social_insights || []) : [];
    const contentAssets = needsContent ? (state.collections.content_assets || []) : [];
    const brainstorms = needsContent ? (state.collections.brainstorms || []) : [];
    const contentExperiments = needsPage('content-growth', 'reviews') ? (state.collections.content_experiments || []) : [];
    const compoundCandidates = needsPage('content-growth', 'reviews') ? (state.collections.compound_candidates || []) : [];
    const calendar = needsCalendar ? buildCalendar({
      calendar: [...(state.collections.calendar || []), ...(runtime.externalCalendar || [])],
      tasks,
      projects: [...projects, ...businessRecords].map((item) => ({ ...item, dueAt: item.dueAt || item.dueDate || item.shootingDate })),
      life,
      intelligence,
      countdowns,
      focusSessions,
    }, { showFocus: runtime.showFocus })
      .map((item) => item.company === 'life' ? redactLifeEventForWork(item) : item) : [];
    const calendarConflicts = needsCalendar ? detectCalendarConflicts(calendar) : [];
    const baseRevisions = needsReliability ? (store.loadBaseRevisions?.() || {}) : {};
    const syncConflicts = needsReliability ? (operatingRuntime?.syncController?.getConflicts?.() || runtime.conflicts || []) : [];
    const syncControllerStatus = needsReliability ? (operatingRuntime?.syncController?.getStatus?.() || {}) : {};
    const online = needsReliability ? (config.isOnline ? config.isOnline() : document?.defaultView?.navigator?.onLine !== false) : true;
    const restorableItems = needsPage('health') ? listRestorableItems(state.tombstones || [], { now: now(), retentionDays: 30 }) : [];
    const reliability = needsReliability ? buildReliabilityOverview({
      online, deviceId: state.deviceId || deviceId,
      syncStatus: { ...syncControllerStatus, lastSuccessAt: syncControllerStatus.lastSuccessAt || syncMeta.lastSuccessAt || null },
      conflicts: syncConflicts, tombstones: state.tombstones, auditLog: state.auditLog, now: now(),
      snapshotCount: runtime.snapshotCount, protectionState: runtime.protectionState,
    }) : null;
    const calendarSyncStates = needsPage('calendar') ? Object.fromEntries(calendar.map((record) => [
      record.id,
      calendarRecordSyncState(record, { baseRevisions, conflicts: syncConflicts }),
    ])) : {};
    const calendarFiltered = needsPage('calendar') ? calendar.filter((record) => {
      const filter = runtime.calendarFilter;
      if (filter === 'all') return true;
      if (filter === 'task') return record.source === 'local_task';
      if (filter === 'schedule') return record.source !== 'local_task';
      return record.company === filter;
    }) : calendar;
    const importantDates = needsLife ? buildImportantDates(countdowns, { now: now() }) : { work: [], life: [] };
    const digestInput = { tasks, calendar, conflicts: calendarConflicts, importantDates };
    const todayTop3 = needsPage('dashboard', 'health') ? buildTodayTop3({
      tasks,
      decisions,
      risks: runtime.businessExceptions || [],
      calendarConflicts,
      intelligence,
    }, { date: now().slice(0, 10) }) : [];
    const intelligenceFilters = { ...runtime.intelligenceFilters, company: runtime.intelligenceFilters?.company || runtime.intelligenceCompany || 'all' };
    const filteredIntelligence = needsPage('intelligence') ? sortIntelligence(
      filterIntelligence(intelligence, { ...intelligenceFilters, now: now() }),
      intelligenceFilters.sortBy,
    ).slice(0, 100) : [];
    const mustRead = needsPage('dashboard', 'intelligence') ? todayMustRead(intelligence, { now: now() }) : [];
    const homePresence = needsPage('dashboard') ? buildWorkHomepagePresence({
      decisions, importantDates, todayTop3, businessExceptions: runtime.businessExceptions || [], calendarConflicts, mustRead,
    }) : null;
    const currentTargets = runtime.loopConnected ? runtime.targets : (state.collections.targets || []);
    const currentGaps = runtime.loopConnected ? runtime.gaps : (runtime.gaps || []);
    const continuityPrompts = needsPage('dashboard') ? buildContinuityPrompts({
      targets: currentTargets, gaps: currentGaps, tasks, agentRuns, aiCommand: runtime.aiCommand, now: now(),
    }) : [];
    const companyOperating = needsCompanyOperating ? buildCompanyOperatingContract(sources) : {};
    const companyCockpits = needsPage('lingli', 'spark-media') ? Object.fromEntries(['wanjia', 'huahuo', 'lingli'].map((company) => [
      company,
      buildCompanyCockpit(company, { operating: companyOperating[company], decisions, intelligence }),
    ])) : {};
    const wanjiaOps = fullWorkspace ? buildWanjiaOpsModel(sources.wanjia || null, {
      today: now().slice(0, 10), tasks, filters: runtime.wanjiaFilters,
      historyRange: runtime.wanjiaHistoryRange, historyFilters: runtime.wanjiaHistoryFilters, activePane: runtime.wanjiaOpsPane,
    }) : null;
    if (wanjiaOps) wanjiaOps.history.queryFeedback = runtime.wanjiaHistoryFeedback;
    const activeFocus = needsPage('focus') ? [...focusSessions].reverse().find((item) => ['planned', 'running', 'paused'].includes(item.state)) || null : null;
    const searchIndex = needsPage('search') ? buildSearchIndex({
      business: businessRecords,
      knowledge: runtime.brain?.notes || [],
      intelligence,
      actions: [...(state.collections.tasks || []), ...(state.collections.inbox || [])],
      life,
      content: allContentItems,
      reading: readingItems,
      cards: knowledgeCards,
      social: socialInsights,
      agentRuns,
      assets: contentAssets,
      brainstorms,
    }) : [];
    return {
      ...runtime,
      decisions,
      decisionQueues: partitionDecisions(decisions),
      targets: currentTargets,
      gaps: currentGaps,
      tasks: state.collections.tasks || [],
      localAgentTasks: state.collections.local_agent_tasks || [],
      inbox: state.collections.inbox || [],
      todayTop3,
      homePresence,
      reminderQueue: needsPage('dashboard', 'health') ? buildReminderQueue(todayTop3, { now: now() }).map((item) => ({
        ...item,
        actionId: item.sourceType === 'task' ? item.sourceId : item.actionId,
        snoozable: item.sourceType === 'task' && tasks.some((task) => task.id === item.sourceId),
      })) : [],
      brief,
      sources,
      companyOperating,
      companyCockpits,
      wanjiaOps,
      intelligence: needsPage('intelligence') ? filteredIntelligence : intelligence,
      intelligenceAll: intelligence,
      intelligenceTotal: intelligence.length,
      intelligenceCompany: intelligenceFilters.company,
      intelligenceFilters,
      knowledgeContext: runtime.knowledgeContext,
      weather: runtime.weather,
      mustRead,
      calendar,
      calendarFiltered,
      calendarSyncStates,
      calendarView: runtime.calendarView,
      calendarAnchor: runtime.calendarAnchor,
      calendarLayout: needsPage('calendar') ? calendarLayout(calendarFiltered, { view: runtime.calendarView, anchor: runtime.calendarAnchor }) : null,
      calendarTrash: state.tombstones || [],
      syncConflicts,
      reliability,
      restorableItems,
      auditLog: state.auditLog || [],
      showFocus: runtime.showFocus,
      calendarConflicts,
      relations: needsPage('relations') ? buildRelations(businessRecords) : [],
      life,
      lifeSummary: needsPage('life') ? summarizeLife(life) : null,
      lifeNextSevenDays: needsPage('life') ? buildLifeAgenda(life, { now: now(), horizonDays: 7 }) : [],
      rituals: needsPage('life') ? upcomingRituals({ now: now(), horizonDays: 45, ignoredIds: runtime.ignoredRitualIds }) : [],
      privateDateSource: {
        state: life.some((item) => item.kind === 'private_date') ? 'ready' : runtime.privateDateSource.state,
        count: life.filter((item) => item.kind === 'private_date').length,
      },
      importantDates,
      morningDigest: needsPage('dashboard') ? buildMorningDigest(digestInput, { date: now().slice(0, 10), timeZone: 'Asia/Shanghai' }) : null,
      eveningDigest: needsPage('dashboard') ? buildEveningDigest(digestInput, { date: now().slice(0, 10), timeZone: 'Asia/Shanghai' }) : null,
      searchResults: needsPage('search') ? searchWorkspace(searchIndex, runtime.searchQuery) : [],
      today: now().slice(0, 10),
      agendaDate: now().slice(0, 10),
      agenda: needsPage('today') ? groupAgenda([
        ...tasks,
        ...calendar.filter((item) => item.source !== 'local_task').map((item) => ({ ...item, status: 'todo' })),
      ], { date: now().slice(0, 10) }) : [],
      taskDrawerOpen: runtime.taskDrawerOpen,
      taskDraft: runtime.taskDraft,
      countdowns: needsPage('life') ? countdowns.map((item) => ({ ...item, distance: countdownDistance(item, { now: now() }) })) : [],
      focusSession: activeFocus,
      focusSnapshot: needsPage('focus') ? (activeFocus ? focusSnapshot(activeFocus, { now: now() }) : { state: 'planned', remainingSeconds: runtime.focusDuration * 60, elapsedSeconds: 0 }) : null,
      focusTasks: needsPage('focus') ? tasks.filter((item) => !['done', 'completed', 'cancelled'].includes(item.status)) : [],
      focusSummary: needsPage('focus') ? summarizeFocus(focusSessions, { now: now() }) : null,
      contentItems,
      contentCompany: runtime.contentCompany,
      contentOwner: runtime.contentOwner,
      contentOverview: needsPage('content-growth') ? contentOverview(contentItems) : null,
      contentPerformance: needsPage('content-growth', 'reviews') ? contentPerformance(contentItems) : null,
      readingItems,
      knowledgeCards,
      knowledgeReview: needsPage('zos-brain') ? knowledgeReviewQueue(knowledgeCards) : [],
      agentRuns,
      agentSummary: needsPage('agent-workbench') ? summarizeAgentRuns(agentRuns) : null,
      agentOsIndex,
      agentOsOverview,
      agentOsAgents,
      aiOffice,
      capabilityRegistry,
      executionLedger,
      continuityPrompts,
      mobileAgentDirectory: needsPage('agent-workbench') ? buildMobileAgentDirectory(agentOsAgents, {
        recentAgentIds: agentRuns.slice().reverse().slice(0, 8).map((run) => run.agentId),
        expandedOrganizationId: runtime.mobileAgentDirectoryDisclosure.organizationId,
        expandedDepartmentId: runtime.mobileAgentDirectoryDisclosure.departmentId,
      }) : null,
      agentOsDetails,
      agentTaskArchives,
      agentContextCandidates,
      relationReminderDrafts: agentOsDetails?.agentId === 'REL-001' ? buildRelationReminderDrafts({ now: now() }) : [],
      socialInsights,
      contentAssets,
      brainstorms,
      contentExperiments,
      compoundCandidates,
      merchantSearch: runtime.merchantSearch || { state: 'empty_query', matches: [] },
      merchantProfile: runtime.merchantProfile || null,
      merchantDiagnostic: runtime.merchantDiagnostic || null,
      availability: needsPage('spark-media') ? (runtime.availability || queryHuahuoAvailability({ date: runtime.availabilityDate }, { render: false })) : runtime.availability,
    };
  }

  function pageViewModel(pageId) {
    return pageId === 'local-life' ? wanjiaViewModel() : viewModel({ pageId });
  }

  function activePageId() {
    return String(document?.querySelector?.('.page.active')?.id || '').replace(/^page-/, '') || 'dashboard';
  }

  function invalidateWanjiaModel() {
    wanjiaModelCache = null;
  }

  function wanjiaViewModel(options = {}) {
    const state = store.load();
    const tasks = state.collections.tasks || [];
    const decisions = runtime.loopConnected ? runtime.decisions : (state.collections.decisions || []);
    if (!wanjiaModelCache || options.fresh) {
      wanjiaModelCache = buildWanjiaOpsModel(runtime.sources?.wanjia || null, {
        today: now().slice(0, 10), tasks, filters: runtime.wanjiaFilters,
        historyRange: runtime.wanjiaHistoryRange, historyFilters: runtime.wanjiaHistoryFilters,
        activePane: runtime.wanjiaOpsPane,
      });
    }
    const wanjiaOps = {
      ...wanjiaModelCache,
      navigation: buildWanjiaOpsNavigation(runtime.wanjiaOpsPane),
      history: { ...wanjiaModelCache.history },
    };
    wanjiaOps.history.queryFeedback = runtime.wanjiaHistoryFeedback;
    return {
      ...runtime, tasks, decisions, wanjiaOps,
      merchantSearch: runtime.merchantSearch || { state: 'empty_query', matches: [] },
      merchantProfile: runtime.merchantProfile || null,
      merchantDiagnostic: runtime.merchantDiagnostic || null,
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
    invalidateWanjiaModel();
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
    if (refreshSourceWork.has(source)) return refreshSourceWork.get(source);
    setLocalBusyItem('refreshSources', source, true);
    renderAll();
    const work = (async () => {
    if (!operatingRuntime?.operatingLoop) throw new Error('请先登录 Supabase');
    await operatingRuntime.operatingLoop.refresh(source);
    const targets = store.load().collections.targets || [];
    if (targets.length) operatingRuntime.operatingLoop.confirmTargets(targets);
    const brief = operatingRuntime.operatingLoop.ensureDailyBrief();
    updateFromOperatingLoop(brief);
    renderAll();
    return viewModel();
    })();
    refreshSourceWork.set(source, work);
    try { return await work; }
    finally {
      refreshSourceWork.delete(source);
      setLocalBusyItem('refreshSources', source, false);
      renderAll();
    }
  }

  async function refreshIntelligence() {
    if (intelligenceRefreshWork) return intelligenceRefreshWork;
    intelligenceRefreshWork = (async () => {
      setLocalBusyItem('intelligenceIds', 'refresh', true);
      runtime.intelligenceState = 'loading';
      renderAll();
      try {
        if (!operatingRuntime?.loadIntelligence) {
          runtime.intelligenceState = 'authentication_required';
          return runtime.intelligence;
        }
        applyIntelligenceResult(await operatingRuntime.loadIntelligence({ refresh: true }));
        return runtime.intelligence;
      } catch (error) {
        runtime.intelligenceState = runtime.intelligence.length ? 'cached' : safeRefreshCode(error);
        throw error;
      } finally {
        setLocalBusyItem('intelligenceIds', 'refresh', false);
        renderAll();
      }
    })();
    try { return await intelligenceRefreshWork; }
    finally { intelligenceRefreshWork = null; }
  }

  async function diagnoseWanjiaSchema() {
    if (!operatingRuntime?.diagnoseWanjiaSchema) throw new Error('请先登录 Supabase');
    return operatingRuntime.diagnoseWanjiaSchema();
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
    await scheduleDurableReminders();
    return {
      succeeded: results.filter((item) => item.ok).map((item) => item.source),
      failed: results.filter((item) => !item.ok).map(({ source, safeCode }) => ({ source, safeCode })),
    };
  }

  function notifyCurrentReminders() {
    const pending = pageViewModel('dashboard').reminderQueue.filter((item) => !notifiedReminderIds.has(item.id));
    const result = notifyGrantedReminders(pending, config.notificationEnvironment || globalThis);
    if (result.state === 'sent') pending.forEach((item) => notifiedReminderIds.add(item.id));
    runtime.inAppNotificationState = result.state;
    return result;
  }

  function importantDateReminderItems(countdowns = []) {
    return countdowns.map((item) => {
      const distance = countdownDistance(item, { now: now(), timeZone: 'Asia/Shanghai' });
      return {
        ...item,
        entityType: 'important_date',
        startAt: `${distance.occurrence}T09:00:00+08:00`,
        reminders: [43_200, 10_080, 4_320, 0],
        status: distance.state === 'expired' ? 'completed' : 'pending',
      };
    });
  }

  function currentDurableReminderJobs() {
    const state = store.load();
    const model = pageViewModel('dashboard');
    const sourceItems = [
      ...(state.collections.tasks || []).map((item) => ({ ...item, entityType: 'task' })),
      ...(state.collections.calendar || []).map((item) => ({ ...item, entityType: 'calendar' })),
      ...importantDateReminderItems(state.collections.countdowns || []),
      ...buildDailyDigestItems({
        tasks: state.collections.tasks || [], calendar: model.calendar,
        conflicts: model.calendarConflicts, importantDates: model.importantDates,
      }, {
        date: now().slice(0, 10), timeZone: 'Asia/Shanghai',
        morningTime: '07:30', eveningTime: '21:30', includeTomorrowMorning: true,
      }),
    ];
    return buildDurableReminderSchedule(sourceItems, {
      ownerId: operatingRuntime?.session?.userId,
      now: now(),
    });
  }

  async function scheduleDurableReminders({ force = false } = {}) {
    if (runtime.notificationState !== 'enabled' || !operatingRuntime?.pushClient?.schedule || !operatingRuntime?.session?.userId) {
      runtime.reminderScheduleState = 'disabled';
      return { state: 'disabled', scheduled: 0 };
    }
    const jobs = currentDurableReminderJobs();
    const fingerprint = JSON.stringify(jobs);
    if (!force && fingerprint === reminderScheduleFingerprint) {
      return { state: 'synced', scheduled: jobs.length };
    }
    runtime.reminderScheduleState = 'syncing';
    try {
      const result = await operatingRuntime.pushClient.schedule(jobs);
      reminderScheduleFingerprint = fingerprint;
      runtime.reminderScheduleState = result?.state === 'enabled' ? 'synced' : (result?.state || 'schedule_failed');
      runtime.reminderScheduleCount = Number(result?.scheduled) || 0;
      if (result?.state === 'enabled') {
        reminderScheduleRetryAttempt = 0;
        if (reminderScheduleRetryTimer) reminderClock.clearTimeout?.(reminderScheduleRetryTimer);
        reminderScheduleRetryTimer = null;
      }
      return result;
    } catch {
      runtime.reminderScheduleState = 'schedule_failed';
      queueReminderScheduleRetry();
      return { state: 'schedule_failed', scheduled: 0 };
    }
  }

  function queueReminderScheduleRetry() {
    if (!started || reminderScheduleRetryTimer || !reminderClock.setTimeout) return;
    const delay = reminderScheduleRetryDelays[Math.min(reminderScheduleRetryAttempt, reminderScheduleRetryDelays.length - 1)];
    reminderScheduleRetryAttempt += 1;
    reminderScheduleRetryTimer = reminderClock.setTimeout(() => {
      reminderScheduleRetryTimer = null;
      reminderScheduleWork = reminderScheduleWork
        .then(() => scheduleDurableReminders({ force: true }))
        .catch(() => ({ state: 'schedule_failed' }));
    }, delay);
  }

  function queueReminderSchedule() {
    if (runtime.notificationState !== 'enabled') return;
    reminderScheduleWork = reminderScheduleWork
      .then(() => scheduleDurableReminders())
      .catch(() => ({ state: 'schedule_failed' }));
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

  function decisionById(id) {
    return viewModel().decisions.find((item) => item.id === id) || null;
  }

  function openDecisionAction(decisionId, action) {
    const decision = decisionById(decisionId);
    if (!decision) throw new Error('找不到这条决策记录');
    runtime.decisionUi.action = { decisionId, action, note: '' };
    runtime.decisionUi.error = null;
    decisionReturnFocus = { decisionId, action };
    renderAll();
    document?.querySelector?.('.decision-action-drawer [data-decision-close]')?.focus?.();
    return structuredClone(runtime.decisionUi.action);
  }

  function closeDecisionAction() {
    if (runtime.decisionUi.busy) return false;
    runtime.decisionUi.action = null;
    runtime.decisionUi.error = null;
    renderAll();
    const focus = decisionReturnFocus;
    decisionReturnFocus = null;
    const candidates = focus?.action === 'source'
      ? document?.querySelectorAll?.('[data-decision-source]')
      : document?.querySelectorAll?.('[data-decision-action]');
    [...(candidates || [])].find((item) => (focus?.action === 'source'
      ? item.dataset.decisionSource === focus.decisionId
      : item.dataset.decisionId === focus?.decisionId && item.dataset.decisionAction === focus?.action))?.focus?.();
    return true;
  }

  function decisionBusinessFields(record) {
    const next = structuredClone(record);
    for (const key of ['revision', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt']) delete next[key];
    return next;
  }

  function clearDecisionUndo() {
    const clock = document?.defaultView || globalThis;
    if (decisionUndoTimer != null) clock.clearTimeout?.(decisionUndoTimer);
    decisionUndoTimer = null;
    runtime.decisionUi.undo = null;
  }

  async function confirmDecisionAction(note = '') {
    if (decisionActionWork) return decisionActionWork;
    const selected = runtime.decisionUi.action;
    if (!selected || selected.action === 'source') throw new Error('请先选择处理动作');
    const before = decisionById(selected.decisionId);
    if (!before) throw new Error('找不到这条决策记录');
    if (selected.action === 'defer' && !String(note || '').trim()) {
      runtime.decisionUi.error = '暂缓前请填写原因。';
      renderAll();
      throw new Error('暂缓前请填写原因');
    }
    runtime.decisionUi.busy = true;
    runtime.decisionUi.error = null;
    renderAll();
    decisionActionWork = (async () => {
      await Promise.resolve();
      try {
        const changed = applyDecisionAction(before, selected.action, note, { now: now(), deviceId });
        const saved = store.saveEntity('decisions', changed, { action: `decision_${selected.action}` });
        operatingRuntime?.operatingLoop?.updateDecision?.(saved);
        if (operatingRuntime?.operatingLoop) updateFromOperatingLoop();
        else runtime.decisions = store.load().collections.decisions || [];
        clearDecisionUndo();
        runtime.decisionUi.undo = {
          before: decisionBusinessFields(before),
          afterId: saved.id,
          message: `${selected.action === 'delegate' ? '已交负责人跟进' : '决策已保存'}，8 秒内可撤销`,
        };
        const clock = document?.defaultView || globalThis;
        decisionUndoTimer = clock.setTimeout?.(() => {
          decisionUndoTimer = null;
          runtime.decisionUi.undo = null;
          if (started) renderAll();
        }, 8_000);
        decisionUndoTimer?.unref?.();
        runtime.decisionUi.action = null;
        signalLocalChange();
        renderAll();
        return saved;
      } catch (error) {
        runtime.decisionUi.error = '保存失败，请重试；原记录未被删除。';
        renderAll();
        throw error;
      } finally {
        runtime.decisionUi.busy = false;
        decisionActionWork = null;
        if (started) renderAll();
      }
    })();
    return decisionActionWork;
  }

  async function undoDecisionAction() {
    const undo = runtime.decisionUi.undo;
    const beforeRecords = undo?.beforeMany || (undo?.before ? [undo.before] : []);
    if (!beforeRecords.length) return null;
    const restoredRecords = beforeRecords.map((record) => store.saveEntity('decisions', record, { action: 'decision_undo' }));
    restoredRecords.forEach((record) => operatingRuntime?.operatingLoop?.updateDecision?.(record));
    if (operatingRuntime?.operatingLoop) updateFromOperatingLoop();
    else runtime.decisions = store.load().collections.decisions || [];
    clearDecisionUndo();
    signalLocalChange();
    renderAll();
    return restoredRecords.length === 1 ? restoredRecords[0] : restoredRecords;
  }

  function setDecisionSelection(ids = []) {
    const available = new Set(viewModel().decisions.map((item) => item.id));
    runtime.decisionUi.selectedIds = [...new Set(Array.isArray(ids) ? ids : [])]
      .filter((id) => available.has(id));
    runtime.decisionUi.batchError = null;
    renderAll();
    return [...runtime.decisionUi.selectedIds];
  }

  function toggleDecisionSelection(id, selected) {
    const ids = new Set(runtime.decisionUi.selectedIds || []);
    if (selected) ids.add(id); else ids.delete(id);
    return setDecisionSelection([...ids]);
  }

  async function executeDecisionBatch(action) {
    if (decisionActionWork) return decisionActionWork;
    const selectedIds = new Set(runtime.decisionUi.selectedIds || []);
    const before = viewModel().decisions.filter((item) => selectedIds.has(item.id));
    if (!before.length) throw new Error('请先勾选处理历史');
    runtime.decisionUi.batchBusy = true;
    runtime.decisionUi.batchError = null;
    renderAll();
    decisionActionWork = (async () => {
      await Promise.resolve();
      try {
        const result = applyDecisionBatch(before, action, '', { now: now(), deviceId });
        const saved = result.changed.map((record) => store.saveEntity('decisions', record, { action: `decision_batch_${action}` }));
        saved.forEach((record) => operatingRuntime?.operatingLoop?.updateDecision?.(record));
        if (operatingRuntime?.operatingLoop) updateFromOperatingLoop();
        else runtime.decisions = store.load().collections.decisions || [];
        clearDecisionUndo();
        runtime.decisionUi.undo = {
          beforeMany: before.filter((record) => saved.some((item) => item.id === record.id)).map((record) => ({
            ...decisionBusinessFields(record),
            ...(action === 'review_history' && !record.historyReviewed
              ? { historyReviewed: false, historyReviewedAt: null }
              : {}),
          })),
          message: `已批量处理 ${saved.length} 条，8 秒内可撤销`,
        };
        runtime.decisionUi.selectedIds = [];
        const clock = document?.defaultView || globalThis;
        decisionUndoTimer = clock.setTimeout?.(() => {
          decisionUndoTimer = null;
          runtime.decisionUi.undo = null;
          if (started) renderAll();
        }, 8_000);
        decisionUndoTimer?.unref?.();
        signalLocalChange();
        renderAll();
        return { ...result, changed: saved };
      } catch (error) {
        runtime.decisionUi.batchError = '批量处理未完成，原记录已保留，请重试。';
        renderAll();
        throw error;
      } finally {
        runtime.decisionUi.batchBusy = false;
        decisionActionWork = null;
        if (started) renderAll();
      }
    })();
    return decisionActionWork;
  }

  function setDecisionFilter(kind, value) {
    if (!['search', 'company', 'status'].includes(kind)) throw new Error('unsupported decision filter');
    runtime.decisionUi[kind] = String(value || (kind === 'search' ? '' : 'all'));
    runtime.decisionUi.followUpLimit = 6;
    runtime.decisionUi.historyLimit = 6;
    renderAll();
  }

  function loadMoreDecisions(bucket) {
    const key = bucket === 'followUp' ? 'followUpLimit' : 'historyLimit';
    runtime.decisionUi[key] += 12;
    renderAll();
    return runtime.decisionUi[key];
  }

  function quickCapture(title) {
    const text = String(title || '').trim();
    if (!text) return null;
    const item = store.saveEntity('inbox', { title: text, kind: 'quick_capture', status: 'pending_review' });
    signalLocalChange();
    renderAll();
    return item;
  }

  function captureIntelligenceFilterFocus() {
    const active = document?.activeElement;
    if (!active?.matches) return null;
    const selector = active.matches('[data-intelligence-search]')
      ? '[data-intelligence-search]'
      : active.matches('[data-intelligence-filter]')
        ? `[data-intelligence-filter="${active.dataset.intelligenceFilter}"]`
        : active.matches('[data-intelligence-sort]') ? '[data-intelligence-sort]' : null;
    if (!selector) return null;
    return { selector, selectionStart: active.selectionStart, selectionEnd: active.selectionEnd };
  }

  function restoreIntelligenceFilterFocus(focus) {
    if (!focus) return;
    const target = document?.querySelector?.(focus.selector);
    target?.focus?.({ preventScroll: true });
    if (Number.isInteger(focus.selectionStart) && target?.setSelectionRange) {
      target.setSelectionRange(focus.selectionStart, focus.selectionEnd ?? focus.selectionStart);
    }
  }

  function setIntelligenceFilter(kind, value) {
    if (!['company', 'source', 'credibility', 'status', 'age', 'search', 'sortBy'].includes(kind)) throw new Error('unsupported intelligence filter');
    const focus = captureIntelligenceFilterFocus();
    runtime.intelligenceFilters = { ...runtime.intelligenceFilters, [kind]: String(value || (kind === 'search' ? '' : kind === 'sortBy' ? 'newest' : 'all')) };
    runtime.intelligenceCompany = runtime.intelligenceFilters.company;
    renderAll();
    restoreIntelligenceFilterFocus(focus);
    return { ...runtime.intelligenceFilters };
  }

  function resetIntelligenceFilters() {
    runtime.intelligenceFilters = { company: 'all', source: 'all', credibility: 'all', status: 'all', age: 'all', search: '', sortBy: 'newest' };
    runtime.intelligenceCompany = 'all';
    renderAll();
    return { ...runtime.intelligenceFilters };
  }

  function updateIntelligenceStatus(externalId, status) {
    const id = String(externalId || '').trim();
    const current = viewModel().intelligenceAll.find((item) => item.externalId === id);
    if (!current) throw new Error('intelligence_not_found');
    const next = transitionIntelligence(current, status);
    const saved = store.saveEntity('intelligence', { ...next, id: `intelligence:${next.externalId}` });
    const runningItems = runtime.intelligence.length ? runtime.intelligence : (store.load().collections.intelligence || []);
    runtime.intelligence = runningItems.map((item) => item.externalId === saved.externalId ? saved : item);
    if (next.status === 'actioned') convertIntelligenceToTask(next);
    signalLocalChange();
    renderAll();
    return saved;
  }

  function openIntelligenceQuestion(externalId) {
    const id = String(externalId || '').trim();
    const item = viewModel().intelligenceAll.find((entry) => entry.externalId === id);
    if (!item) throw new Error('intelligence_not_found');
    const previous = runtime.intelligenceQuestionStates[id] || {};
    runtime.intelligenceQuestion = { externalId: id, question: previous.question || '' };
    runtime.intelligenceAnswer = previous.answer || null;
    renderAll();
    document?.defaultView?.requestAnimationFrame?.(() => document?.querySelector?.('[data-intelligence-question]')?.focus?.());
    return { ...runtime.intelligenceQuestion };
  }

  async function askIntelligenceQuestion(externalId, question) {
    const id = String(externalId || runtime.intelligenceQuestion?.externalId || '').trim();
    if (intelligenceQuestionWork.has(id)) return intelligenceQuestionWork.get(id);
    const work = (async () => {
      const asked = String(question || '').trim();
      if (!asked) throw new Error('intelligence_question_required');
      const model = viewModel();
      const item = model.intelligenceAll.find((entry) => entry.externalId === id);
      if (!item) throw new Error('intelligence_not_found');
      const loading = { state: 'loading', directAnswer: '正在调用 AI 助手…' };
      runtime.intelligenceQuestionStates = { ...runtime.intelligenceQuestionStates, [id]: { question: asked, answer: loading } };
      if (runtime.intelligenceQuestion?.externalId === id) {
        runtime.intelligenceQuestion = { externalId: id, question: asked };
        runtime.intelligenceAnswer = loading;
      }
      setLocalBusyItem('intelligenceIds', id, true);
      renderAll();
      try {
        const ask = config.askAi || operatingRuntime?.aiAssistant?.ask;
        if (typeof ask !== 'function') {
          const answer = buildIntelligenceAnswer({ item, allItems: model.intelligenceAll, question: asked });
          answer.localFallback = true;
          runtime.intelligenceQuestionStates = { ...runtime.intelligenceQuestionStates, [id]: { question: asked, answer } };
          if (runtime.intelligenceQuestion?.externalId === id) runtime.intelligenceAnswer = answer;
          return answer;
        }
        const response = await ask({
          mode: 'intelligence', question: asked,
          intelligence: { externalId: item.externalId, title: item.title, sourceName: item.sourceName, factSummary: item.factSummary, impactAnalysis: item.impactAnalysis, suggestedAction: item.suggestedAction },
        });
        const answer = { state: 'answered', directAnswer: response.answer, sources: response.sources || [], knowledgeState: response.knowledgeState || 'general_only' };
        runtime.intelligenceQuestionStates = { ...runtime.intelligenceQuestionStates, [id]: { question: asked, answer } };
        if (runtime.intelligenceQuestion?.externalId === id) runtime.intelligenceAnswer = answer;
        return answer;
      } catch (error) {
        const code = String(error?.message || 'ai_request_failed');
        const answer = {
          state: 'error', directAnswer: code === 'ai_not_configured' ? 'AI 服务尚未配置。请在 Supabase 的 Edge Function Secrets 中设置 OPENAI_API_KEY 后重试。' : 'AI 助手本轮未能回答；原始情报卡仍可正常查看。',
          uncertainty: code, nextStep: code === 'ai_not_configured' ? '完成服务端密钥配置后点击“回答”。' : '检查登录与网络后重试。', sources: [],
        };
        runtime.intelligenceQuestionStates = { ...runtime.intelligenceQuestionStates, [id]: { question: asked, answer } };
        if (runtime.intelligenceQuestion?.externalId === id) runtime.intelligenceAnswer = answer;
        return answer;
      } finally {
        setLocalBusyItem('intelligenceIds', id, false);
        renderAll();
      }
    })();
    intelligenceQuestionWork.set(id, work);
    try { return await work; }
    finally { if (intelligenceQuestionWork.get(id) === work) intelligenceQuestionWork.delete(id); }
  }

  function closeIntelligenceQuestion() {
    const id = runtime.intelligenceQuestion?.externalId;
    runtime.intelligenceQuestion = null;
    runtime.intelligenceAnswer = null;
    renderAll();
    document?.defaultView?.requestAnimationFrame?.(() => {
      const trigger = [...(document?.querySelectorAll?.('[data-intelligence-ask]') || [])]
        .find((button) => button.dataset.intelligenceAsk === id);
      trigger?.focus?.();
    });
  }

  function ignoreRitual(id) {
    runtime.ignoredRitualIds = [...new Set([...(runtime.ignoredRitualIds || []), String(id || '')])].filter(Boolean);
    try { storage?.setItem?.('zos_ignored_rituals', JSON.stringify(runtime.ignoredRitualIds)); } catch { /* Local preference only. */ }
    renderAll();
    return [...runtime.ignoredRitualIds];
  }

  function convertRitualToLifeTask(id) {
    const ritual = upcomingRituals({ now: now(), horizonDays: 366, ignoredIds: [] }).find((item) => item.id === id);
    if (!ritual) throw new Error('ritual_not_found');
    const saved = store.saveEntity('life', {
      title: ritual.title, area: ritual.category === 'family' ? 'family' : 'review',
      category: ritual.category, date: ritual.occurrence, status: 'open', kind: 'ritual',
      privacy: 'private', notes: ritual.suggestion,
    });
    signalLocalChange();
    renderAll();
    return saved;
  }

  function importPrivateDateText(text) {
    const rows = parsePrivateDateMetadata(text);
    const saved = rows.map((row) => store.saveEntity('life', {
      ...row, area: row.category === 'relationship' || row.category === 'family' ? 'family' : 'review',
      kind: 'private_date', status: 'open', privacy: 'private',
    }));
    runtime.privateDateSource = { state: 'ready', count: saved.length };
    signalLocalChange();
    renderAll();
    return saved;
  }

  function selectPrivateDateFile() {
    const input = document?.createElement?.('input');
    if (!input) return false;
    input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        importPrivateDateText(await file.text());
      } catch (error) {
        runtime.privateDateSource = { state: 'error', count: 0, message: error?.message || '导入失败' };
        renderAll();
      }
    }, { once: true });
    input.click();
    return true;
  }

  function currentAgentOsIndex() {
    const records = store.load().collections.agent_os_indexes || [];
    return [...records]
      .sort((left, right) => String(right.importedAt || right.updatedAt || '').localeCompare(String(left.importedAt || left.updatedAt || '')))[0]?.index || null;
  }

  function applyAgentOsIndex(input, options = {}) {
    const index = validateAgentOsIndex(input);
    const previous = currentAgentOsIndex();
    runtime.agentOsPatrol = compareAgentOsIndexes(previous, index);
    runtime.agentOsImportState = 'ready';
    runtime.agentOsImportMessage = options.message || `已读取 ${index.agents.length} 个 Agent 身份卡；仅保存索引，不含整库正文。`;
    if (options.persist !== false) {
      store.saveEntity('agent_os_indexes', {
        id: 'agent-os-current', title: 'Agent OS 只读索引', index,
        importedAt: options.importedAt || now(), sourceGeneratedAt: index.generatedAt,
        sourceMode: options.sourceMode || 'manual_readonly_index',
      });
      signalLocalChange();
    }
    if (!runtime.agentOsDetailId || !index.agents.some((agent) => agent.agentId === runtime.agentOsDetailId)) {
      runtime.agentOsDetailId = null;
    }
    renderAll();
    return { index, patrol: runtime.agentOsPatrol };
  }

  function importAgentOsIndexText(text) {
    const parsed = JSON.parse(String(text || ''));
    return applyAgentOsIndex(parsed, { sourceMode: 'manual_readonly_index' });
  }

  function selectAgentOsIndexFile() {
    const input = document?.createElement?.('input');
    if (!input) return false;
    input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        importAgentOsIndexText(await file.text());
      } catch (error) {
        runtime.agentOsImportState = 'error';
        runtime.agentOsImportMessage = error?.message || 'Agent OS 索引导入失败';
        renderAll();
      }
    }, { once: true });
    input.click();
    return true;
  }

  function selectKnowledgeContextFile() {
    const input = document?.createElement?.('input');
    if (!input) return false;
    input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        const index = normalizeKnowledgeContextIndex(JSON.parse(await file.text()));
        if (!operatingRuntime?.saveKnowledgeContext) throw new Error('authentication_required');
        runtime.knowledgeContext = { ...runtime.knowledgeContext, state: 'uploading' };
        renderAll();
        const result = await operatingRuntime.saveKnowledgeContext(index);
        runtime.knowledgeContext = { state: 'ready', count: Number(result?.count) || index.chunks.length, latestAt: now() };
      } catch (error) {
        runtime.knowledgeContext = { ...runtime.knowledgeContext, state: 'error', message: String(error?.message || '知识摘要导入失败') };
      }
      renderAll();
    }, { once: true });
    input.click();
    return true;
  }

  async function loadBundledAgentOsIndex() {
    const existing = currentAgentOsIndex();
    if (typeof config.loadAgentOsIndex !== 'function') {
      if (existing) {
        runtime.agentOsPatrol = compareAgentOsIndexes(existing, existing);
        runtime.agentOsImportState = 'ready';
        runtime.agentOsImportMessage = `已完成本机索引巡检：包含 ${existing.agents.length} 个 Agent。`;
      } else {
        runtime.agentOsImportState = 'manual_required';
        runtime.agentOsImportMessage = '浏览器未获 Vault 文件权限；请手动导入本机生成的只读索引。';
      }
      renderAll();
      return existing;
    }
    const candidate = await config.loadAgentOsIndex();
    const index = validateAgentOsIndex(candidate);
    const candidateTime = Date.parse(index.generatedAt) || 0;
    const existingTime = Date.parse(existing?.generatedAt || '') || 0;
    if (!existing || candidateTime > existingTime) {
      applyAgentOsIndex(index, { sourceMode: 'bundled_readonly_index', message: `已完成启动巡检：发现 ${index.agents.length} 个 Agent。` });
      return index;
    }
    runtime.agentOsPatrol = compareAgentOsIndexes(existing, existing);
    runtime.agentOsImportState = 'ready';
    runtime.agentOsImportMessage = `已完成启动巡检：现有索引包含 ${existing.agents.length} 个 Agent。`;
    renderAll();
    return existing;
  }

  function setAgentOsFilter(filter = 'all') {
    runtime.agentOsFilter = ['all', 'shared', 'wanjia', 'huahuo', 'lingli', 'life', 'private-relations'].includes(filter) ? filter : 'all';
    runtime.agentOsDetailId = null;
    renderAll();
    return runtime.agentOsFilter;
  }

  function openAgentDetails(agentId) {
    const detail = agentDetails(currentAgentOsIndex() || {}, agentId);
    if (!detail) throw new Error('agent_not_found');
    if (detail.agentId === 'REL-001' && runtime.agentOsFilter !== 'private-relations') throw new Error('private_agent_hidden');
    runtime.agentOsDetailId = detail.agentId;
    runtime.agentAnalysis = runtime.agentAnalysisStates[detail.agentId] || null;
    renderAll();
    return detail;
  }

  function closeAgentDetails() {
    runtime.agentOsDetailId = null;
    runtime.agentAnalysis = null;
    renderAll();
  }

  function setAgentAnalysisState(agentId, analysis) {
    runtime.agentAnalysisStates = { ...runtime.agentAnalysisStates, [agentId]: analysis };
    if (runtime.agentOsDetailId === agentId) runtime.agentAnalysis = analysis;
    return analysis;
  }

  async function analyzeAgent(agentId, question) {
    const id = String(agentId || '').trim();
    if (agentAnalysisWork.has(id)) return agentAnalysisWork.get(id);
    const work = (async () => {
      const detail = agentDetails(currentAgentOsIndex() || {}, id);
      if (!detail) throw new Error('agent_not_found');
      if (detail.agentId === 'REL-001' && runtime.agentOsFilter !== 'private-relations') throw new Error('private_agent_hidden');
      if (detail.agentId === 'REL-001') throw new Error('private_agent_local_only');
      runtime.agentOsDetailId = detail.agentId;
      const asked = String(question || '').trim();
      if (!asked) {
        const analysis = setAgentAnalysisState(detail.agentId, { agentId: detail.agentId, state: 'ready', question: '', answer: null });
        renderAll();
        return analysis;
      }
      setAgentAnalysisState(detail.agentId, { agentId: detail.agentId, state: 'loading', question: asked, answer: null });
      setLocalBusyItem('agentIds', detail.agentId, true);
      renderAll();
      try {
        const ask = config.askAi || operatingRuntime?.aiAssistant?.ask;
        if (typeof ask !== 'function') {
          return setAgentAnalysisState(detail.agentId, { agentId: detail.agentId, state: 'error', question: asked, answer: 'AI 服务尚未连接。请登录 Supabase 并完成服务端 OpenAI 配置。', error: 'ai_not_configured' });
        }
        const result = await ask(buildAgentAnalysisRequest(detail, asked, {
          confirmedContext: confirmedContextForAgent(store.load().collections.agent_contexts || [], detail.agentId),
        }));
        return setAgentAnalysisState(detail.agentId, { agentId: detail.agentId, state: 'answered', question: asked, answer: result.answer, sources: result.sources || [], knowledgeState: result.knowledgeState || 'general_only' });
      } catch (error) {
        const code = String(error?.message || 'ai_request_failed');
        return setAgentAnalysisState(detail.agentId, { agentId: detail.agentId, state: 'error', question: asked, answer: code === 'ai_not_configured' ? 'AI 服务尚未配置。请先在 Supabase 设置 OPENAI_API_KEY。' : '本轮分析未完成，请检查登录、网络后重试。', error: code });
      } finally {
        setLocalBusyItem('agentIds', detail.agentId, false);
        renderAll();
      }
    })();
    agentAnalysisWork.set(id, work);
    try { return await work; }
    finally { if (agentAnalysisWork.get(id) === work) agentAnalysisWork.delete(id); }
  }

  async function analyzeAgentTask(archiveId) {
    const id = String(archiveId || '');
    if (agentTaskAnalysisWork.has(id)) return agentTaskAnalysisWork.get(id);
    const work = (async () => {
      const archive = (store.load().collections.agent_task_archives || []).find((item) => item.id === id);
      if (!archive) throw new Error('agent_task_archive_required');
      if (archive.privacy === 'private' || archive.agentId === 'REL-001') throw new Error('private_agent_local_only');
      const detail = agentDetails(currentAgentOsIndex() || {}, archive.agentId);
      if (!detail) throw new Error('agent_not_found');
      const ask = config.askAi || operatingRuntime?.aiAssistant?.ask;
      if (typeof ask !== 'function') throw new Error('ai_not_configured');
      runtime.agentOsDetailId = detail.agentId;
      runtime.agentAnalysis = { agentId: detail.agentId, archiveId: id, state: 'loading', question: archive.objective, answer: null };
      setLocalBusyItem('agentTaskArchives', id, true);
      renderAll();
      try {
        const result = await ask(buildAgentAnalysisRequest(detail, archive.objective, {
          confirmedContext: confirmedContextForAgent(store.load().collections.agent_contexts || [], detail.agentId),
        }));
        const sourceLabels = (result.sources || []).map((item) => typeof item === 'string' ? item : (item.title || item.name || item.path || '')).filter(Boolean);
        const completed = completeAgentTaskArchive(archive, {
          factSummary: String(result.answer || '已完成只读分析。'),
          sourceLabels,
        }, { now: now() });
        const candidate = store.saveEntity('agent_contexts', createContextCandidate(completed, { now: now() }));
        const savedArchive = store.saveEntity('agent_task_archives', { ...completed, contextCandidateId: candidate.id });
        signalLocalChange();
        runtime.agentAnalysis = {
          agentId: detail.agentId, archiveId: id, state: 'answered', question: archive.objective,
          answer: result.answer || '已完成只读分析。', sources: result.sources || [], knowledgeState: result.knowledgeState || 'general_only',
        };
        renderAll();
        return { archive: savedArchive, candidate, analysis: runtime.agentAnalysis };
      } catch (error) {
        runtime.agentAnalysis = { agentId: detail.agentId, archiveId: id, state: 'error', question: archive.objective, answer: '本轮分析未完成，请检查登录、网络与 AI 配置后重试。', error: String(error?.message || 'ai_request_failed') };
        renderAll();
        throw error;
      } finally {
        setLocalBusyItem('agentTaskArchives', id, false);
        renderAll();
      }
    })();
    agentTaskAnalysisWork.set(id, work);
    try { return await work; }
    finally { if (agentTaskAnalysisWork.get(id) === work) agentTaskAnalysisWork.delete(id); }
  }

  function confirmAgentContext(id, summary = '') {
    const candidate = (store.load().collections.agent_contexts || []).find((item) => item.id === id);
    if (!candidate) throw new Error('agent_context_required');
    const saved = store.saveEntity('agent_contexts', confirmContextCandidate(candidate, { summary }, { now: now() }));
    signalLocalChange();
    renderAll();
    return saved;
  }

  function rejectAgentContext(id) {
    const candidate = (store.load().collections.agent_contexts || []).find((item) => item.id === id);
    if (!candidate) throw new Error('agent_context_required');
    const saved = store.saveEntity('agent_contexts', rejectContextCandidate(candidate, { now: now() }));
    signalLocalChange();
    renderAll();
    return saved;
  }

  function invokeAgent(agentId) {
    const detail = agentDetails(currentAgentOsIndex() || {}, agentId);
    if (!detail) throw new Error('agent_not_found');
    if (detail.agentId === 'REL-001' && runtime.agentOsFilter !== 'private-relations') throw new Error('private_agent_hidden');
    const draft = buildAgentInvocationDraft(detail, { now: now() });
    runtime.taskDraft = draft;
    runtime.taskDrawerOpen = true;
    showTaskCenter();
    renderAll();
    return draft;
  }

  function sourceRows(source) {
    const payload = runtime.sources?.[source]?.records;
    return Array.isArray(payload) ? payload : (payload?.records || []);
  }

  function saveTask(input = {}) {
    const existing = input.id ? taskById(input.id) : null;
    const normalized = normalizeTask(input);
    const nextDone = ['done', 'completed'].includes(normalized.status);
    const wasDone = ['done', 'completed'].includes(existing?.status);
    const action = existing && nextDone !== wasDone ? (nextDone ? 'complete' : 'reopen') : undefined;
    const existingEntity = input.id && (store.load().collections.local_agent_tasks || []).some((record) => record.id === input.id)
      ? 'local_agent_tasks' : 'tasks';
    const localOnly = normalized.agentContext?.localOnly || existingEntity === 'local_agent_tasks';
    const entityType = localOnly ? 'local_agent_tasks' : 'tasks';
    const persistedContext = normalized.agentContext?.agentId ? (localOnly ? normalized.agentContext : {
      agentId: normalized.agentContext.agentId,
      agentName: normalized.agentContext.agentName,
      agentStatus: normalized.agentContext.agentStatus,
      category: normalized.agentContext.category,
      mode: normalized.agentContext.mode,
    }) : null;
    const item = store.saveEntity(entityType, { ...normalized, agentContext: persistedContext }, action ? { action } : undefined);
    if (!existing && normalized.agentContext?.agentId) {
      const context = normalized.agentContext;
      store.saveEntity('agent_task_archives', createAgentTaskArchive({
        agentId: context.agentId,
        taskId: item.id,
        objective: normalized.title,
        privacy: context.localOnly ? 'private' : 'internal',
        inputRefs: normalized.tags || [],
        agentRules: {
          outputContract: context.outputContract,
          scopeIn: context.scopeIn,
          scopeOut: context.scopeOut,
          forbiddenActions: context.forbiddenActions,
          knowledgeEntryLabels: context.knowledgeEntries,
        },
        now: now(),
      }));
    }
    runtime.taskDrawerOpen = false;
    runtime.taskDraft = null;
    signalLocalChange();
    renderAll();
    return item;
  }

  function taskById(id) {
    const collections = store.load().collections;
    return (collections.local_agent_tasks || []).find((record) => record.id === id)
      || (collections.tasks || []).find((record) => record.id === id) || null;
  }

  function taskEntityType(id) {
    return (store.load().collections.local_agent_tasks || []).some((record) => record.id === id) ? 'local_agent_tasks' : 'tasks';
  }

  function deleteTask(id) {
    const existing = taskById(id);
    if (!existing) throw new Error('task_required');
    const entityType = taskEntityType(id);
    const result = store.deleteEntity(entityType, id);
    runtime.calendarUndoDelete = { entity: entityType, id, title: existing.title };
    runtime.calendarPendingDelete = null;
    runtime.selectedCalendarId = null;
    runtime.calendarPanel = null;
    signalLocalChange();
    renderAll();
    return result;
  }

  function restoreTask(id) {
    const tombstone = store.load().tombstones.find((record) => ['tasks', 'local_agent_tasks'].includes(record.entity) && record.id === id);
    if (!tombstone) throw new Error('task_tombstone_required');
    const result = store.restoreEntity(tombstone.entity, id);
    if (runtime.calendarUndoDelete?.entity === tombstone.entity && runtime.calendarUndoDelete.id === id) {
      runtime.calendarUndoDelete = null;
    }
    signalLocalChange();
    renderAll();
    return result;
  }

  function toggleTask(id) {
    const task = taskById(id);
    if (!task) throw new Error('task_required');
    return saveTask({ ...task, status: ['done', 'completed'].includes(task.status) ? 'todo' : 'done' });
  }

  function copyTask(id) {
    const existing = taskById(id);
    if (!existing) throw new Error('task_required');
    const {
      id: _id, revision: _revision, createdAt: _createdAt, updatedAt: _updatedAt,
      deletedAt: _deletedAt, deviceId: _deviceId, ...copy
    } = existing;
    return saveTask({ ...copy, title: `${existing.title}（副本）` });
  }

  function moveTask(id, patch = {}) {
    const existing = taskById(id);
    if (!existing) throw new Error('task_required');
    let dueAt = patch.dueAt === undefined ? existing.dueAt : patch.dueAt;
    if (patch.startAt && patch.dueAt === undefined && existing.startAt && existing.dueAt) {
      const duration = Math.max(0, new Date(existing.dueAt) - new Date(existing.startAt));
      dueAt = new Date(new Date(patch.startAt).getTime() + duration).toISOString();
    }
    return saveTask({ ...existing, ...patch, dueAt });
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

  async function enableClosedAppReminders() {
    const pushClient = operatingRuntime?.pushClient;
    if (!pushClient) {
      runtime.notificationState = 'authentication_required';
      renderAll();
      return { state: runtime.notificationState };
    }
    try {
      const result = await enablePushNotifications({
        environment: document?.defaultView || globalThis,
        publicKey: runtime.notificationPublicKey,
        registerSubscription: (subscription) => pushClient.register(subscription),
      });
      runtime.notificationState = result.state;
      if (result.state === 'enabled') await scheduleDurableReminders({ force: true });
      renderAll();
      return result;
    } catch {
      runtime.notificationState = 'subscription_failed';
      renderAll();
      return { state: runtime.notificationState };
    }
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
    const currentMerchants = viewModel().wanjiaOps.merchants;
    const result = searchMerchants(currentMerchants, runtime.merchantQuery);
    runtime.merchantSearch = result;
    const selected = options.id
      ? currentMerchants.find((item) => item.id === options.id)
      : result.merchant;
    runtime.selectedMerchantId = selected?.id || null;
    runtime.merchantProfile = selected ? buildMerchantProfile(selected, {
      tasks: store.load().collections.tasks || [], now: now(),
    }) : null;
    runtime.merchantDiagnostic = selected ? buildMerchantDiagnostic(selected) : null;
    if (options.render !== false) renderAll();
    return result;
  }

  function setWanjiaFilters(filters = {}) {
    runtime.wanjiaFilters = { ...runtime.wanjiaFilters, ...filters };
    invalidateWanjiaModel();
    renderAll();
    return runtime.wanjiaFilters;
  }

  function setWanjiaOpsPane(pane) {
    runtime.wanjiaOpsPane = normalizeWanjiaOpsPane(pane);
    const rendered = renderWanjiaActivePanel(document?.getElementById?.('wanjiaOperatingRoot'), wanjiaViewModel());
    if (!rendered) renderAll();
    return runtime.wanjiaOpsPane;
  }

  function resetWanjiaFilters() {
    runtime.wanjiaFilters = {
      query: '', industry: 'all', cooperationType: 'all', owner: 'all', health: 'all',
      abnormal: 'all', active: 'all', live: 'all', video: 'all', groupbuyGmv: 'all', sort: '',
    };
    invalidateWanjiaModel();
    renderAll();
  }

  function setWanjiaHistoryRange(range = {}) {
    runtime.wanjiaHistoryRange = { ...runtime.wanjiaHistoryRange, ...range };
    invalidateWanjiaModel();
    renderAll();
    return runtime.wanjiaHistoryRange;
  }

  function setWanjiaHistoryFilters(filters = {}) {
    runtime.wanjiaHistoryFilters = { ...runtime.wanjiaHistoryFilters, ...filters };
    invalidateWanjiaModel();
    renderAll();
    return runtime.wanjiaHistoryFilters;
  }

  function applyWanjiaHistoryQuery({ range = {}, filters = {} } = {}) {
    runtime.wanjiaHistoryRange = { ...runtime.wanjiaHistoryRange, ...range };
    runtime.wanjiaHistoryFilters = { ...runtime.wanjiaHistoryFilters, ...filters };
    invalidateWanjiaModel();
    const history = wanjiaViewModel().wanjiaOps.history;
    const label = `${history.range.startDate} 至 ${history.range.endDate}`;
    runtime.wanjiaHistoryFeedback = history.availability?.state === 'validated'
      ? `已应用查询：${label}。已按当前时间范围与筛选条件更新。`
      : `已应用查询：${label}。暂无已校验历史数据，因此没有新的图表或排行。`;
    renderAll();
    return {
      range: runtime.wanjiaHistoryRange,
      filters: runtime.wanjiaHistoryFilters,
    };
  }

  function resetWanjiaHistoryFilters() {
    runtime.wanjiaHistoryRange = { preset: 'today', startDate: '', endDate: '' };
    runtime.wanjiaHistoryFilters = { merchantId: '', industry: 'all', owner: 'all', cooperationType: 'all', abnormal: 'all' };
    runtime.wanjiaHistoryFeedback = '已恢复今天范围与全部筛选条件。';
    invalidateWanjiaModel();
    renderAll();
  }

  function focusWanjiaKpi(key) {
    if (key === 'completed_tasks_today') {
      showTaskCenter();
      return;
    }
    runtime.wanjiaOpsPane = 'merchant_ops';
    const next = { abnormal: 'all', active: 'all', groupbuyGmv: 'all', sort: key };
    if (key === 'active_merchants') next.active = 'yes';
    if (key === 'today_payment_gmv') next.groupbuyGmv = 'yes';
    if (['exception_merchants', 'pending_exceptions'].includes(key)) next.abnormal = 'yes';
    setWanjiaFilters(next);
    document?.querySelector?.('.wanjia-filter-bar')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function diagnoseWanjiaMerchant(id) {
    const merchant = viewModel().wanjiaOps.merchants.find((item) => item.id === id || item.merchantId === id);
    if (!merchant) return null;
    runtime.merchantQuery = merchant.merchantName || merchant.merchantId || id;
    queryMerchant(runtime.merchantQuery, { id: merchant.id, render: false });
    renderAll();
    document?.getElementById?.('merchantCenterRoot')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return runtime.merchantDiagnostic;
  }

  function openWanjiaTaskDraft(merchantId, opportunityId = null) {
    const model = viewModel().wanjiaOps;
    const merchant = model.merchants.find((item) => item.id === merchantId || item.merchantId === merchantId);
    const opportunity = opportunityId ? model.opportunities.find((item) => item.id === opportunityId) : null;
    if (!merchant && !opportunity) throw new Error('wanjia_merchant_not_found');
    const target = merchant || model.merchants.find((item) => item.id === opportunity.merchantId);
    const title = opportunity
      ? `【商机草案】${opportunity.merchantName}｜${opportunity.type}`
      : `【运营任务草案】${target.merchantName}｜${target.anomalyTypes[0] || '经营跟进'}`;
    const description = opportunity
      ? `数据依据：${opportunity.evidence}\n建议服务：${opportunity.service}\n下一步：${opportunity.nextAction}\n\n仅为草案，保存后仍需人工确认负责人和执行时间。`
      : `异常：${target.anomalyTypes.join('、') || '待确认'}\n数据：支付 GMV ${target.paymentGmv ?? '待同步'}；核销 GMV ${target.redeemedGmv ?? '待同步'}；核销率 ${target.redemptionRate ?? '待同步'}\n建议：${target.suggestedAction}\n建议负责人：${target.owner || '待确认'}\n\n仅为草案，不会自动派单或写回飞书。`;
    runtime.taskDraft = {
      title, description, company: 'wanjia', priority: target.priority === 'P0' ? 3 : target.priority === 'P1' ? 2 : 1,
      tags: opportunity ? ['万嘉', '增长机会', '草案'] : ['万嘉', '运营异常', '草案'],
      businessEntityType: 'merchant', businessEntityId: target.id,
      assigneeIds: [],
    };
    runtime.taskDrawerOpen = true;
    showTaskCenter();
    renderAll();
    return runtime.taskDraft;
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

  function setTaskQuickFilter(filter) {
    const next = ['all', 'today', 'overdue', 'mine', 'todo', 'done'].includes(filter) ? filter : 'all';
    runtime.taskQuickFilter = next;
    renderAll();
    return next;
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
    const derivedException = Boolean(
      input.id && !existing && input.seriesId && input.originalStartAt
      && input.id === calendarExceptionId(input.seriesId, input.originalStartAt),
    );
    if (input.id && ((!existing && !derivedException) || (existing && !calendarEventCapabilities(existing).edit))) {
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
    runtime.calendarUndoDelete = { entity: 'calendar', id, title: existing.title };
    runtime.calendarPendingDelete = null;
    signalLocalChange();
    renderAll();
    return result;
  }

  function restoreCalendar(id) {
    const tombstone = store.load().tombstones.find((record) => record.entity === 'calendar' && record.id === id);
    if (!tombstone || !calendarEventCapabilities(tombstone).edit) throw new Error('calendar_local_event_required');
    const result = store.restoreEntity('calendar', id);
    if (runtime.calendarUndoDelete?.entity === 'calendar' && runtime.calendarUndoDelete.id === id) {
      runtime.calendarUndoDelete = null;
    }
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
    runtime.calendarDaySheetOpen = false;
    runtime.calendarPanel = 'detail';
    renderAll();
  }

  function openCalendarDaySheet(date) {
    const selectedDate = String(date || '').slice(0, 10);
    runtime.calendarSelectedDate = selectedDate;
    runtime.calendarSelection = normalizeCalendarSelection(selectedDate, selectedDate);
    runtime.calendarSelecting = false;
    runtime.calendarPanel = null;
    runtime.calendarDaySheetOpen = true;
    renderAll();
    return runtime.calendarSelection;
  }

  function closeCalendarDaySheet() {
    runtime.calendarDaySheetOpen = false;
    runtime.calendarSelectedDate = null;
    renderAll();
  }

  function openCalendarEditor(id = null, inputDraft = null, inputKind = null) {
    const event = id ? selectedCalendarEvent(id) : null;
    if (event && !calendarEventCapabilities(event).edit) throw new Error('calendar_local_event_required');
    runtime.selectedCalendarId = id;
    runtime.calendarDraftKind = event ? calendarEventCapabilities(event).kind : (inputKind || (runtime.calendarView === 'month' ? 'task' : 'calendar'));
    const sourceRecord = event?.source === 'local_task' ? taskById(id) : event;
    runtime.calendarDraft = sourceRecord ? { ...sourceRecord } : inputDraft ? { ...inputDraft } : {
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
    runtime.calendarDraftKind = 'calendar';
    runtime.calendarSelection = null;
    runtime.calendarSelecting = false;
    runtime.calendarDaySheetOpen = false;
    runtime.calendarSelectedDate = null;
    runtime.selectedCalendarId = null;
    runtime.calendarPendingMutation = null;
    runtime.calendarPendingDelete = null;
    runtime.calendarFormError = null;
    renderAll();
  }

  function paintCalendarSelection() {
    const selection = runtime.calendarSelection;
    document?.querySelectorAll?.('[data-calendar-select-date]')?.forEach?.((node) => {
      const date = node.dataset?.calendarSelectDate;
      const selected = Boolean(selection && date >= selection.startDate && date <= selection.endDate);
      node.classList?.toggle?.('is-selected', selected);
      node.classList?.toggle?.('is-selecting', selected && runtime.calendarSelecting);
    });
  }

  function clearCalendarTouchPending() {
    const pending = runtime.calendarTouchPending;
    if (pending?.timer != null) (document?.defaultView || globalThis).clearTimeout?.(pending.timer);
    runtime.calendarTouchPending = null;
  }

  function clearCalendarEventLongPress() {
    const pending = runtime.calendarEventLongPress;
    if (pending?.timer != null) (document?.defaultView || globalThis).clearTimeout?.(pending.timer);
    runtime.calendarEventLongPress = null;
  }

  function beginCalendarSelection(date) {
    runtime.calendarSelection = normalizeCalendarSelection(date, date);
    runtime.calendarSelecting = true;
    runtime.calendarPanel = null;
    paintCalendarSelection();
    return runtime.calendarSelection;
  }

  function extendCalendarSelection(date) {
    if (!runtime.calendarSelecting || !runtime.calendarSelection?.startDate) return runtime.calendarSelection;
    runtime.calendarSelection = normalizeCalendarSelection(runtime.calendarSelection.startDate, date);
    paintCalendarSelection();
    return runtime.calendarSelection;
  }

  function selectionDraftForKind(kind) {
    const selection = normalizeCalendarSelection(
      runtime.calendarSelection?.startDate,
      runtime.calendarSelection?.endDate,
    );
    if (kind === 'task') return calendarSelectionDraft(selection, { view: 'month' });
    if (runtime.calendarView !== 'month') return calendarSelectionDraft(selection, { view: runtime.calendarView });
    return {
      kind: 'calendar', allDay: true,
      startAt: `${selection.startDate}T00:00`, endAt: `${selection.endDate}T23:59`,
    };
  }

  function commitCalendarSelection() {
    if (!runtime.calendarSelection) return null;
    runtime.calendarSelecting = false;
    const kind = runtime.calendarView === 'month' ? 'task' : 'calendar';
    const draft = {
      ...selectionDraftForKind(kind), company: 'ceo', privacy: 'work', reminders: [], priority: 2,
      occupyCalendar: true,
    };
    openCalendarEditor(null, draft, kind);
    return runtime.calendarDraft;
  }

  function setCalendarDraftKind(kind) {
    if (!['task', 'calendar'].includes(kind) || !runtime.calendarSelection) throw new Error('calendar_schedule_kind_invalid');
    const previous = runtime.calendarDraft || {};
    runtime.calendarDraftKind = kind;
    runtime.calendarDraft = {
      ...previous,
      ...selectionDraftForKind(kind),
      company: previous.company || 'ceo',
    };
    runtime.calendarFormError = null;
    renderAll();
    return runtime.calendarDraft;
  }

  function saveCalendarArrangement(input = {}) {
    const { scheduleKind = runtime.calendarDraftKind || 'calendar', ...fields } = input;
    let saved;
    if (scheduleKind === 'task') saved = saveTask(fields);
    else if (scheduleKind === 'calendar') saved = saveCalendarFromPanel(fields);
    else throw new Error('calendar_schedule_kind_invalid');
    runtime.calendarPanel = null;
    runtime.calendarDraft = null;
    runtime.calendarSelection = null;
    runtime.calendarSelecting = false;
    renderAll();
    return saved;
  }

  function requestCalendarMutation(id, action) {
    const event = selectedCalendarEvent(id);
    if (!event || !calendarEventCapabilities(event)[action === 'delete' ? 'remove' : 'edit']) {
      throw new Error('calendar_local_event_required');
    }
    const recurring = calendarEventCapabilities(event).kind === 'calendar'
      && Boolean(event.recurrenceRule || event.originalStartAt || event.seriesId);
    if (!recurring) {
      if (action === 'delete') return requestCalendarDeletion(id);
      openCalendarEditor(id);
      return event;
    }
    runtime.calendarPendingMutation = { id, action };
    runtime.calendarPanel = 'series';
    renderAll();
    return event;
  }

  function requestCalendarDeletion(id) {
    const event = selectedCalendarEvent(id);
    const capabilities = calendarEventCapabilities(event || {});
    if (!event || !capabilities.remove) throw new Error('calendar_local_event_required');
    runtime.calendarPendingDelete = {
      entity: capabilities.kind === 'task' ? 'tasks' : 'calendar',
      id,
      title: event.title,
    };
    runtime.calendarPanel = 'delete-confirm';
    renderAll();
    return runtime.calendarPendingDelete;
  }

  function confirmCalendarDeletion() {
    const pending = runtime.calendarPendingDelete;
    if (!pending) throw new Error('calendar_delete_confirmation_required');
    return pending.entity === 'tasks' ? deleteTask(pending.id) : deleteCalendar(pending.id);
  }

  function restoreCalendarEntity(entity, id) {
    if (entity === 'tasks') return restoreTask(id);
    if (entity === 'calendar') return restoreCalendar(id);
    throw new Error('calendar_restore_entity_invalid');
  }

  function undoCalendarDelete() {
    const pending = runtime.calendarUndoDelete;
    if (!pending) return null;
    return restoreCalendarEntity(pending.entity, pending.id);
  }

  function setCalendarFilter(filter) {
    const allowed = new Set(['all', 'task', 'schedule', 'wanjia', 'huahuo', 'lingli', 'life']);
    if (!allowed.has(filter)) throw new Error('calendar_filter_invalid');
    runtime.calendarFilter = filter;
    renderAll();
    return filter;
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

  function promptValue(message, defaultValue = '') {
    return (config.prompt || globalThis.prompt)?.(message, defaultValue);
  }

  function confirmAction(message) {
    return (config.confirm || globalThis.confirm)?.(message) === true;
  }

  function saveContentItem(input = {}) {
    const record = store.saveEntity('content_items', normalizeContentItem(input));
    signalLocalChange();
    renderAll();
    return record;
  }

  function captureContentItem(seed = {}) {
    const title = promptValue('内容标题 / 选题名称', seed.title || '');
    if (!String(title || '').trim()) return null;
    const company = promptValue('归属：wanjia / huahuo / lingli / personal', seed.company || 'wanjia');
    const platform = promptValue('平台：douyin / xiaohongshu / wechat / bilibili', seed.platform || 'douyin');
    const angle = promptValue('内容角度或要解决的用户问题', seed.angle || '');
    return saveContentItem({ ...seed, title, company, platform, angle, owner: seed.owner || 'me', stage: seed.stage || 'idea' });
  }

  function editContentItem(id) {
    const item = store.load().collections.content_items?.find((record) => record.id === id);
    if (!item) throw new Error('content_item_not_found');
    const title = promptValue('内容标题', item.title);
    if (!String(title || '').trim()) return item;
    const angle = promptValue('内容角度', item.angle || '');
    return saveContentItem({ ...item, title, angle });
  }

  function advanceContentItem(id, nextStage) {
    const item = store.load().collections.content_items?.find((record) => record.id === id);
    if (!item) throw new Error('content_item_not_found');
    const approved = nextStage !== 'published' || confirmAction('确认这条内容已完成审核并正式发布？');
    if (!approved) return item;
    return saveContentItem(transitionContent(item, nextStage, { approved, now: now() }));
  }

  function deletePrivateEntity(entityType, id, confirmation) {
    if (!confirmAction(confirmation)) return null;
    const deleted = store.deleteEntity(entityType, id);
    signalLocalChange();
    renderAll();
    return deleted;
  }

  function captureReadingItem() {
    const sourceUrl = promptValue('粘贴网页、视频、PDF 或飞书链接');
    if (!String(sourceUrl || '').trim()) return null;
    const title = promptValue('阅读标题', '待读资料');
    const sourceType = promptValue('类型：web / video / pdf / feishu / book / course', 'web');
    const record = store.saveEntity('reading_items', normalizeReadingItem({ title, sourceUrl, sourceType }));
    signalLocalChange(); renderAll(); return record;
  }

  function updateReadingProgress(id) {
    const item = store.load().collections.reading_items?.find((record) => record.id === id);
    if (!item) throw new Error('reading_item_not_found');
    const progress = promptValue('完成进度（0-100）', String(item.progress || 0));
    if (progress == null) return item;
    const record = store.saveEntity('reading_items', normalizeReadingItem({ ...item, progress }));
    signalLocalChange(); renderAll(); return record;
  }

  function readingToKnowledgeCard(id) {
    const item = store.load().collections.reading_items?.find((record) => record.id === id);
    if (!item) throw new Error('reading_item_not_found');
    const quote = promptValue('原文摘录（可留空）', item.highlights?.[0] || '');
    const insight = promptValue('你的理解 / 可执行结论');
    if (!String(insight || '').trim()) return null;
    const record = store.saveEntity('knowledge_cards', createKnowledgeCard({
      sourceId: item.id, sourceUrl: item.sourceUrl, title: item.title, quote, insight,
    }));
    signalLocalChange(); renderAll(); return record;
  }

  function reviewKnowledgeCard(id) {
    const item = store.load().collections.knowledge_cards?.find((record) => record.id === id);
    if (!item) throw new Error('knowledge_card_not_found');
    if (!confirmAction('确认该知识卡片已核对来源并通过审核？')) return item;
    const record = store.saveEntity('knowledge_cards', { ...item, reviewStatus: 'approved', reviewedAt: now() });
    signalLocalChange(); renderAll(); return record;
  }

  function editKnowledgeCard(id) {
    const item = store.load().collections.knowledge_cards?.find((record) => record.id === id);
    if (!item) throw new Error('knowledge_card_not_found');
    const title = promptValue('知识卡片标题', item.title || '');
    if (!String(title || '').trim()) return item;
    const insight = promptValue('你的理解 / 可执行结论', item.insight || '');
    const record = store.saveEntity('knowledge_cards', { ...item, title, insight, reviewStatus: 'pending' });
    signalLocalChange(); renderAll(); return record;
  }

  function captureBrainstorm() {
    const title = promptValue('头脑风暴主题');
    if (!String(title || '').trim()) return null;
    const directions = String(promptValue('初始方向（用逗号分隔）', '') || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const record = store.saveEntity('brainstorms', createBrainstorm({ title, nodes: directions.map((direction, index) => ({ id: `direction-${index + 1}`, title: direction })) }));
    signalLocalChange(); renderAll(); return record;
  }

  function captureAsset() {
    const title = promptValue('素材名称');
    if (!String(title || '').trim()) return null;
    const mediaType = promptValue('素材类型：photo / video / template / music', 'video');
    const licenseStatus = promptValue('授权状态：owned / licensed / pending', 'pending');
    const record = store.saveEntity('content_assets', { title, mediaType, licenseStatus, reuseScope: 'internal_review' });
    signalLocalChange(); renderAll(); return record;
  }

  function captureSocialInsight() {
    const claim = promptValue('洞察或用户问题');
    if (!String(claim || '').trim()) return null;
    const sourceUrl = promptValue('证据链接（没有可留空）', '');
    const platform = promptValue('平台', 'douyin');
    const record = store.saveEntity('social_insights', normalizeSocialInsight({ claim, sourceUrl, platform, capturedAt: sourceUrl ? now() : '', score: 60 }));
    signalLocalChange(); renderAll(); return record;
  }

  function editSocialInsight(id) {
    const item = store.load().collections.social_insights?.find((record) => record.id === id);
    if (!item) throw new Error('social_insight_not_found');
    const claim = promptValue('洞察或用户问题', item.claim || '');
    if (!String(claim || '').trim()) return item;
    const sourceUrl = promptValue('证据链接（没有可留空）', item.sourceUrl || '');
    const company = promptValue('归属：wanjia / huahuo / lingli / personal', item.company || 'wanjia');
    const record = store.saveEntity('social_insights', normalizeSocialInsight({
      ...item, claim, sourceUrl, company, capturedAt: sourceUrl ? (item.capturedAt || now()) : '',
    }));
    signalLocalChange(); renderAll(); return record;
  }

  function socialInsightToContent(id) {
    const insight = store.load().collections.social_insights?.find((record) => record.id === id);
    if (!insight) throw new Error('social_insight_not_found');
    return captureContentItem({ title: insight.claim, company: insight.company, sourceRefs: [insight.sourceUrl].filter(Boolean), angle: insight.userQuestion || insight.contentGap || '' });
  }

  function captureContentExperiment() {
    const title = promptValue('实验名称');
    if (!String(title || '').trim()) return null;
    const variable = promptValue('实验变量：标题 / 封面 / 开头 / 发布时间', '标题');
    const first = promptValue('方案 A', 'A');
    const second = promptValue('方案 B', 'B');
    const record = store.saveEntity('content_experiments', evaluateExperiment({
      title, variable, status: 'planned',
      variants: [{ id: 'A', label: first, metric: null }, { id: 'B', label: second, metric: null }],
    }));
    signalLocalChange(); renderAll(); return record;
  }

  function updateContentExperiment(id) {
    const item = store.load().collections.content_experiments?.find((record) => record.id === id);
    if (!item) throw new Error('content_experiment_not_found');
    const variants = (item.variants || []).map((variant) => ({
      ...variant,
      metric: promptValue(`${variant.label || variant.id} 的真实结果`, variant.metric == null ? '' : String(variant.metric)),
    }));
    const record = store.saveEntity('content_experiments', evaluateExperiment({ ...item, variants }));
    signalLocalChange(); renderAll(); return record;
  }

  function compoundContentItem(id, type = 'case') {
    const item = store.load().collections.content_items?.find((record) => record.id === id);
    if (!item) throw new Error('content_item_not_found');
    const record = store.saveEntity('compound_candidates', buildCompoundCandidate(item, { type }));
    signalLocalChange(); renderAll(); return record;
  }

  function reviewCompoundCandidate(id) {
    const item = store.load().collections.compound_candidates?.find((record) => record.id === id);
    if (!item) throw new Error('compound_candidate_not_found');
    if (!confirmAction('确认该复利候选已核对来源，可进入人工沉淀流程？')) return item;
    const record = store.saveEntity('compound_candidates', { ...item, status: 'approved', reviewedAt: now() });
    signalLocalChange(); renderAll(); return record;
  }

  function launchAgentRun(agentId) {
    const objective = promptValue('这次希望 Agent 完成什么？');
    if (!String(objective || '').trim()) return null;
    const record = store.saveEntity('agent_runs', createAgentRun({ agentId, objective, status: 'draft', inputRefs: [] }));
    signalLocalChange(); renderAll(); return record;
  }

  function updateContentMetrics(id) {
    const item = store.load().collections.content_items?.find((record) => record.id === id);
    if (!item) throw new Error('content_item_not_found');
    const metrics = {
      views: promptValue('播放 / 阅读量', String(item.metrics?.views || 0)),
      interactions: promptValue('互动量', String(item.metrics?.interactions || 0)),
      leads: promptValue('有效咨询 / 线索', String(item.metrics?.leads || 0)),
      revenue: promptValue('关联已确认回款', String(item.metrics?.revenue || 0)),
    };
    return saveContentItem({ ...item, metrics });
  }

  function editAsset(id) {
    const item = store.load().collections.content_assets?.find((record) => record.id === id);
    if (!item) throw new Error('asset_not_found');
    const licenseStatus = promptValue('授权状态：owned / licensed / pending', item.licenseStatus || 'pending');
    const reuseScope = promptValue('复用范围', item.reuseScope || 'internal_review');
    const record = store.saveEntity('content_assets', { ...item, licenseStatus, reuseScope });
    signalLocalChange(); renderAll(); return record;
  }

  function openBrainstorm(id) {
    const item = store.load().collections.brainstorms?.find((record) => record.id === id);
    if (!item) throw new Error('brainstorm_not_found');
    const choices = (item.nodes || []).map((node) => `${node.id}:${node.title}`).join(' / ');
    const nodeId = promptValue(`选择方向 ID：${choices}`, item.selectedNodeId || item.nodes?.[0]?.id || '');
    if (!nodeId) return item;
    const record = store.saveEntity('brainstorms', selectBrainstormDirection(item, nodeId));
    signalLocalChange(); renderAll(); return record;
  }

  function submitAgentRun(id) {
    const item = store.load().collections.agent_runs?.find((record) => record.id === id);
    if (!item) throw new Error('agent_run_not_found');
    const record = store.saveEntity('agent_runs', { ...item, status: 'awaiting_approval', submittedAt: now() });
    signalLocalChange(); renderAll(); return record;
  }

  function approveAgentRun(id) {
    const item = store.load().collections.agent_runs?.find((record) => record.id === id);
    if (!item) throw new Error('agent_run_not_found');
    if (!confirmAction('确认该 Agent 草稿已人工审核？这只确认草稿，不会自动发布、发消息或写 ERP。')) return item;
    const record = store.saveEntity('agent_runs', { ...item, status: 'completed', approval: { approved: true, approvedAt: now(), scope: 'draft_only' } });
    signalLocalChange(); renderAll(); return record;
  }

  async function syncNow() {
    const controller = operatingRuntime?.syncController || config.syncController;
    if (!controller?.sync) throw new Error('sync_not_connected');
    const result = await controller.sync('manual');
    renderAll();
    return result;
  }

  async function resolveSyncConflict(conflictId, choice, merged = null) {
    const controller = operatingRuntime?.syncController || config.syncController;
    if (!controller?.resolve) throw new Error('sync_not_connected');
    const result = await controller.resolve(conflictId, choice, merged);
    store.recordAudit?.('conflict_resolved', conflictId.split(':')[0], result);
    renderAll();
    return result;
  }

  async function testReminderDelivery() {
    if (!operatingRuntime?.pushClient?.test) throw new Error('reminder_not_connected');
    runtime.reminderTestState = 'testing';
    renderAll();
    try {
      const result = await operatingRuntime.pushClient.test();
      runtime.reminderTestState = result?.state === 'sent' ? 'sent' : 'failed';
      return result;
    } catch (error) {
      runtime.reminderTestState = 'failed';
      throw error;
    } finally {
      renderAll();
    }
  }

  function snoozeReminder(entityType, id, choice) {
    const type = ['tasks', 'calendar', 'countdowns'].includes(entityType) ? entityType : 'tasks';
    const existing = store.load().collections[type]?.find((item) => item.id === id);
    if (!existing) throw new Error('reminder_item_not_found');
    const result = store.saveEntity(type, {
      ...existing,
      reminderAt: reminderSnoozeAt(choice, { now: now(), timeZoneOffsetMinutes: 480 }),
    }, { action: 'snooze' });
    signalLocalChange();
    renderAll();
    return result;
  }

  function restoreReliabilityItem(entityType, id) {
    const restored = store.restoreEntity(entityType, id);
    signalLocalChange();
    renderAll();
    return restored;
  }

  function exportSafeBackup() {
    const backup = buildSafeBackup({ state: currentDurableState(), baseRevisions: store.loadBaseRevisions?.() || {}, createdAt: now() });
    if (typeof config.downloadBackup === 'function') {
      config.downloadBackup(backup);
      return backup;
    }
    const browserWindow = document?.defaultView || globalThis;
    if (document?.createElement && browserWindow?.Blob && browserWindow?.URL?.createObjectURL) {
      const blob = new browserWindow.Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = browserWindow.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ZOS-backup-${now().slice(0, 10)}.json`;
      anchor.click();
      browserWindow.URL.revokeObjectURL(url);
    }
    return backup;
  }

  function previewBackupText(text) {
    const parsed = parseBackupFile(text, { deviceId, now: now() });
    return { ...parsed, summary: summarizeBackup(parsed) };
  }

  async function importBackupText(text) {
    const parsed = previewBackupText(text);
    const currentBackup = buildSafeBackup({
      state: currentDurableState(), baseRevisions: store.loadBaseRevisions?.() || {}, createdAt: now(),
    });
    await snapshotRepository.save({ kind: 'pre-import', appVersion: APP_VERSION, backup: currentBackup });
    const merged = store.mergeSnapshot(parsed.state, { baseState: currentBackup.state });
    const projectionComplete = projectLegacyWorkspace(merged);
    runtime.lastRestoreAt = now();
    await refreshSnapshotCount();
    signalLocalChange();
    renderAll();
    return { state: merged, summary: parsed.summary, sourceVersion: parsed.sourceVersion, projectionComplete };
  }

  async function undoLastRestore() {
    const checkpoint = await snapshotRepository.latest('pre-import');
    if (!checkpoint?.backup?.state) throw new Error('restore_checkpoint_not_found');
    const restored = store.mergeSnapshot(checkpoint.backup.state, { baseState: currentDurableState() });
    projectLegacyWorkspace(restored);
    runtime.lastRestoreAt = now();
    signalLocalChange();
    renderAll();
    return restored;
  }

  function selectBackupFile() {
    if (!document?.createElement) throw new Error('file_picker_unavailable');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const preview = previewBackupText(text);
        const counts = Object.entries(preview.summary.collections).filter(([, count]) => count > 0)
          .map(([type, count]) => `${type} ${count} 条`).join('、');
        const confirmRestore = config.confirm || document?.defaultView?.confirm || globalThis.confirm;
        const approved = confirmRestore?.(`安全合并恢复\n\n来源版本：${preview.sourceVersion || '未知'}\n记录：${preview.summary.totalRecords} 条${counts ? `\n${counts}` : ''}\n\n保留当前数据，不自动删除。确认恢复吗？`);
        if (approved === false) return;
        const result = await importBackupText(text);
        runtime.syncStatus = result.projectionComplete
          ? '备份已安全合并，正在自动同步'
          : '主数据已恢复，兼容页面正在自动重试刷新';
      } catch (error) {
        runtime.syncStatus = `恢复未执行：${error?.message || '备份文件无效'}`;
      }
      renderAll();
    }, { once: true });
    input.click();
  }

  function bindActions() {
    if (actionsBound || !document?.addEventListener) return;
    actionsBound = true;
    (document?.defaultView || globalThis)?.addEventListener?.('zos:open-ai-command', openMobileAiSheet);
    document.addEventListener('toggle', (event) => {
      const details = event.target;
      if (details?.matches?.('details[data-intelligence-filters]')) {
        runtime.intelligenceFiltersDisclosureOpen = details.open === true;
        return;
      }
      if (details?.matches?.('details[data-agent-organization]')) {
        const organizationId = details.dataset.agentOrganization;
        if (details.open) {
          const departmentId = runtime.mobileAgentDirectoryDisclosure.departmentId;
          runtime.mobileAgentDirectoryDisclosure = {
            organizationId,
            departmentId: departmentId?.startsWith(`${organizationId}::`) ? departmentId : null,
          };
        } else if (runtime.mobileAgentDirectoryDisclosure.organizationId === organizationId) {
          runtime.mobileAgentDirectoryDisclosure = { organizationId: null, departmentId: null };
        }
        return;
      }
      if (!details?.matches?.('details[data-agent-department]')) return;
      const departmentId = details.dataset.agentDepartment;
      if (details.open) {
        const organizationId = details.closest?.('details[data-agent-organization]')?.dataset?.agentOrganization
          || runtime.mobileAgentDirectoryDisclosure.organizationId;
        runtime.mobileAgentDirectoryDisclosure = { organizationId, departmentId };
      } else if (runtime.mobileAgentDirectoryDisclosure.departmentId === departmentId) {
        runtime.mobileAgentDirectoryDisclosure = {
          ...runtime.mobileAgentDirectoryDisclosure,
          departmentId: null,
        };
      }
    }, true);
    document.addEventListener('click', async (event) => {
      const previewButton = event.target?.closest?.('[data-preview-decision]');
      const decisionAction = event.target?.closest?.('[data-decision-action]');
      const decisionSource = event.target?.closest?.('[data-decision-source]');
      const decisionConfirm = event.target?.closest?.('[data-decision-confirm]');
      const decisionClose = event.target?.closest?.('[data-decision-close]');
      const decisionUndo = event.target?.closest?.('[data-decision-undo]');
      const decisionLoadMore = event.target?.closest?.('[data-decision-load-more]');
      const decisionJump = event.target?.closest?.('[data-decision-jump]');
      const decisionSelectVisible = event.target?.closest?.('[data-decision-select-visible]');
      const decisionBatch = event.target?.closest?.('[data-decision-batch]');
      const decisionSelectionClear = event.target?.closest?.('[data-decision-selection-clear]');
      const executeButton = event.target?.closest?.('[data-execute-approval]');
      const refreshButton = event.target?.closest?.('[data-refresh-source]');
      const refreshAllButton = event.target?.closest?.('[data-refresh-all]');
      const captureButton = event.target?.closest?.('[data-quick-capture]');
      const continuityDraft = event.target?.closest?.('[data-continuity-draft]');
      const pageButton = event.target?.closest?.('[data-page]');
      const mobileMorePage = event.target?.closest?.('[data-mobile-more-item][data-page]');
      const intelligenceButton = event.target?.closest?.('[data-intelligence-status]');
      const intelligenceAsk = event.target?.closest?.('[data-intelligence-ask]');
      const intelligenceOpen = event.target?.closest?.('[data-intelligence-open]');
      const intelligenceQuestionClose = event.target?.closest?.('[data-intelligence-question-close]');
      const intelligenceRefresh = event.target?.closest?.('[data-refresh-intelligence]');
      const intelligenceReset = event.target?.closest?.('[data-intelligence-reset]');
      const weatherLocation = event.target?.closest?.('[data-weather-location]');
      const lifeCapture = event.target?.closest?.('[data-life-capture]');
      const ritualConvert = event.target?.closest?.('[data-ritual-convert]');
      const ritualIgnore = event.target?.closest?.('[data-ritual-ignore]');
      const privateDateImport = event.target?.closest?.('[data-private-date-import]');
      const companySpecialist = event.target?.closest?.('[data-company-specialist]');
      const calendarCapture = event.target?.closest?.('[data-calendar-capture]');
      const calendarKind = event.target?.closest?.('[data-calendar-kind]');
      const calendarView = event.target?.closest?.('[data-calendar-view]');
      const intelligenceCompany = event.target?.closest?.('[data-intelligence-company]');
      const reviewDraft = event.target?.closest?.('[data-review-draft]');
      const agentDraft = event.target?.closest?.('[data-agent-draft]');
      const taskCapture = event.target?.closest?.('[data-task-capture], [data-mobile-add]');
      const taskEdit = event.target?.closest?.('[data-task-edit]');
      const taskClose = event.target?.closest?.('[data-task-close]');
      const taskToggle = event.target?.closest?.('[data-task-toggle]');
      const taskDelete = event.target?.closest?.('[data-task-delete]');
      const taskQuickFilter = event.target?.closest?.('[data-task-quick-filter], [data-task-full-filter]');
      const focusAction = event.target?.closest?.('[data-focus-action]');
      const focusDuration = event.target?.closest?.('[data-focus-duration]');
      const countdownCapture = event.target?.closest?.('[data-countdown-capture]');
      const importantDatesOpen = event.target?.closest?.('[data-important-dates-open]');
      const importantDatesClose = event.target?.closest?.('[data-important-dates-close]');
      const enableReminders = event.target?.closest?.('[data-enable-reminders]');
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
      const calendarTaskToggle = event.target?.closest?.('[data-calendar-task-toggle]');
      const calendarTaskEdit = event.target?.closest?.('[data-calendar-task-edit]');
      const calendarTaskCopy = event.target?.closest?.('[data-calendar-task-copy]');
      const calendarTaskReschedule = event.target?.closest?.('[data-calendar-task-reschedule]');
      const calendarTaskDelete = event.target?.closest?.('[data-calendar-task-delete]');
      const calendarConfirmDelete = event.target?.closest?.('[data-calendar-confirm-delete]');
      const calendarUndoDelete = event.target?.closest?.('[data-calendar-undo-delete]');
      const calendarFilter = event.target?.closest?.('[data-calendar-filter]');
      const calendarDaySheetClose = event.target?.closest?.('[data-calendar-day-sheet-close]');
      const calendarDayCreate = event.target?.closest?.('[data-calendar-day-create]');
      const merchantSelect = event.target?.closest?.('[data-merchant-select]');
      const wanjiaPane = event.target?.closest?.('[data-wanjia-pane]');
      const wanjiaKpiFilter = event.target?.closest?.('[data-wanjia-kpi-filter]');
      const wanjiaFilterReset = event.target?.closest?.('[data-wanjia-filter-reset]');
      const wanjiaHistoryReset = event.target?.closest?.('[data-wanjia-history-reset]');
      const wanjiaDiagnose = event.target?.closest?.('[data-wanjia-diagnose]');
      const wanjiaTaskDraft = event.target?.closest?.('[data-wanjia-task-draft]');
      const wanjiaOpportunityDraft = event.target?.closest?.('[data-wanjia-opportunity-draft]');
      const syncNowButton = event.target?.closest?.('[data-sync-now]');
      const syncResolution = event.target?.closest?.('[data-sync-resolution]');
      const reminderTest = event.target?.closest?.('[data-reminder-test]');
      const reminderSnooze = event.target?.closest?.('[data-reminder-snooze]');
      const reliabilityRestore = event.target?.closest?.('[data-reliability-restore]');
      const exportBackup = event.target?.closest?.('[data-export-backup]');
      const importBackup = event.target?.closest?.('[data-import-backup]');
      const undoBackup = event.target?.closest?.('[data-undo-backup]');
      const contentCapture = event.target?.closest?.('[data-content-capture]');
      const contentCompany = event.target?.closest?.('[data-content-company]');
      const contentOwner = event.target?.closest?.('[data-content-owner]');
      const contentEdit = event.target?.closest?.('[data-content-edit]');
      const contentTransition = event.target?.closest?.('[data-content-transition]');
      const contentDelete = event.target?.closest?.('[data-content-delete]');
      const contentMetricsButton = event.target?.closest?.('[data-content-metrics]');
      const contentCompound = event.target?.closest?.('[data-content-compound]');
      const compoundReview = event.target?.closest?.('[data-compound-review]');
      const compoundDelete = event.target?.closest?.('[data-compound-delete]');
      const experimentCapture = event.target?.closest?.('[data-experiment-capture]');
      const experimentResults = event.target?.closest?.('[data-experiment-results]');
      const experimentDelete = event.target?.closest?.('[data-experiment-delete]');
      const readingCapture = event.target?.closest?.('[data-reading-capture]');
      const readingProgressButton = event.target?.closest?.('[data-reading-progress]');
      const readingToCard = event.target?.closest?.('[data-reading-to-card]');
      const readingDelete = event.target?.closest?.('[data-reading-delete]');
      const knowledgeReview = event.target?.closest?.('[data-knowledge-review]');
      const knowledgeEdit = event.target?.closest?.('[data-knowledge-edit]');
      const knowledgeDelete = event.target?.closest?.('[data-knowledge-delete]');
      const brainstormCapture = event.target?.closest?.('[data-brainstorm-capture]');
      const brainstormOpen = event.target?.closest?.('[data-brainstorm-open]');
      const brainstormDelete = event.target?.closest?.('[data-brainstorm-delete]');
      const assetCapture = event.target?.closest?.('[data-asset-capture]');
      const assetEditButton = event.target?.closest?.('[data-asset-edit]');
      const assetDelete = event.target?.closest?.('[data-asset-delete]');
      const socialCapture = event.target?.closest?.('[data-social-capture]');
      const socialEdit = event.target?.closest?.('[data-social-edit]');
      const socialToContent = event.target?.closest?.('[data-social-to-content]');
      const socialDelete = event.target?.closest?.('[data-social-delete]');
      const agentRun = event.target?.closest?.('[data-agent-run]');
      const agentSubmit = event.target?.closest?.('[data-agent-submit]');
      const agentApprove = event.target?.closest?.('[data-agent-approve]');
      const agentRunDelete = event.target?.closest?.('[data-agent-run-delete]');
      const agentIndexImport = event.target?.closest?.('[data-agent-index-import]');
      const knowledgeContextImport = event.target?.closest?.('[data-knowledge-context-import]');
      const agentOsFilter = event.target?.closest?.('[data-agent-os-filter]');
      const agentDetailsButton = event.target?.closest?.('[data-agent-details]');
      const agentDetailsClose = event.target?.closest?.('[data-agent-details-close]');
      const agentInvoke = event.target?.closest?.('[data-agent-invoke]');
      const agentAnalyze = event.target?.closest?.('[data-agent-analyze]');
      const agentTaskAnalyze = event.target?.closest?.('[data-agent-task-analyze]');
      const agentContextConfirm = event.target?.closest?.('[data-agent-context-confirm]');
      const agentContextReject = event.target?.closest?.('[data-agent-context-reject]');
      const aiCommandAction = event.target?.closest?.('[data-ai-command-action]');
      const aiCommandUndo = event.target?.closest?.('[data-ai-command-undo]');
      const aiCommandScope = event.target?.closest?.('[data-ai-command-scope]');
      const aiVoiceToggle = event.target?.closest?.('[data-ai-voice-toggle]');
      const aiSpeechStop = event.target?.closest?.('[data-ai-speech-stop]');
      const realtimeStart = event.target?.closest?.('[data-ai-realtime-start]');
      const realtimeStop = event.target?.closest?.('[data-ai-realtime-stop]');
      const realtimeInterrupt = event.target?.closest?.('[data-ai-realtime-interrupt]');
      const realtimeMute = event.target?.closest?.('[data-ai-realtime-mute]');
      const realtimeCaptions = event.target?.closest?.('[data-ai-realtime-captions]');
      const mobileAiClose = event.target?.closest?.('[data-mobile-ai-close]');
      try {
        if (mobileAiClose) closeMobileAiSheet();
        else if (realtimeStart) await startRealtimeVoice();
        else if (realtimeStop) stopRealtimeVoice();
        else if (realtimeInterrupt) interruptRealtimeVoice();
        else if (realtimeMute) toggleRealtimeVoiceMute();
        else if (realtimeCaptions) toggleRealtimeVoiceCaptions();
        else if (aiSpeechStop) stopAiSpeech();
        else if (aiCommandAction) await executeAiCommandAction(aiCommandAction.dataset.aiCommandAction);
        else if (aiCommandUndo) undoAiCommandAction();
        else if (aiCommandScope) setAiCommandScope(aiCommandScope.dataset.aiCommandScope);
        else if (aiVoiceToggle) {
          if (aiVoiceIgnoreClick) aiVoiceIgnoreClick = false;
          else toggleAiVoice();
        }
        else if (knowledgeContextImport) selectKnowledgeContextFile();
        else if (agentIndexImport) selectAgentOsIndexFile();
        else if (agentOsFilter) setAgentOsFilter(agentOsFilter.dataset.agentOsFilter);
        else if (agentDetailsButton) openAgentDetails(agentDetailsButton.dataset.agentDetails);
        else if (agentDetailsClose) closeAgentDetails();
        else if (agentAnalyze) await analyzeAgent(agentAnalyze.dataset.agentAnalyze);
        else if (agentTaskAnalyze) await analyzeAgentTask(agentTaskAnalyze.dataset.agentTaskAnalyze);
        else if (agentContextConfirm) confirmAgentContext(agentContextConfirm.dataset.agentContextConfirm);
        else if (agentContextReject) rejectAgentContext(agentContextReject.dataset.agentContextReject);
        else if (agentInvoke) invokeAgent(agentInvoke.dataset.agentInvoke);
        else if (contentCapture) captureContentItem();
        else if (contentCompany) { runtime.contentCompany = contentCompany.dataset.contentCompany || 'all'; renderAll(); }
        else if (contentOwner) { runtime.contentOwner = contentOwner.dataset.contentOwner || 'all'; renderAll(); }
        else if (contentEdit) editContentItem(contentEdit.dataset.contentEdit);
        else if (contentTransition) advanceContentItem(contentTransition.dataset.contentTransition, contentTransition.dataset.contentNextStage);
        else if (contentDelete) deletePrivateEntity('content_items', contentDelete.dataset.contentDelete, '确认删除这条内容记录？删除会同步到其他设备，并可从回收记录恢复。');
        else if (contentMetricsButton) updateContentMetrics(contentMetricsButton.dataset.contentMetrics);
        else if (contentCompound) compoundContentItem(contentCompound.dataset.contentCompound);
        else if (compoundReview) reviewCompoundCandidate(compoundReview.dataset.compoundReview);
        else if (compoundDelete) deletePrivateEntity('compound_candidates', compoundDelete.dataset.compoundDelete, '确认删除这条复利候选？');
        else if (experimentCapture) captureContentExperiment();
        else if (experimentResults) updateContentExperiment(experimentResults.dataset.experimentResults);
        else if (experimentDelete) deletePrivateEntity('content_experiments', experimentDelete.dataset.experimentDelete, '确认删除这条内容实验？');
        else if (readingCapture) captureReadingItem();
        else if (readingProgressButton) updateReadingProgress(readingProgressButton.dataset.readingProgress);
        else if (readingToCard) readingToKnowledgeCard(readingToCard.dataset.readingToCard);
        else if (readingDelete) deletePrivateEntity('reading_items', readingDelete.dataset.readingDelete, '确认删除这条阅读记录？');
        else if (knowledgeEdit) editKnowledgeCard(knowledgeEdit.dataset.knowledgeEdit);
        else if (knowledgeReview) reviewKnowledgeCard(knowledgeReview.dataset.knowledgeReview);
        else if (knowledgeDelete) deletePrivateEntity('knowledge_cards', knowledgeDelete.dataset.knowledgeDelete, '确认删除这张知识卡片？');
        else if (brainstormCapture) captureBrainstorm();
        else if (brainstormOpen) openBrainstorm(brainstormOpen.dataset.brainstormOpen);
        else if (brainstormDelete) deletePrivateEntity('brainstorms', brainstormDelete.dataset.brainstormDelete, '确认删除这次头脑风暴？');
        else if (assetCapture) captureAsset();
        else if (assetEditButton) editAsset(assetEditButton.dataset.assetEdit);
        else if (assetDelete) deletePrivateEntity('content_assets', assetDelete.dataset.assetDelete, '确认删除这条素材资产？');
        else if (socialCapture) captureSocialInsight();
        else if (socialEdit) editSocialInsight(socialEdit.dataset.socialEdit);
        else if (socialToContent) socialInsightToContent(socialToContent.dataset.socialToContent);
        else if (socialDelete) deletePrivateEntity('social_insights', socialDelete.dataset.socialDelete, '确认删除这条社媒洞察？');
        else if (agentRun) launchAgentRun(agentRun.dataset.agentRun);
        else if (agentSubmit) submitAgentRun(agentSubmit.dataset.agentSubmit);
        else if (agentApprove) approveAgentRun(agentApprove.dataset.agentApprove);
        else if (agentRunDelete) deletePrivateEntity('agent_runs', agentRunDelete.dataset.agentRunDelete, '确认删除这条 Agent 执行记录？');
        else if (syncNowButton) await syncNow();
        else if (syncResolution) await resolveSyncConflict(syncResolution.dataset.syncConflict, syncResolution.dataset.syncResolution);
        else if (reminderTest) await testReminderDelivery();
        else if (reminderSnooze) snoozeReminder(reminderSnooze.dataset.reminderEntity, reminderSnooze.dataset.reminderId, reminderSnooze.dataset.reminderSnooze);
        else if (reliabilityRestore) restoreReliabilityItem(reliabilityRestore.dataset.reliabilityEntity, reliabilityRestore.dataset.reliabilityRestore);
        else if (exportBackup) exportSafeBackup();
        else if (importBackup) selectBackupFile();
        else if (undoBackup) {
          await undoLastRestore();
          runtime.syncStatus = runtime.protectionState === '本机数据已保护'
            ? '已恢复导入前版本，并保留后来新增内容'
            : '主数据已恢复，兼容页面正在自动重试刷新';
          renderAll();
        }
        else if (decisionAction) openDecisionAction(decisionAction.dataset.decisionId, decisionAction.dataset.decisionAction);
        else if (decisionSource) openDecisionAction(decisionSource.dataset.decisionSource, 'source');
        else if (decisionConfirm) await confirmDecisionAction(document?.querySelector?.('[data-decision-note]')?.value || '');
        else if (decisionClose) closeDecisionAction();
        else if (decisionUndo) await undoDecisionAction();
        else if (decisionBatch) await executeDecisionBatch(decisionBatch.dataset.decisionBatch);
        else if (decisionSelectVisible) setDecisionSelection(String(decisionSelectVisible.dataset.decisionVisibleIds || '').split(',').filter(Boolean));
        else if (decisionSelectionClear) setDecisionSelection([]);
        else if (decisionLoadMore) loadMoreDecisions(decisionLoadMore.dataset.decisionLoadMore);
        else if (decisionJump) document?.getElementById?.(`decision-${decisionJump.dataset.decisionJump}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        else if (previewButton) { closeDecisionAction(); await previewDecision(previewButton.dataset.previewDecision); }
        else if (executeButton) await executeApproval(executeButton.dataset.executeApproval);
        else if (refreshAllButton) await autoRefreshController?.refresh('manual');
        else if (refreshButton) await refreshSource(refreshButton.dataset.refreshSource);
        else if (continuityDraft) {
          runtime.taskDraft = {
            title: String(continuityDraft.dataset.continuityTitle || '确认下一步').trim(),
            description: '由 AI 推进提醒生成的任务草案；保存前请核对负责人、日期与优先级。',
            company: 'ceo', priority: 1, tags: ['AI 推进提醒', '草案'],
          };
          runtime.taskDrawerOpen = true;
          showTaskCenter();
          renderAll();
        }
        else if (captureButton) quickCapture((config.prompt || globalThis.prompt)?.('记录一条想法或任务'));
        else if (intelligenceAsk) openIntelligenceQuestion(intelligenceAsk.dataset.intelligenceAsk);
        else if (intelligenceQuestionClose) closeIntelligenceQuestion();
        else if (intelligenceButton) {
          updateIntelligenceStatus(intelligenceButton.dataset.intelligenceId, intelligenceButton.dataset.intelligenceStatus);
        } else if (intelligenceOpen) {
          openIntelligenceQuestion(intelligenceOpen.dataset.intelligenceOpen);
        } else if (intelligenceRefresh) {
          await refreshIntelligence();
        } else if (intelligenceCompany) {
          setIntelligenceFilter('company', intelligenceCompany.dataset.intelligenceCompany || 'all');
        } else if (intelligenceReset) {
          resetIntelligenceFilters();
        } else if (weatherLocation) {
          await useCurrentWeatherLocation();
        } else if (calendarKind) {
          setCalendarDraftKind(calendarKind.dataset.calendarKind);
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
        } else if (calendarDaySheetClose) {
          closeCalendarDaySheet();
        } else if (calendarDayCreate) {
          runtime.calendarDaySheetOpen = false;
          runtime.calendarSelectedDate = null;
          runtime.calendarSelection = normalizeCalendarSelection(calendarDayCreate.dataset.calendarDayCreate, calendarDayCreate.dataset.calendarDayCreate);
          commitCalendarSelection();
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
          restoreCalendarEntity(calendarRestore.dataset.calendarRestoreEntity || 'calendar', calendarRestore.dataset.calendarRestore);
        } else if (calendarTaskToggle) {
          toggleTask(calendarTaskToggle.dataset.calendarTaskToggle);
          closeCalendarPanel();
        } else if (calendarTaskEdit) {
          openCalendarEditor(calendarTaskEdit.dataset.calendarTaskEdit);
        } else if (calendarTaskCopy) {
          copyTask(calendarTaskCopy.dataset.calendarTaskCopy);
          closeCalendarPanel();
        } else if (calendarTaskReschedule) {
          openCalendarEditor(calendarTaskReschedule.dataset.calendarTaskReschedule);
        } else if (calendarTaskDelete) {
          requestCalendarDeletion(calendarTaskDelete.dataset.calendarTaskDelete);
        } else if (calendarConfirmDelete) {
          confirmCalendarDeletion();
        } else if (calendarUndoDelete) {
          undoCalendarDelete();
        } else if (calendarFilter) {
          setCalendarFilter(calendarFilter.dataset.calendarFilter);
        } else if (calendarClose) {
          closeCalendarPanel();
        } else if (calendarReschedule) {
          requestCalendarMutation(calendarReschedule.dataset.calendarReschedule, 'edit');
        } else if (calendarSeriesScope) {
          applyCalendarSeriesScope(calendarSeriesScope.dataset.calendarSeriesScope);
        } else if (calendarLayer) {
          if (calendarLayer.dataset.calendarLayer === 'focus') runtime.showFocus = !runtime.showFocus;
          renderAll();
        } else if (importantDatesOpen) {
          runtime.importantDatesPanel = importantDatesOpen.dataset.importantDatesOpen;
          renderAll();
        } else if (importantDatesClose) {
          runtime.importantDatesPanel = null;
          renderAll();
        } else if (enableReminders) {
          await enableClosedAppReminders();
        } else if (countdownCapture) {
          const ask = config.prompt || globalThis.prompt;
          const title = ask?.('倒数日名称');
          const date = title && ask?.('日期（YYYY-MM-DD）', now().slice(0, 10));
          if (title && date) saveCountdown({
            title, date,
            company: runtime.importantDatesPanel === 'life' ? 'life' : 'ceo',
            privacy: runtime.importantDatesPanel === 'work' ? 'work' : 'private',
          });
        } else if (calendarCapture) {
          runtime.calendarSelection = normalizeCalendarSelection(runtime.calendarAnchor, runtime.calendarAnchor);
          commitCalendarSelection();
        } else if (lifeCapture) {
          const title = (config.prompt || globalThis.prompt)?.('记录一条生活事项');
          if (String(title || '').trim()) {
            store.saveEntity('life', { title: String(title).trim(), area: 'review', status: 'open', privacy: 'private' });
            signalLocalChange(); renderAll();
          }
        } else if (ritualConvert) {
          convertRitualToLifeTask(ritualConvert.dataset.ritualConvert);
        } else if (ritualIgnore) {
          ignoreRitual(ritualIgnore.dataset.ritualIgnore);
        } else if (privateDateImport) {
          selectPrivateDateFile();
        } else if (companySpecialist) {
          document?.getElementById?.(companySpecialist.dataset.companySpecialist)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        } else if (taskCapture) {
          showTaskCenter();
          openTaskEditor();
        }
        else if (taskEdit) openTaskEditor([...viewModel().tasks, ...viewModel().localAgentTasks].find((item) => item.id === taskEdit.dataset.taskEdit));
        else if (taskClose) closeTaskEditor();
        else if (taskDelete) {
          const confirmDelete = config.confirm || globalThis.confirm;
          if (typeof confirmDelete !== 'function' || confirmDelete('删除后会同步到其他设备，可在日历回收站恢复。确认删除？')) {
            deleteTask(taskDelete.dataset.taskDelete);
            closeTaskEditor();
          }
        }
        else if (taskToggle) toggleTask(taskToggle.dataset.taskToggle);
        else if (taskQuickFilter) setTaskQuickFilter(taskQuickFilter.dataset.taskQuickFilter || taskQuickFilter.dataset.taskFullFilter);
        else if (focusDuration) {
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
        } else if (wanjiaPane) setWanjiaOpsPane(wanjiaPane.dataset.wanjiaPane);
        else if (wanjiaKpiFilter) focusWanjiaKpi(wanjiaKpiFilter.dataset.wanjiaKpiFilter);
        else if (wanjiaFilterReset) resetWanjiaFilters();
        else if (wanjiaHistoryReset) resetWanjiaHistoryFilters();
        else if (wanjiaDiagnose) diagnoseWanjiaMerchant(wanjiaDiagnose.dataset.wanjiaDiagnose);
        else if (wanjiaTaskDraft) openWanjiaTaskDraft(wanjiaTaskDraft.dataset.wanjiaTaskDraft);
        else if (wanjiaOpportunityDraft) {
          const opportunity = viewModel().wanjiaOps.opportunities.find((item) => item.id === wanjiaOpportunityDraft.dataset.wanjiaOpportunityDraft);
          if (opportunity) openWanjiaTaskDraft(opportunity.merchantId, opportunity.id);
        }
        else if (merchantSelect) queryMerchant(runtime.merchantQuery, { id: merchantSelect.dataset.merchantSelect });
        else if (reviewDraft) generateReview(reviewDraft.dataset.reviewDraft);
        else if (agentDraft) await generateAgentDraft(agentDraft.dataset.agentDraft || 'ceo');
        else if (mobileMorePage && globalThis.window?.navigateTo) {
          globalThis.window.navigateTo(mobileMorePage.dataset.page, { focusPage: true });
        } else if (pageButton && globalThis.window?.navigateTo) {
          globalThis.window.navigateTo(pageButton.dataset.page);
        }
      } catch { runtime.syncStatus = '操作未完成，请检查登录与数据权限'; renderAll(); }
    });
    document.addEventListener('submit', async (event) => {
      if (event.target?.matches?.('[data-ai-command-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        try { await submitAiCommand(data.get('task') ?? data.get('command'), { scope: runtime.aiCommand.scope }); }
        catch { /* submitAiCommand already preserves the input and safe error. */ }
        return;
      }
      if (event.target?.matches?.('[data-intelligence-question-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        try {
          await askIntelligenceQuestion(runtime.intelligenceQuestion?.externalId, data.get('question'));
        } catch {
          runtime.intelligenceAnswer = {
            state: 'insufficient', directAnswer: '请先输入你想弄懂的概念或问题。',
            knownFacts: [], relatedEvidence: [], sources: [], uncertainty: '没有问题就无法检索现有证据。', nextStep: '输入问题后再试一次。',
          };
          renderAll();
        }
        return;
      }
      if (event.target?.matches?.('[data-agent-analysis-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        try { await analyzeAgent(event.target.dataset.agentAnalysisForm, data.get('question')); }
        catch { runtime.agentAnalysis = { state: 'error', answer: '请输入任务后重试。' }; renderAll(); }
        return;
      }
      if (event.target?.matches?.('[data-sync-merge-form]')) {
        event.preventDefault();
        const conflictId = event.target.dataset.syncMergeForm;
        const conflict = viewModel().syncConflicts.find((item) => item.id === conflictId);
        if (!conflict) return;
        const merged = {};
        for (const [key, choice] of new FormData(event.target).entries()) {
          if (!String(key).startsWith('field:')) continue;
          const field = String(key).slice(6);
          merged[field] = choice === 'remote' ? conflict.remote?.[field] : conflict.local?.[field];
        }
        resolveSyncConflict(conflictId, 'merge', merged).catch(() => {
          runtime.syncStatus = '冲突合并未完成，请重新选择'; renderAll();
        });
        return;
      }
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
          agentContext: runtime.taskDraft?.agentContext || null,
        });
        return;
      }
      if (event.target?.matches?.('[data-calendar-form]')) {
        event.preventDefault();
        const data = new FormData(event.target);
        const scheduleKind = data.get('scheduleKind') || 'calendar';
        if (scheduleKind === 'task') {
          const subtasks = String(data.get('subtasks') || '').split(/\r?\n/)
            .map((title) => title.trim()).filter(Boolean)
            .map((title, index) => ({ id: `subtask-${index + 1}`, title, completed: false }));
          try {
            saveCalendarArrangement({
              scheduleKind, id: data.get('id') || undefined,
              title: data.get('title'), description: data.get('description'),
              startAt: data.get('startAt') || null, dueAt: data.get('dueAt') || null,
              allDay: data.get('allDay') === 'on', priority: Number(data.get('priority')),
              company: data.get('company'), projectId: data.get('projectId') || null,
              assigneeIds: String(data.get('assigneeIds') || '').split(/[、,，]/),
              reminderAt: data.get('reminderAt') || null,
              recurrence: data.get('recurrence') || null, subtasks,
              occupyCalendar: data.get('occupyCalendar') === 'on',
            });
          } catch {
            runtime.calendarFormError = '任务未保存，请检查标题与日期';
            renderAll();
          }
          return;
        }
        const startAt = data.get('startAt');
        const frequency = data.get('recurrenceFrequency');
        const startDate = new Date(startAt);
        const recurrenceRule = frequency && frequency !== 'none' ? {
          frequency,
          interval: Math.max(1, Number(data.get('recurrenceInterval')) || 1),
          ...(frequency === 'weekly' ? { byWeekdays: [startDate.getDay() || 7] } : {}),
        } : null;
        try {
          saveCalendarArrangement({
            scheduleKind,
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
      if (event.target?.matches?.('[data-wanjia-filter-form]')) {
        event.preventDefault();
        setWanjiaFilters(Object.fromEntries(new FormData(event.target).entries()));
        return;
      }
      if (event.target?.matches?.('[data-wanjia-history-form]')) {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.target).entries());
        applyWanjiaHistoryQuery({
          range: { preset: values.preset, startDate: values.startDate, endDate: values.endDate },
          filters: { merchantId: values.merchantId, industry: values.industry, owner: values.owner, cooperationType: values.cooperationType, abnormal: values.abnormal },
        });
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
      if (event.target?.matches?.('[data-decision-select]')) {
        toggleDecisionSelection(event.target.dataset.decisionSelect, event.target.checked);
        return;
      }
      if (event.target?.matches?.('[data-decision-filter]')) {
        setDecisionFilter(event.target.dataset.decisionFilter, event.target.value);
        return;
      }
      if (event.target?.matches?.('[data-intelligence-filter]')) {
        setIntelligenceFilter(event.target.dataset.intelligenceFilter, event.target.value);
        return;
      }
      if (event.target?.matches?.('[data-intelligence-sort]')) {
        setIntelligenceFilter('sortBy', event.target.value);
        return;
      }
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
    document.addEventListener('input', (event) => {
      if (event.target?.matches?.('[data-ai-command-input]')) setAiCommandInput(event.target.value, { render: false });
    });
    document.addEventListener('keydown', (event) => {
      if (runtime.mobileAiSheetOpen && event.key === 'Escape') {
        event.preventDefault?.();
        closeMobileAiSheet();
      }
    });
    document.addEventListener('focusin', (event) => {
      if (!runtime.mobileAiSheetOpen) return;
      const sheet = document?.querySelector?.('[data-mobile-ai-command-sheet]');
      if (sheet && !sheet.contains?.(event.target)) focusMobileAiSheetInput();
    });
    document.addEventListener('pointerdown', (event) => {
      const voiceButton = event.target?.closest?.('[data-ai-voice-toggle]');
      if (!voiceButton) return;
      if (event.button != null && event.button !== 0) return;
      const clock = document?.defaultView || globalThis;
      cancelAiVoiceHold({ abort: true });
      aiVoiceIgnoreClick = false;
      aiVoiceHoldPointer = {
        pointerId: event.pointerId,
        target: voiceButton,
        startY: Number.isFinite(event.clientY) ? event.clientY : null,
      };
      aiVoiceHoldTimer = clock.setTimeout?.(() => {
        if (!aiVoiceHoldPointer) return;
        aiVoiceHoldTimer = null;
        aiVoiceHoldActive = startAiVoice({ deferCommit: true }) === true;
      }, 240);
    });
    document.addEventListener('pointermove', (event) => {
      if (!voiceHoldMatches(event)) return;
      const startY = aiVoiceHoldPointer?.startY;
      if (!Number.isFinite(startY) || !Number.isFinite(event.clientY)) return;
      if (startY - event.clientY < aiVoiceCancelDistance) return;
      cancelAiVoiceHold({ abort: true, persistClickSuppression: true });
    });
    const releaseAiVoice = (event) => {
      if (!voiceHoldMatches(event)) return;
      cancelAiVoiceHold({ abort: event.type === 'pointercancel' });
    };
    document.addEventListener('pointerup', releaseAiVoice);
    document.addEventListener('pointercancel', releaseAiVoice);
    document.addEventListener('pointerleave', (event) => {
      if (!voiceHoldMatches(event) || event.target !== aiVoiceHoldPointer?.target || aiVoiceHoldActive) return;
      cancelAiVoiceHold({ abort: true });
    }, true);
    document.addEventListener('input', (event) => {
      if (event.target?.matches?.('[data-decision-search]')) setDecisionFilter('search', event.target.value);
      if (event.target?.matches?.('[data-intelligence-search]')) setIntelligenceFilter('search', event.target.value);
    });
    document.addEventListener('pointerdown', (event) => {
      const taskEvent = event.target?.closest?.('[data-calendar-event][data-source="local_task"]');
      if (!taskEvent || event.pointerType !== 'touch') return;
      clearCalendarEventLongPress();
      const pending = { id: taskEvent.dataset.calendarEvent, pointerId: event.pointerId, timer: null };
      pending.timer = (document?.defaultView || globalThis).setTimeout?.(() => {
        if (runtime.calendarEventLongPress !== pending) return;
        runtime.calendarEventLongPress = null;
        selectCalendar(pending.id);
      }, 450);
      runtime.calendarEventLongPress = pending;
    });
    document.addEventListener('pointerdown', (event) => {
      const target = event.target?.closest?.('[data-calendar-select-date]');
      if (!target || event.target?.closest?.('[data-calendar-event], button, input, select, textarea, a')) return;
      if (event.button != null && event.button !== 0) return;
      const pointerType = event.pointerType || 'mouse';
      if (pointerType === 'touch') {
        clearCalendarTouchPending();
        runtime.calendarTouchPending = {
          date: target.dataset.calendarSelectDate,
          pointerId: event.pointerId,
          timer: null,
          mobileDaySheet: true,
        };
        return;
      }
      if (shouldBeginCalendarSelection({ pointerType, elapsedMs: 0 })) {
        event.preventDefault?.();
        beginCalendarSelection(target.dataset.calendarSelectDate);
        return;
      }
    });
    document.addEventListener('pointermove', (event) => {
      if (!runtime.calendarSelecting) return;
      const target = event.target?.closest?.('[data-calendar-select-date]');
      if (target) extendCalendarSelection(target.dataset.calendarSelectDate);
    });
    document.addEventListener('pointerup', (event) => {
      if (runtime.calendarEventLongPress && (event.pointerId == null || runtime.calendarEventLongPress.pointerId === event.pointerId)) clearCalendarEventLongPress();
      const pending = runtime.calendarTouchPending;
      if (pending && (event.pointerId == null || pending.pointerId === event.pointerId)) {
        clearCalendarTouchPending();
        if (pending.mobileDaySheet) {
          openCalendarDaySheet(pending.date);
          return;
        }
        beginCalendarSelection(pending.date);
      }
      if (runtime.calendarSelecting) commitCalendarSelection();
    });
    document.addEventListener('pointercancel', () => {
      clearCalendarEventLongPress();
      clearCalendarTouchPending();
      runtime.calendarSelecting = false;
      runtime.calendarSelection = null;
      paintCalendarSelection();
    });
    document.addEventListener('keydown', (event) => {
      const target = event.target?.closest?.('[data-calendar-select-date]');
      const intelligenceCard = event.target?.closest?.('[data-intelligence-open]');
      if (event.key === 'Tab' && runtime.decisionUi.action) {
        const focusable = [...(document?.querySelectorAll?.('.decision-action-drawer button:not([disabled]), .decision-action-drawer a[href], .decision-action-drawer textarea:not([disabled]), .decision-action-drawer input:not([disabled]), .decision-action-drawer select:not([disabled])') || [])];
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault?.(); last.focus?.(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault?.(); first.focus?.(); }
        }
      } else if (intelligenceCard && ['Enter', ' '].includes(event.key)) {
        event.preventDefault?.();
        openIntelligenceQuestion(intelligenceCard.dataset.intelligenceOpen);
      } else if (target && ['Enter', ' '].includes(event.key)) {
        event.preventDefault?.();
        openCalendarDaySheet(target.dataset.calendarSelectDate);
      } else if (event.key === 'Escape' && runtime.decisionUi.action) {
        closeDecisionAction();
      } else if (event.key === 'Escape' && (runtime.calendarSelecting || runtime.calendarPanel || runtime.calendarDaySheetOpen)) {
        closeCalendarPanel();
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
      const model = viewModel();
      const visible = model.calendar.find((record) => record.id === id);
      const capabilities = calendarEventCapabilities(visible || {});
      const existing = capabilities.kind === 'task'
        ? store.load().collections.tasks.find((record) => record.id === id)
        : store.load().collections.calendar.find((record) => record.id === id);
      if (!existing) return;
      const start = new Date(existing.startAt);
      const [year, month, day] = target.dataset.calendarDropDate.split('-').map(Number);
      start.setFullYear(year, month - 1, day);
      try {
        if (capabilities.kind === 'task') moveTask(id, { startAt: start.toISOString() });
        else moveCalendar(id, { startAt: start.toISOString() });
      } catch { /* External and recurring rows are not draggable. */ }
    });
  }

  function renderMobileMoreGroups() {
    const host = document?.querySelector?.('[data-mobile-more-groups]');
    if (!host) return;
    const currentPage = String(document?.querySelector?.('.page.active')?.id || '').replace(/^page-/, '');
    const groups = buildMobileMoreGroups({
      recentPages: currentPage ? [currentPage] : [],
      pinnedPages: ['tasks', 'intelligence'],
    });
    for (const group of groups) {
      const groupNode = host.querySelector?.(`[data-mobile-more-group="${group.id}"]`);
      if (!groupNode) continue;
      const headingId = `mobileMore${group.id.replace(/(^|-)\w/g, (value) => value.replace('-', '').toUpperCase())}`;
      groupNode.setAttribute?.('aria-labelledby', headingId);
      groupNode.innerHTML = `<h2 class="mobile-more-group-title" id="${headingId}">${group.label}</h2><div class="mobile-more-grid">${group.items.map((item) => `<button type="button" class="mobile-more-item" data-mobile-more-item data-page="${item.pageId}"${item.preferred ? ' data-preferred="true"' : ''}>${item.label}</button>`).join('')}</div>`;
    }
  }

  function applyLocalBusyAttributes() {
    const setBusy = (selector, busy) => {
      for (const button of document?.querySelectorAll?.(selector) || []) {
        button.toggleAttribute?.('aria-busy', busy);
        button.disabled = busy;
      }
    };
    const setBusyByData = (selector, dataKey, activeIds) => {
      for (const button of document?.querySelectorAll?.(selector) || []) {
        const busy = activeIds.includes(button.dataset?.[dataKey]);
        button.toggleAttribute?.('aria-busy', busy);
        button.disabled = busy;
      }
    };
    const localBusy = runtime.localBusy || {};
    setBusy('[data-ai-command-form] button[type="submit"]', localBusy.ai === true);
    setBusy('[data-intelligence-question-form] button[type="submit"]', (localBusy.intelligenceIds || []).includes(runtime.intelligenceQuestion?.externalId));
    setBusy('[data-refresh-intelligence]', (localBusy.intelligenceIds || []).includes('refresh'));
    setBusyByData('[data-agent-analyze]', 'agentAnalyze', localBusy.agentIds || []);
    setBusyByData('[data-agent-task-analyze]', 'agentTaskAnalyze', localBusy.agentTaskArchives || []);
    setBusy('[data-agent-analysis-form] button[type="submit"]', (localBusy.agentIds || []).includes(runtime.agentAnalysis?.agentId));
    setBusyByData('[data-refresh-source]', 'refreshSource', localBusy.refreshSources || []);
    setBusy('[data-refresh-all]', runtime.autoRefresh?.phase === 'refreshing');
  }

  function renderCurrentPage() {
    const activePageId = document?.querySelector?.('.page.active')?.id || '';
    const activePage = activePageId.replace(/^page-/, '');
    if (aiRealtimeRoute && activePage && aiRealtimeRoute !== activePage) stopRealtimeVoice('route_change');
    const modularPages = new Set([
      'dashboard', 'decisions', 'targets', 'health', 'intelligence', 'calendar', 'life', 'search',
      'lingli', 'local-life', 'spark-media', 'relations', 'reviews', 'today', 'tasks', 'focus',
      'content-growth', 'zos-brain', 'agent-workbench',
    ]);
    renderMobileAiSheet();
    renderMobileMoreGroups();
    if (activePage && !modularPages.has(activePage)) {
      applyLocalBusyAttributes();
      return;
    }
    const baseModel = pageViewModel(activePage);
    const model = { ...baseModel, isMobile: Number(document?.defaultView?.innerWidth || 0) <= 767 };
    const renderers = {
      dashboard: () => {
        renderDashboard(document?.getElementById('ceoDashboardRoot'), model);
        renderMobile(document?.getElementById('mobileDashboardRoot'), model);
      },
      decisions: () => renderDecisions(document?.getElementById('decisionCenterRoot'), model),
      targets: () => renderTargets(document?.getElementById('targetCenterRoot'), model),
      health: () => renderHealth(document?.getElementById('healthCenterRoot'), model),
      intelligence: () => {
        renderIntelligence(document?.getElementById('intelligenceCenterRoot'), model);
        renderSocialInsights(document?.getElementById('socialInsightsRoot'), model);
      },
      calendar: () => renderCalendar(document?.getElementById('calendarCenterRoot'), model),
      life: () => renderLife(document?.getElementById('lifeCenterRoot'), model),
      search: () => renderSearch(document?.getElementById('searchCenterRoot'), model),
      lingli: () => {
        renderCompanyCockpit(document?.getElementById('lingliOperatingRoot'), model, 'lingli');
        renderLingli(document?.getElementById('lingliCenterRoot'), model);
      },
      'local-life': () => {
        renderWanjiaOps(document?.getElementById('wanjiaOperatingRoot'), model);
        renderMerchant(document?.getElementById('merchantCenterRoot'), model);
      },
      'spark-media': () => {
        renderCompanyCockpit(document?.getElementById('huahuoOperatingRoot'), model, 'huahuo');
        renderAvailability(document?.getElementById('availabilityCenterRoot'), model);
      },
      relations: () => renderRelations(document?.getElementById('relationCenterRoot'), model),
      reviews: () => renderReviews(document?.getElementById('reviewCenterRoot'), model),
      today: () => renderTodayExecution(document?.getElementById('todayExecutionRoot'), model),
      tasks: () => renderTaskCenter(document?.getElementById('taskCenterRoot'), model),
      focus: () => renderFocus(document?.getElementById('focusCenterRoot'), model),
      'content-growth': () => renderContentGrowth(document?.getElementById('contentGrowthRoot'), model),
      'zos-brain': () => renderKnowledgeWorkspace(document?.getElementById('knowledgeWorkspaceRoot'), model),
      'agent-workbench': () => renderAgentWorkbench(document?.getElementById('agentWorkbenchRoot'), model),
    };
    if (!activePage) Object.values(renderers).forEach((renderPage) => renderPage());
    else renderers[activePage]?.();
    const badge = document?.getElementById('decisionBadge');
    if (badge) {
      badge.textContent = String(partitionDecisions(model.decisions).ceo.length);
      badge.style.display = badge.textContent === '0' ? 'none' : '';
    }
    applyLocalBusyAttributes();
  }

  const renderAll = renderCurrentPage;

  function renderMobileAiSheet() {
    let container = document?.getElementById?.('mobileAiSheetRoot');
    if (!container && runtime.mobileAiSheetOpen && document?.createElement && document?.body?.append) {
      container = document.createElement('div');
      container.id = 'mobileAiSheetRoot';
      document.body.append(container);
    }
    renderMobileCommandSheet(container, { ...runtime.aiCommand, open: runtime.mobileAiSheetOpen });
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
    if (!Array.isArray(result)) runtime.externalCalendarFetchedAt = result?.fetchedAt || runtime.externalCalendarFetchedAt;
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
      runtime.externalCalendarState = runtime.externalCalendar.length ? 'cached' : runtime.calendarSyncState;
      throw error;
    } finally {
      if (render) renderAll();
    }
  }

  function setCalendarView(view) {
    runtime.calendarView = ['day', 'week', 'month', 'list'].includes(view) ? view : 'month';
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
        onSyncStatus: (status) => {
          syncMeta = persistSyncMeta(storage, status) || syncMeta;
          runtime.syncStatus = status.phase === 'complete' ? '跨端数据已同步'
            : status.phase === 'retry-wait' ? '同步暂未完成，系统会自动重试'
              : status.phase === 'offline' ? '当前离线，联网后自动补同步' : '正在同步';
          renderAll();
        },
        onSyncConflict: (items) => {
          runtime.conflicts = items;
          renderAll();
        },
      });
    }
    if (!operatingRuntime) {
      runtime.intelligenceState = 'authentication_required';
      runtime.autoRefresh = { ...runtime.autoRefresh, phase: 'authentication_required' };
      renderAll();
      return pageViewModel(activePageId());
    }
    if (operatingRuntime.loadKnowledgeContextStatus) {
      operatingRuntime.loadKnowledgeContextStatus().then((status) => {
        runtime.knowledgeContext = { state: status?.state || 'unknown', count: Number(status?.count) || 0, latestAt: status?.latestAt || null };
        renderAll();
      }).catch(() => {
        runtime.knowledgeContext = { state: 'unavailable', count: 0, latestAt: null };
        renderAll();
      });
    }
    if (operatingRuntime.pushClient) {
      try {
        const status = await operatingRuntime.pushClient.status();
        runtime.notificationPublicKey = status.publicKey || null;
        runtime.notificationState = status.state || pushCapabilityState(document?.defaultView || globalThis);
      } catch {
        runtime.notificationState = 'pending_configuration';
      }
    }
    const syncController = operatingRuntime?.syncController || config.syncController;
    syncController?.start?.();
    try {
      await operatingRuntime?.realtimeSignal?.start?.();
      if (operatingRuntime?.realtimeSignal) runtime.loopConnected = true;
    } catch {
      runtime.loopConnected = false;
      runtime.syncStatus = '实时连接暂不可用，自动重试与手动同步仍可使用';
    }
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
    config.ensureDailyBrief && Object.assign(runtime, { briefs: await config.ensureDailyBrief(pageViewModel('dashboard')) });
    await scheduleDurableReminders({ force: true });
    renderAll();
    return pageViewModel(activePageId());
  }

  async function refreshWeather({ location = runtime.weather?.location || DEFAULT_WEATHER_LOCATION } = {}) {
    runtime.weather = { ...runtime.weather, state: 'loading', location, message: null };
    renderAll();
    try { runtime.weather = await fetchSelectedWeather({ location, fetchImpl: config.weatherFetchImpl || config.fetchImpl || globalThis.fetch, fetchedAt: now() }); }
    catch { runtime.weather = { ...runtime.weather, state: 'unavailable', location, message: '天气暂不可用' }; }
    renderAll();
    return runtime.weather;
  }

  async function useCurrentWeatherLocation() {
    const previous = runtime.weather;
    runtime.weather = { ...previous, state: 'locating', message: '正在请求本机定位…' };
    renderAll();
    try {
      const geolocation = config.geolocation || document?.defaultView?.navigator?.geolocation || globalThis.navigator?.geolocation;
      const location = await requestCurrentWeatherLocation({ geolocation, timezone: 'Asia/Shanghai' });
      return await refreshWeather({ location });
    } catch (error) {
      const code = String(error?.message || 'geolocation_unavailable');
      const message = code === 'geolocation_denied'
        ? '未获定位授权，继续使用默认城市。'
        : '暂时无法获取当前位置，继续使用默认城市。';
      runtime.weather = { ...previous, state: previous?.state === 'ready' ? 'ready' : 'unavailable', message };
      renderAll();
      return runtime.weather;
    }
  }

  async function start() {
    if (started) return pageViewModel(activePageId());
    started = true;
    if (!realtimeVisibilityHandler) {
      realtimeVisibilityHandler = () => {
        if (document?.visibilityState === 'hidden' && aiRealtimeVoice) stopRealtimeVoice('background');
      };
      document?.addEventListener?.('visibilitychange', realtimeVisibilityHandler);
    }
    unsubscribeStore = store.subscribe(() => {
      invalidateWanjiaModel();
      renderAll();
    });
    bindActions();
    renderAll();
    scheduleUpgradeCheckpoint();
    const browserWindow = document?.defaultView;
    clearCalendarTouchPending();
    if (browserWindow?.setInterval && !focusTicker) {
      focusTicker = browserWindow.setInterval(() => {
        if (activePageId() !== 'focus') return;
        const model = pageViewModel('focus');
        if (model.focusSession?.state === 'running') {
          renderFocus(document?.getElementById('focusCenterRoot'), model);
        }
      }, 1000);
    }
    const remoteStartup = initializeRemote().catch(() => {
      runtime.syncStatus = '初始化失败，请稍后重试';
      renderAll();
      return pageViewModel(activePageId());
    });
    const agentOsStartup = loadBundledAgentOsIndex().catch((error) => {
      runtime.agentOsImportState = 'error';
      runtime.agentOsImportMessage = error?.message || 'Agent OS 启动巡检失败';
      renderAll();
      return currentAgentOsIndex();
    });
    startupWork = Promise.all([remoteStartup, agentOsStartup]).then(() => pageViewModel(activePageId()));
    refreshWeather();
    return pageViewModel(activePageId());
  }

  function stop() {
    const browserWindow = document?.defaultView;
    clearCalendarTouchPending();
    clearCalendarEventLongPress();
    if (realtimeVisibilityHandler) document?.removeEventListener?.('visibilitychange', realtimeVisibilityHandler);
    realtimeVisibilityHandler = null;
    if (focusTicker && browserWindow?.clearInterval) browserWindow.clearInterval(focusTicker);
    focusTicker = null;
    unsubscribeStore?.();
    unsubscribeStore = null;
    autoRefreshController?.stop?.();
    operatingRuntime?.realtimeSignal?.stop?.();
    operatingRuntime?.syncController?.stop?.();
    if (reminderScheduleRetryTimer) reminderClock.clearTimeout?.(reminderScheduleRetryTimer);
    reminderScheduleRetryTimer = null;
    if (legacyProjectionRetryTimer != null) browserWindow?.clearTimeout?.(legacyProjectionRetryTimer);
    legacyProjectionRetryTimer = null;
    legacyProjectionGeneration += 1;
    cancelSafetyWork(legacyProjectionIdleHandle);
    legacyProjectionIdleHandle = null;
    legacyProjectionRetryQueued = false;
    clearDecisionUndo();
    const clock = document?.defaultView || globalThis;
    if (aiVoiceHoldTimer) clock.clearTimeout?.(aiVoiceHoldTimer);
    aiVoiceHoldTimer = null;
    aiVoiceHoldActive = false;
    aiVoiceHoldPointer = null;
    aiVoiceInputGeneration += 1;
    aiVoiceInput?.destroy?.();
    aiVoiceInput = null;
    aiVoiceTurn?.destroy?.();
    aiVoiceTurn = null;
    if (aiRealtimeVoice) aiRealtimeVoice.stop?.('application_stop');
    aiRealtimeVoice = null;
    aiRealtimeRoute = null;
    aiVoiceDraftSession = null;
    started = false;
  }

  return {
    start, stop, whenIdle: () => Promise.all([startupWork, reminderScheduleWork]).then(() => pageViewModel(activePageId())), render: renderAll, store, runtime, viewModel, pageViewModel,
    refreshSource, refreshAllSources, diagnoseWanjiaSchema, notifyCurrentReminders, confirmTarget, previewDecision, executeApproval,
    openDecisionAction, closeDecisionAction, confirmDecisionAction, undoDecisionAction, setDecisionFilter, loadMoreDecisions,
    setDecisionSelection, toggleDecisionSelection, executeDecisionBatch,
    quickCapture, captureCalendar, saveCalendar, deleteCalendar, restoreCalendar, copyCalendar, moveCalendar,
    ignoreRitual, convertRitualToLifeTask, importPrivateDateText, selectPrivateDateFile,
    importAgentOsIndexText, selectAgentOsIndexFile, selectKnowledgeContextFile, setAgentOsFilter, openAgentDetails, closeAgentDetails, invokeAgent, analyzeAgent, analyzeAgentTask, confirmAgentContext, rejectAgentContext,
    setIntelligenceFilter, resetIntelligenceFilters, updateIntelligenceStatus, openIntelligenceQuestion, askIntelligenceQuestion, closeIntelligenceQuestion,
    deleteTask, restoreTask, toggleTask, copyTask, moveTask,
    setCalendarView, navigateCalendar, goToCalendarToday, refreshCalendarRange, refreshWeather, useCurrentWeatherLocation,
    selectCalendar, openCalendarEditor, closeCalendarPanel, requestCalendarMutation, applyCalendarSeriesScope,
    requestCalendarDeletion, confirmCalendarDeletion, restoreCalendarEntity, undoCalendarDelete, setCalendarFilter,
    beginCalendarSelection, extendCalendarSelection, commitCalendarSelection, setCalendarDraftKind, openCalendarDaySheet, closeCalendarDaySheet,
    saveCalendarArrangement,
    saveTask, setTaskQuickFilter, convertIntelligenceToTask, saveCountdown, enableClosedAppReminders, scheduleDurableReminders,
    syncNow, resolveSyncConflict, testReminderDelivery, snoozeReminder, restoreReliabilityItem, exportSafeBackup,
    previewBackupText, importBackupText, undoLastRestore, refreshSnapshotCount, selectBackupFile,
    createFocus, transitionCurrentFocus, queryMerchant, queryHuahuoAvailability,
    setWanjiaFilters, resetWanjiaFilters, setWanjiaOpsPane, setWanjiaHistoryRange, setWanjiaHistoryFilters, applyWanjiaHistoryQuery, resetWanjiaHistoryFilters, focusWanjiaKpi, diagnoseWanjiaMerchant, openWanjiaTaskDraft,
    openTaskEditor, closeTaskEditor, generateReview, generateAgentDraft,
    saveContentItem, captureContentItem, editContentItem, advanceContentItem,
    captureReadingItem, updateReadingProgress, readingToKnowledgeCard, reviewKnowledgeCard, editKnowledgeCard,
    captureBrainstorm, captureAsset, captureSocialInsight, editSocialInsight, socialInsightToContent,
    captureContentExperiment, updateContentExperiment, compoundContentItem, reviewCompoundCandidate, updateContentMetrics, editAsset, openBrainstorm,
    launchAgentRun, submitAgentRun, approveAgentRun, deletePrivateEntity,
    submitAiCommand, executeAiCommandAction, undoAiCommandAction,
    setAiCommandInput, setAiCommandScope, startAiVoice, stopAiVoice, toggleAiVoice, stopAiSpeech,
    startRealtimeVoice, stopRealtimeVoice, interruptRealtimeVoice, toggleRealtimeVoiceMute, toggleRealtimeVoiceCaptions,
    openMobileAiSheet, closeMobileAiSheet,
    get operatingRuntime() { return operatingRuntime; },
  };
}

if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  function readOwnerConfig() {
    try {
      return { ...BROWSER_SUPABASE_CONFIG, ...(JSON.parse(localStorage.getItem('zos_supabase_config') || '{}') || {}) };
    } catch {
      return { ...BROWSER_SUPABASE_CONFIG };
    }
  }
  function ownerDeviceId() {
    let id = '';
    try { id = localStorage.getItem('zos_device_id') || ''; } catch { /* Storage may be restricted. */ }
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}`;
      try { localStorage.setItem('zos_device_id', id); } catch { /* Continue as a tab-only device. */ }
    }
    return id;
  }

  const ownerConfig = readOwnerConfig();
  const ownerAuth = createSupabaseAuth({ ...ownerConfig, fetchImpl: globalThis.fetch });
  const ownerSession = createOwnerSessionClient({ ...ownerConfig, fetchImpl: globalThis.fetch });
  const authGate = createAuthGate({
    auth: ownerAuth,
    verifyOwner: (accessToken) => ownerSession.verify(accessToken),
    storage: localStorage,
    deviceId: ownerDeviceId(),
    isOnline: () => globalThis.navigator?.onLine !== false,
  });
  const authBootstrap = createAuthenticatedBootstrap({
    gate: authGate,
    appRoot: document.getElementById('zosAppRoot'),
    loginRoot: document.getElementById('zosLoginRoot'),
    renderLogin,
    createApplication: ({ offlineReadOnly }) => {
      const application = createCeoOsApplication({ createOperatingRuntime: !offlineReadOnly });
      window.ZOS_CEO_OS = application;
      installSettingsSyncBridge({ browserWindow: window, application });
      return application;
    },
  });

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-owner-sign-out]')) authBootstrap.signOut();
    if (event.target?.closest?.('[data-owner-remove-device]')) authBootstrap.removeDevice();
  });
  authBootstrap.start().catch(() => authBootstrap.signOut());
  window.ZOS_AUTH = authBootstrap;
}
