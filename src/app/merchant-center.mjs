function normalized(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
}

function actionTitle(action) {
  return normalized(action?.title || action?.name);
}

function uniqueActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const id = String(action?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function searchMerchants(merchants = [], query = '') {
  const needle = normalized(query);
  if (!needle) return { state: 'empty_query', matches: [] };
  const exact = merchants.filter((merchant) => [merchant.merchantName, merchant.merchantId, merchant.id].some((value) => normalized(value) === needle));
  if (exact.length > 1) return { state: 'ambiguous', matches: exact };
  if (exact.length === 1) return { state: 'matched', matches: exact, merchant: exact[0] };
  const matches = merchants.filter((merchant) => [merchant.merchantName, merchant.merchantId, merchant.id]
    .some((value) => normalized(value).includes(needle)));
  if (!matches.length) return { state: 'not_found', matches: [] };
  if (matches.length > 1) return { state: 'multiple', matches };
  return { state: 'matched', matches, merchant: matches[0] };
}

export function bucketMerchantActions(actions = [], expectedLabels = [], options = {}) {
  const now = new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) throw new Error('invalid merchant action timestamp');
  const result = { done: [], pending: [], overdue: [], unrecorded: [] };
  const observed = new Set();
  for (const action of uniqueActions(actions)) {
    const title = String(action.title || action.name || '').trim();
    if (!title) continue;
    observed.add(normalized(title));
    const status = normalized(action.status || 'todo');
    if (['done', 'completed', '已完成', '完成'].map(normalized).includes(status)) result.done.push({ ...action, title });
    else if (action.dueAt && new Date(action.dueAt) < now) result.overdue.push({ ...action, title });
    else result.pending.push({ ...action, title });
  }
  result.unrecorded = [...new Set(expectedLabels.map((label) => String(label || '').trim()).filter(Boolean))]
    .filter((label) => !observed.has(normalized(label)));
  return result;
}

export function buildMerchantProfile(merchant = {}, options = {}) {
  if (!merchant.id || !merchant.merchantName) throw new Error('merchant id and name are required');
  const localActions = (options.tasks || []).filter((task) => task.businessEntityId === merchant.id)
    .map((task) => ({ ...task, source: 'local_task' }));
  const actions = uniqueActions([...(merchant.actions || []), ...localActions]);
  const expectedLabels = merchant.expectedActionLabels || options.expectedActionLabels || [];
  return {
    ...merchant,
    metrics: {
      isListed: merchant.isListed ?? null,
      isActive: merchant.isActive ?? null,
      businessScore: Number(merchant.businessScore) || 0,
      paymentGmv: Number(merchant.paymentGmv) || 0,
      redeemedGmv: Number(merchant.redeemedGmv) || 0,
      refundGmv: Number(merchant.refundGmv) || 0,
      paymentCoupons: Number(merchant.paymentCoupons) || 0,
      redeemedCoupons: Number(merchant.redeemedCoupons) || 0,
      refundCoupons: Number(merchant.refundCoupons) || 0,
    },
    actions: bucketMerchantActions(actions, expectedLabels, options),
    evidence: {
      source: merchant.source || 'wanjia',
      sourceUpdatedAt: merchant.sourceUpdatedAt || merchant.updatedAt || null,
      mode: 'read_only',
    },
  };
}
