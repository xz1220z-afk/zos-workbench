const ALLOWED_KINDS = new Set(['daily_increment', 'period_snapshot']);
const HISTORY_PAGE_SIZE = 1_000;

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function amount(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function mappedRow(row) {
  const sourceKind = ALLOWED_KINDS.has(row.source_kind) ? row.source_kind : 'period_snapshot';
  return {
    businessDate: text(row.business_date), merchantId: text(row.merchant_id), merchantName: text(row.merchant_name),
    industry: text(row.industry), owner: text(row.owner), cooperationType: text(row.cooperation_type),
    paymentGmv: amount(row.payment_gmv), redeemedGmv: amount(row.redeemed_gmv), refundGmv: amount(row.refund_gmv),
    videoPaymentGmv: amount(row.video_payment_gmv), livePaymentGmv: amount(row.live_payment_gmv),
    exception: row.exception === true, sourceKind,
  };
}

export async function collectHistoryPages(readPage, pageSize = HISTORY_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result?.error) return { rows: [], error: result.error };
    const page = Array.isArray(result?.data) ? result.data : [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, error: null };
  }
}

// This is a deliberately narrow read model. It never includes source files,
// source hashes, raw JSON, authentication material, or any fields outside the
// history view contract consumed by the existing Wanjia page.
export function buildHistoryPayload(batches, rows, options = {}) {
  const validBatches = (batches || []).filter((batch) => batch?.validated_at && ALLOWED_KINDS.has(batch.source_kind));
  if (!validBatches.length) {
    return { availability: { state: 'unavailable', source: 'local_sqlite', earliestDate: null, latestDate: null, batchCount: 0 }, rows: [] };
  }
  const dates = validBatches.map((batch) => batch.business_date).filter(Boolean).sort();
  const result = {
    availability: {
      state: 'validated', source: 'local_sqlite', earliestDate: dates[0], latestDate: dates.at(-1), batchCount: validBatches.length,
    },
    rows: (rows || []).map(mappedRow).filter((row) => row.businessDate && row.merchantId),
  };
  if (options.includeRange) {
    const kinds = new Set(result.rows.map((row) => row.sourceKind));
    result.range = kinds.has('period_snapshot')
      ? { status: options.baselinePresent ? 'ready' : 'insufficient_history', aggregation: 'snapshot_difference' }
      : { status: 'ready', aggregation: 'sum_daily_increment' };
  }
  return result;
}
