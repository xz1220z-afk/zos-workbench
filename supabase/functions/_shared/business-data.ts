import {
  FEISHU_TARGETS,
  FeishuRecord,
  FeishuRequestError,
  getTenantAccessToken,
  listRecords,
  listRecordsFlexible,
  listTables,
  resolveTableByNames,
} from './feishu.ts';
import { feishuNumber, feishuText, roundMoney } from './feishu-values.mjs';
import { LINGLI_TABLE_ALIASES, summarizeLingli } from './lingli-data.mjs';

export type BusinessSource = 'all' | 'wanjia' | 'huahuo' | 'lingli' | 'projects';

function fieldsOf(record: FeishuRecord | Record<string, unknown>) {
  return 'fields' in record && record.fields && typeof record.fields === 'object' ? record.fields : record;
}

function pick(record: FeishuRecord, ...names: string[]) {
  const fields = fieldsOf(record);
  for (const name of names) {
    const value = fields[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function sourceUpdatedAt(record: FeishuRecord, fallback: unknown = null) {
  const raw = record.last_modified_time || fallback;
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString();
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sum(records: FeishuRecord[], ...fieldNames: string[]) {
  return records.reduce((total, record) => total + feishuNumber(pick(record, ...fieldNames)), 0);
}

function feishuList(value: unknown) {
  const text = feishuText(value);
  return [...new Set(text.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean))];
}

function summarizeWanjia(records: FeishuRecord[]) {
  return {
    totalMerchants: records.length,
    activeMerchants: records.filter((record) => ['true', '是', '已动销'].includes(feishuText(fieldsOf(record)['是否动销']))).length,
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
    .reduce((total, record) => total + feishuNumber(pick(record, '收款金额', '到账金额', '实收金额')), 0);
  return {
    activeProjects: projects.filter((record) => ['进行中', '执行中'].includes(feishuText(pick(record, '项目状态', '当前阶段')))).length,
    pendingDeliveries: deliveries.filter((record) => feishuText(fieldsOf(record)['交付状态']) === '待交付').length,
    contractAmount,
    receivedAmount: roundMoney(receivedAmount),
    outstandingAmount: roundMoney(Math.max(0, contractAmount - receivedAmount)),
  };
}

function buildWanjiaRecords(records: FeishuRecord[]) {
  return {
    source: 'wanjia', mode: 'read_only', scannedAt: new Date().toISOString(),
    records: records.map((record, index) => {
      const fields = fieldsOf(record);
      const updatedAt = sourceUpdatedAt(record, pick(record, '最近更新时间', '更新时间', '修改时间'));
      const nextAction = feishuText(pick(record, '下一步动作', '待办事项', '后续动作'));
      return {
        id: feishuText(pick(record, '商家ID', '记录ID', 'RecordId'), record.record_id || `wanjia-${index}`),
        sourceRecordId: record.record_id || null,
        sourceUpdatedAt: updatedAt,
        writeAvailable: Boolean(record.record_id),
        contractVersion: '1.3',
        merchantName: feishuText(fields['商家名称'], '未知商家'),
        merchantId: feishuText(pick(record, '商家ID', '记录ID'), record.record_id || `wanjia-${index}`),
        industry: feishuText(fields['行业']),
        category: feishuText(fields['类目']),
        businessUnit: feishuText(fields['经营单元']),
        tier: feishuText(fields['商家分层']),
        isListed: ['true', '是', '已上团'].includes(feishuText(fields['是否上团']).toLowerCase()),
        isActive: ['true', '是', '已动销'].includes(feishuText(fields['是否动销']).toLowerCase()),
        businessScore: feishuNumber(fields['商家经营分']),
        paymentGmv: roundMoney(feishuNumber(fields['支付GMV'])),
        redeemedGmv: roundMoney(feishuNumber(fields['核销GMV'])),
        refundGmv: roundMoney(feishuNumber(fields['退款GMV'])),
        paymentCoupons: feishuNumber(fields['支付券数']),
        redeemedCoupons: feishuNumber(fields['核销券数']),
        refundCoupons: feishuNumber(fields['退款券数']),
        cooperationType: feishuText(pick(record, '合作模式', '合作类型', '业务类型'), '其他'),
        stage: feishuText(pick(record, '当前阶段', '阶段', '合作阶段'), '未提供'),
        owner: feishuText(pick(record, '跟进人', '项目负责人', '负责人', '对接人'), '未指定'),
        updatedAt,
        nextAction,
        actions: nextAction ? [{
          id: `${record.record_id || `wanjia-${index}`}:next`, title: nextAction,
          status: 'todo', dueAt: null, source: 'feishu',
        }] : [],
        expectedActionLabels: [],
        riskLevel: feishuText(pick(record, '风险等级', '风险'), '低'),
        revenueStatus: feishuText(pick(record, '收入状态', '收款状态', '回款状态'), '未提供'),
      };
    }),
  };
}

function buildHuahuoRecords(records: FeishuRecord[]) {
  return {
    source: 'huahuo', mode: 'read_only', scannedAt: new Date().toISOString(),
    records: records.map((record, index) => {
      const fields = fieldsOf(record);
      const shootingDate = feishuText(pick(record, '拍摄日期', '外拍日期'), new Date().toISOString());
      const startAt = feishuText(pick(record, '开始时间', '拍摄开始时间')) || null;
      const endAt = feishuText(pick(record, '结束时间', '拍摄结束时间')) || null;
      const updatedAt = sourceUpdatedAt(record, pick(record, '最近更新时间', '更新时间')) || shootingDate;
      return {
        id: feishuText(pick(record, '项目编号', '项目ID', 'RecordId'), record.record_id || `huahuo-${index}`),
        sourceRecordId: record.record_id || null,
        sourceUpdatedAt: sourceUpdatedAt(record, updatedAt),
        writeAvailable: Boolean(record.record_id),
        contractVersion: '1.7',
        clientName: feishuText(pick(record, '客户名称', '客户'), '未指定'),
        projectName: feishuText(fields['项目名称'], '花火项目'),
        projectType: feishuText(pick(record, '项目类型', '项目来源'), '其他'),
        shootingDate,
        startAt,
        endAt,
        location: feishuText(pick(record, '拍摄地点', '地点')),
        owner: feishuText(pick(record, '项目负责人', '负责人')),
        members: feishuList(pick(record, '项目成员', '参与人员')),
        roles: feishuList(pick(record, '岗位', '角色', '人员角色')),
        updatedAt,
        stage: feishuText(pick(record, '项目状态', '当前阶段', '阶段'), '筹备中'),
        deliveryStatus: feishuText(pick(record, '交付状态', '交付进度'), '待交付'),
        revenueStatus: feishuText(pick(record, '回款状态', '收款状态'), '待回款'),
        profitStatus: feishuText(pick(record, '利润状态', '利润'), '待核算'),
      };
    }),
  };
}

function buildLingliRecords(records: FeishuRecord[]) {
  return {
    source: 'lingli', mode: 'read_only', scannedAt: new Date().toISOString(),
    records: records.map((record, index) => {
      const status = feishuText(pick(record, '班级状态', '开班状态', '状态'), '未提供');
      const updatedAt = sourceUpdatedAt(record, pick(record, '更新时间', '开班日期', '上课日期'));
      return {
        id: feishuText(pick(record, '班级编号', '班级ID'), record.record_id || `lingli-${index}`),
        sourceRecordId: record.record_id || null,
        sourceUpdatedAt: updatedAt,
        writeAvailable: Boolean(record.record_id),
        contractVersion: '1.6',
        name: feishuText(pick(record, '班级名称', '课程名称', '名称'), '玲丽教学班'),
        type: '玲丽教学班',
        status,
        owner: feishuText(pick(record, '班主任', '授课老师', '负责人'), '未指定'),
        updatedAt,
        riskLevel: /延期|停课|异常|欠费|风险/.test(status) ? '高' : '低',
        source: 'lingli',
      };
    }),
  };
}

function buildProjectsSource(huahuoProjects: FeishuRecord[], merchants: FeishuRecord[], lingliClasses: FeishuRecord[]) {
  const projects = huahuoProjects.map((record, index) => {
    const fields = fieldsOf(record);
    const status = feishuText(fields['项目状态'], '进行中');
    return {
      id: record.record_id || `huahuo-${index}`,
      sourceRecordId: record.record_id || null,
      sourceUpdatedAt: sourceUpdatedAt(record, pick(record, '拍摄日期', '实际交付日期', '更新时间')),
      writeAvailable: Boolean(record.record_id),
      contractVersion: '1.3',
      name: feishuText(fields['项目名称'], '花火项目'),
      type: '花火拍摄', status,
      owner: feishuText(pick(record, '项目负责人', '负责人'), '花火团队'),
      updatedAt: feishuText(pick(record, '拍摄日期', '实际交付日期', '更新时间'), new Date().toISOString()),
      riskLevel: status.includes('延期') || status.includes('风险') ? '高' : '中',
      source: 'huahuo',
    };
  });
  const activeMerchants = merchants.filter((record) => ['true', '是', '已动销'].includes(feishuText(fieldsOf(record)['是否动销']))).length;
  projects.push({
    id: 'wanjia-ops', name: '万嘉商家运营', type: '万嘉商家运营', status: '进行中', owner: '运营组',
    updatedAt: new Date().toISOString(), riskLevel: activeMerchants > 0 ? '低' : '中', source: 'wanjia',
    sourceRecordId: null, sourceUpdatedAt: null, writeAvailable: false, contractVersion: '1.3',
  });
  projects.push(...buildLingliRecords(lingliClasses).records);
  return { source: 'projects', mode: 'read_only', scannedAt: new Date().toISOString(), projects };
}

export async function readBusinessSources(requestedSource: BusinessSource = 'all') {
  if (!['all', 'wanjia', 'huahuo', 'lingli', 'projects'].includes(requestedSource)) throw new Error('invalid_source');
  const startedAt = Date.now();
  const accessToken = await getTenantAccessToken();
  const needsWanjia = ['all', 'wanjia', 'projects'].includes(requestedSource);
  const needsHuahuo = ['all', 'huahuo', 'projects'].includes(requestedSource);
  const needsLingli = ['all', 'lingli', 'projects'].includes(requestedSource);
  const merchants = needsWanjia ? await listRecords(accessToken, FEISHU_TARGETS.wanjia.merchant, [
    '商家名称', '商家ID', '行业', '类目', '经营单元', '商家分层', '合作模式', '跟进人',
    '是否上团', '是否动销', '商家经营分', '支付GMV', '核销GMV', '退款GMV', '支付券数', '核销券数', '退款券数',
    '当前阶段', '阶段', '合作阶段', '项目负责人', '负责人', '对接人',
    '下一步动作', '待办事项', '后续动作', '风险等级', '风险', '收入状态', '收款状态', '回款状态',
  ]) : [];
  const [projects, deliveries, receipts] = needsHuahuo ? await Promise.all([
    listRecords(accessToken, FEISHU_TARGETS.huahuo.project, [
      '项目编号', '项目名称', '订单', '项目来源', '项目负责人', '项目成员', '拍摄地点', '项目状态',
      '【预算】合同金额', '【预算】已收金额', '合同金额', '已收金额', '负责人', '项目类型',
      '回款状态', '利润状态', '最近更新时间', '更新时间', '拍摄日期',
      '开始时间', '拍摄开始时间', '结束时间', '拍摄结束时间', '岗位', '角色', '人员角色',
    ]),
    listRecords(accessToken, FEISHU_TARGETS.huahuo.delivery, [
      '交付编号', '项目', '订单', '交付类型', '计划交付日期', '实际交付日期', '交付状态', '接收人', '交付负责人', '客户确认状态',
    ]),
    listRecords(accessToken, FEISHU_TARGETS.huahuo.receipt, [
      '项目', '订单', '收款金额', '到账金额', '实收金额', '收款日期', '到账日期', '收款状态', '回款状态', '状态',
    ]),
  ]) : [[], [], []];
  const lingliAppToken = needsLingli ? Deno.env.get('LINGLI_APP_TOKEN') : null;
  if (needsLingli && !lingliAppToken) throw new FeishuRequestError('feishu_configuration_missing');
  const lingliTables = needsLingli ? await listTables(accessToken, lingliAppToken as string) : [];
  const lingliTarget = (names: string[]) => resolveTableByNames(lingliAppToken as string, lingliTables, names);
  const [leads, students, income, costs, lessons, classes] = needsLingli ? await Promise.all([
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.leads), [
      '线索编号', '线索ID', '客户姓名', '学员姓名', '姓名', '线索状态', '当前阶段', '招生来源', '来源渠道', '意向课程',
      '咨询课程', '意向等级', '跟进人', '负责人', '下次跟进日期', '最后跟进时间', '更新时间',
    ]),
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.students), [
      '学员编号', '学员ID', '学员姓名', '姓名', '学员状态', '学习状态', '在读状态', '状态', '课程', '购买课程',
      '班级', '所属班级', '授课老师', '负责人', '报名日期', '更新时间',
    ]),
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.income), [
      '收支类型', '类型', '业务类型', '科目', '收入金额', '实收金额', '收款金额', '到账金额', '金额', '发生金额',
      '发生日期', '收支日期', '日期', '收款日期', '到账日期',
    ]),
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.costs), [
      '收支类型', '类型', '业务类型', '科目', '类别', '支出金额', '成本金额', '金额', '发生金额',
      '发生日期', '收支日期', '日期', '支出日期', '付款日期',
    ]),
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.lessons), [
      '课消状态', '排课状态', '状态', '消耗课时', '已消课时', '课消课时', '完成课时', '核销课时',
      '记录名称', '课程', '课程名称', '学员', '学员姓名', '教师', '上课日期', '日期',
    ]),
    listRecordsFlexible(accessToken, lingliTarget(LINGLI_TABLE_ALIASES.classes), [
      '班级编号', '班级ID', '班级名称', '课程名称', '名称', '班级状态', '开班状态', '状态', '班主任', '授课老师', '负责人',
      '开班日期', '上课日期', '更新时间',
    ]),
  ]) : [[], [], [], [], [], []];
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAt;
  const health = (recordCount: number) => ({ recordCount, durationMs, lastSuccessAt: completedAt, safeCode: null });
  return {
    wanjia: { summary: summarizeWanjia(merchants), records: buildWanjiaRecords(merchants), health: health(merchants.length), contractVersion: '1.3' },
    huahuo: { summary: summarizeHuahuo(projects, deliveries, receipts), records: buildHuahuoRecords(projects), health: health(projects.length + deliveries.length + receipts.length), contractVersion: '1.3' },
    lingli: {
      summary: summarizeLingli({ leads, students, income, costs, lessons, classes }, { asOf: completedAt }),
      records: buildLingliRecords(classes),
      health: health(leads.length + students.length + income.length + costs.length + lessons.length + classes.length),
      contractVersion: '1.6',
    },
    projects: { ...buildProjectsSource(projects, merchants, classes), health: health(projects.length + classes.length + 1), contractVersion: '1.6' },
    brain: { state: 'not_configured', note: 'Obsidian bridge not configured' },
    meta: { fetchedAt: completedAt, mode: 'read_only', contractVersion: '1.6' },
  };
}
