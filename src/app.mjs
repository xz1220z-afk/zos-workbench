import { createStateStore } from './app/state-store.mjs';
import { render as renderDashboard } from './app/views/dashboard-view.mjs';
import { render as renderDecisions } from './app/views/decision-view.mjs';
import { render as renderTargets } from './app/views/targets-view.mjs';
import { render as renderHealth } from './app/views/health-view.mjs';
import { render as renderMobile } from './app/views/mobile-view.mjs';

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
    health: [], gaps: [], briefs: [], conflicts: [], approvals: [], syncStatus: '等待首次同步',
  };

  function viewModel() {
    const state = store.load();
    const decisions = state.collections.decisions || [];
    const brief = runtime.briefs.at(-1) || null;
    return {
      ...runtime,
      decisions,
      targets: state.collections.targets || [],
      tasks: state.collections.tasks || [],
      inbox: state.collections.inbox || [],
      todayTop3: brief?.sections?.todayTop3 || [],
      brief,
    };
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
    config.syncController?.start?.();
    config.ensureDailyBrief && Object.assign(runtime, { briefs: await config.ensureDailyBrief(viewModel()) });
    store.subscribe(renderAll);
    renderAll();
    return viewModel();
  }

  return { start, render: renderAll, store, runtime, viewModel };
}

if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  const application = createCeoOsApplication();
  application.start().catch(() => {
    application.runtime.syncStatus = '初始化失败，请刷新页面';
    application.render();
  });
  window.ZOS_CEO_OS = application;
}
