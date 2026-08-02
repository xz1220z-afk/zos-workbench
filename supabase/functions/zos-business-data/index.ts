import { AuthError, requireUser } from '../_shared/auth.ts';
import {
  FEISHU_TARGETS,
  FeishuRecord,
  FeishuRequestError,
  getTenantAccessToken,
  listRecords,
  safeFeishuCode,
} from '../_shared/feishu.ts';
import { feishuNumber, feishuText, roundMoney } from '../_shared/feishu-values.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function fieldsOf(record: FeishuRecord | Record<string, unknown>) {
  return 'fields' in record && record.fields && typeof record.fields === 'object'
    ? record.fields
    : record;
}

function sourceUpdatedAt(record: FeishuRecord, fallback: unknown = null) {
  const raw = record.last_modified_time || fallback;
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString();
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Try multiple candidate column names for a field, returning the first
// non-empty value. Keeps the index resilient to minor Feishu schema drift.
function pick(record: FeishuRecord, ...names: string[]): unknown {
  const f = fieldsOf(record);
  for (const name of names) {
    const v = f[name];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function numberOf(value: unknown) {
  return feishuNumber(value);
}

function sum(records: FeishuRecord[], ...fieldNames: string[]) {
  return records.reduce((total, record) => total + numberOf(pick(record, ...fieldNames)), 0);
}

function summarizeWanjia(records: FeishuRecord[]) {
  return {
    totalMerchants: records.length,
    activeMerchants: records.filter((record) => {
      const value = feishuText(fieldsOf(record)['是否动销']);
      return value === 'true' || value === '是' || value === '已动销';
    }).length,
    paymentGmv: roundMoney(sum(records, '支付GMV')),
    redeemedGmv: roundMoney(sum(records, '核销GMV')),
    videoPosts: sum(records, '视频投稿数'),
    liveSessions: sum(records, '直播场次数'),
    estimatedCommission: roundMoney(sum(records, '总预估佣金')),
  };
}

function summarizeHuahuo(projects: FeishuRecord[], deliveries: FeishuRecord[], receipts: FeishuRecord[]) {
  const contractAmount = roundMoney(sum(projects, '合同金额', '【预算】合同金额'));
  const receivedAmount = receipts
    .filter((record) => ['已收款', '已到账', '已完成'].includes(feishuText(pick(record, '收款状态', '回款状态', '状态'))))
    .reduce((total, record) => total + numberOf(pick(record, '收款金额', '到账金额', '实收金额')), 0);
  return {
    activeProjects: projects.filter((record) => ['进行中', '执行中'].includes(feishuText(pick(record, '项目状态', '当前阶段')))).length,
    pendingDeliveries: deliveries.filter((record) => feishuText(fieldsOf(record)['交付状态']) === '待交付').length,
    contractAmount,
    receivedAmount: roundMoney(receivedAmount),
    outstandingAmount: roundMoney(Math.max(0, contractAmount - receivedAmount)),
  };
}

// Build a read-only WanJia merchant-operations record index from the Feishu
// merchant table. Only METADATA is carried — never merchant narratives. The
// payload is always flagged mode: 'read_only' and is meant to be cached into
// `zos_business_cache` (source = 'wanjia') for the PWA to SELECT.
function buildWanjiaRecords(records: FeishuRecord[]): unknown {
  return {
    source: 'wanjia',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    records: records.map((record, idx) => {
      const f = fieldsOf(record);
      const updatedAt = sourceUpdatedAt(record, pick(f, '最近更新时间', '更新时间', '修改时间'));
      return {
        id: feishuText(pick(f, '商家ID', '记录ID', 'RecordId'), record.record_id || `wanjia-${idx}`),
        sourceRecordId: record.record_id || null,
        sourceUpdatedAt: updatedAt,
        writeAvailable: Boolean(record.record_id),
        contractVersion: '1.3',
        merchantName: feishuText(f['商家名称'], '未知商家'),
        cooperationType: feishuText(pick(f, '合作模式', '合作类型', '业务类型'), '其他'),
        stage: feishuText(pick(f, '当前阶段', '阶段', '合作阶段'), '未提供'),
        owner: feishuText(pick(f, '跟进人', '项目负责人', '负责人', '对接人'), '未指定'),
        updatedAt,
        nextAction: feishuText(pick(f, '下一步动作', '待办事项', '后续动作')),
        riskLevel: feishuText(pick(f, '风险等级', '风险'), '低'),
        revenueStatus: feishuText(pick(f, '收入状态', '收款状态', '回款状态'), '未提供'),
      };
    }),
  };
}

// Build a read-only HuaHuo shooting-project record index from the Feishu
// project table. Only METADATA is carried — never project narratives/bodies.
// The payload is always flagged mode: 'read_only' and is meant to be cached
// into `zos_business_cache` (source = 'huahuo') for the PWA to SELECT.
function buildHuahuoRecords(records: FeishuRecord[]): unknown {
  return {
    source: 'huahuo',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    records: records.map((record, idx) => {
      const f = fieldsOf(record);
      const shootingDate = feishuText(pick(f, '拍摄日期', '外拍日期'), new Date().toISOString());
      // P1 hotfix (v1.2.1): huahuo records must carry updatedAt so the risk
      // detector can compute stale/stuck days without producing Infinity.
      // Prefer the Feishu project update-time field; fall back to shootingDate.
      const updatedAt = sourceUpdatedAt(record, pick(f, '最近更新时间', '更新时间')) || shootingDate;
      return {
        id: feishuText(pick(f, '项目编号', '项目ID', 'RecordId'), record.record_id || `huahuo-${idx}`),
        sourceRecordId: record.record_id || null,
        sourceUpdatedAt: sourceUpdatedAt(record, updatedAt),
        writeAvailable: Boolean(record.record_id),
        contractVersion: '1.3',
        clientName: feishuText(pick(f, '客户名称', '客户'), '未指定'),
        projectName: feishuText(f['项目名称'], '花火项目'),
        projectType: feishuText(pick(f, '项目类型', '项目来源'), '其他'),
        shootingDate,
        updatedAt,
        stage: feishuText(pick(f, '项目状态', '当前阶段', '阶段'), '筹备中'),
        deliveryStatus: feishuText(pick(f, '交付状态', '交付进度'), '待交付'),
        revenueStatus: feishuText(pick(f, '回款状态', '收款状态'), '待回款'),
        profitStatus: feishuText(pick(f, '利润状态', '利润'), '待核算'),
      };
    }),
  };
}

// Build a read-only project metadata index from the (fact-source) Feishu tables.
// Only METADATA is carried — never project narratives/bodies. The payload is
// always flagged mode: 'read_only' and is meant to be cached into
// `zos_business_cache` (source = 'projects') for the PWA to SELECT.
function buildProjectsSource(huahuoProjects: FeishuRecord[], merchants: FeishuRecord[]): unknown {
  const projects = huahuoProjects.map((record, idx) => {
    const f = fieldsOf(record);
    const status = feishuText(f['项目状态'], '进行中');
    const riskFromStatus = status.includes('延期') || status.includes('风险') ? '高' : '中';
    return {
      id: record.record_id || `huahuo-${idx}`,
      sourceRecordId: record.record_id || null,
      sourceUpdatedAt: sourceUpdatedAt(record, pick(f, '拍摄日期', '实际交付日期', '更新时间')),
      writeAvailable: Boolean(record.record_id),
      contractVersion: '1.3',
      name: feishuText(f['项目名称'], '花火项目'),
      type: '花火拍摄',
      status,
      owner: feishuText(pick(f, '项目负责人', '负责人'), '花火团队'),
      updatedAt: feishuText(pick(f, '拍摄日期', '实际交付日期', '更新时间'), new Date().toISOString()),
      riskLevel: riskFromStatus,
      source: 'huahuo',
    };
  });
  const activeMerchants = merchants.filter((record) => {
    const v = feishuText(fieldsOf(record)['是否动销']);
    return v === 'true' || v === '是' || v === '已动销';
  }).length;
  projects.push({
    id: 'wanjia-ops',
    name: '万嘉商家运营',
    type: '万嘉商家运营',
    status: '进行中',
    owner: '运营组',
    updatedAt: new Date().toISOString(),
    riskLevel: activeMerchants > 0 ? '低' : '中',
    source: 'wanjia',
    sourceRecordId: null,
    sourceUpdatedAt: null,
    writeAvailable: false,
    contractVersion: '1.3',
  });
  return {
    source: 'projects',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    projects,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  const requestedSource = new URL(req.url).searchParams.get('source') || 'all';
  if (!['all', 'wanjia', 'huahuo', 'projects'].includes(requestedSource)) {
    return response({ error: 'invalid_source' }, 400);
  }

  try {
    await requireUser(req);
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  try {
    const startedAt = Date.now();
    const accessToken = await getTenantAccessToken();
    const needsWanjia = requestedSource === 'all' || requestedSource === 'wanjia' || requestedSource === 'projects';
    const needsHuahuo = requestedSource === 'all' || requestedSource === 'huahuo' || requestedSource === 'projects';
    const merchants = needsWanjia
      ? await listRecords(accessToken, FEISHU_TARGETS.wanjia.merchant,
        // Verified against the current WanJia merchant-main table on 2026-08-02.
        // Content, live-stream, commission and follow-up data belong to other
        // operational tables and must not be fabricated from this source.
        ['商家名称', '商家ID', '行业', '类目', '经营单元', '商家分层', '合作模式', '跟进人',
         '是否上团', '是否动销', '商家经营分', '支付GMV', '核销GMV', '退款GMV',
         '支付券数', '核销券数', '退款券数'])
      : [];
    const [projects, deliveries, receipts] = needsHuahuo ? await Promise.all([
      listRecords(accessToken, FEISHU_TARGETS.huahuo.project,
        // Current 04.01 项目管理 fields, plus legacy aliases retained for a
        // read-only, backwards-compatible index.
        ['项目编号', '项目名称', '订单', '项目来源', '项目负责人', '项目成员', '拍摄地点', '项目状态',
         '【预算】合同金额', '【预算】已收金额', '合同金额', '已收金额', '负责人', '项目类型',
         '回款状态', '利润状态', '最近更新时间', '更新时间', '拍摄日期']),
      listRecords(accessToken, FEISHU_TARGETS.huahuo.delivery,
        ['交付编号', '项目', '订单', '交付类型', '计划交付日期', '实际交付日期', '交付状态',
         '接收人', '交付负责人', '客户确认状态']),
      listRecords(accessToken, FEISHU_TARGETS.huahuo.receipt,
        ['项目', '订单', '收款金额', '到账金额', '实收金额', '收款日期', '到账日期', '收款状态', '回款状态', '状态']),
    ]) : [[], [], []];

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const health = (recordCount: number) => ({ recordCount, durationMs, lastSuccessAt: completedAt, safeCode: null });
    return response({
      wanjia: {
        summary: summarizeWanjia(merchants),
        records: buildWanjiaRecords(merchants),
        health: health(merchants.length),
        contractVersion: '1.3',
      },
      huahuo: {
        summary: summarizeHuahuo(projects, deliveries, receipts),
        records: buildHuahuoRecords(projects),
        health: health(projects.length + deliveries.length + receipts.length),
        contractVersion: '1.3',
      },
      projects: { ...(buildProjectsSource(projects, merchants) as Record<string, unknown>), health: health(projects.length + 1), contractVersion: '1.3' },
      brain: { state: 'not_configured', note: 'Obsidian bridge not configured' },
      meta: { fetchedAt: completedAt, mode: 'read_only', contractVersion: '1.3' },
    });
  } catch (error) {
    const reason = safeFeishuCode(error);
    console.error(JSON.stringify({ event: 'zos_business_data_failed', reason }));
    const missingFields = error instanceof FeishuRequestError ? error.missingFields : [];
    return response({ error: 'source_read_failed', reason, missing_fields: missingFields }, 502);
  }
});
