const COMPANY_NAMES = Object.freeze({
  wanjia: '万嘉网络',
  huahuo: '花火影像',
  lingli: '玲丽教育',
});

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metric(value, source = 'feishu') {
  const normalized = finite(value);
  return {
    value: normalized,
    source: normalized === null ? 'unavailable' : source,
  };
}

function sourceHealth(payload) {
  if (!payload) return { state: 'pending', safeCode: null, updatedAt: null, recordCount: null };
  const records = Array.isArray(payload.records) ? payload.records : payload.records?.records;
  const state = payload.state || (payload.summary ? 'synced' : 'pending');
  return {
    state,
    safeCode: payload.safeCode || null,
    updatedAt: payload.fetchedAt || payload.updatedAt || null,
    recordCount: Array.isArray(records) ? records.length : null,
  };
}

function baseCompany(company, payload) {
  return {
    company,
    name: COMPANY_NAMES[company],
    businessVolume: metric(null),
    finance: {
      income: metric(null),
      cashIn: metric(null),
      outstanding: metric(null),
      cost: metric(null),
      grossProfit: metric(null),
    },
    operations: {
      total: metric(null),
      active: metric(null),
      leads: metric(null),
      students: metric(null),
      consumed: metric(null),
    },
    projects: {
      active: metric(null),
      pendingDelivery: metric(null),
    },
    health: sourceHealth(payload),
  };
}

function buildWanjia(payload) {
  const company = baseCompany('wanjia', payload);
  const summary = payload?.summary || {};
  company.businessVolume = metric(summary.paymentGmv);
  company.operations.total = metric(summary.totalMerchants);
  company.operations.active = metric(summary.activeMerchants);
  return company;
}

function buildHuahuo(payload) {
  const company = baseCompany('huahuo', payload);
  const summary = payload?.summary || {};
  company.businessVolume = metric(summary.contractAmount);
  company.finance.cashIn = metric(summary.receivedAmount);
  company.finance.outstanding = metric(summary.outstandingAmount);
  company.projects.active = metric(summary.activeProjects);
  company.projects.pendingDelivery = metric(summary.pendingDeliveries);
  return company;
}

function buildLingli(payload) {
  const company = baseCompany('lingli', payload);
  const summary = payload?.summary || {};
  company.finance.cashIn = metric(summary.received);
  company.operations.leads = metric(summary.leads);
  company.operations.students = metric(summary.students);
  company.operations.consumed = metric(summary.consumed);
  company.projects.active = metric(summary.activeClasses);
  return company;
}

export function buildCompanyOperatingContract(sources = {}) {
  return {
    wanjia: buildWanjia(sources.wanjia),
    huahuo: buildHuahuo(sources.huahuo),
    lingli: buildLingli(sources.lingli),
  };
}
