const CONFIG = Object.freeze({
  wanjia: {
    name: '万嘉网络', specialistAction: { targetId: 'merchantCenterRoot', label: '进入商家 360' },
    summary: [
      ['gmv', '支付 GMV', 'businessVolume', 'currency'],
      ['merchants', '商家总数', 'operations.total', 'number'],
      ['active_merchants', '动销商家', 'operations.active', 'number'],
    ],
    analysis: [
      ['merchant_growth', '商家增长', '商家主档、动销与跟进效率'],
      ['gmv_efficiency', 'GMV 与经营效率', '支付成交与动销结构'],
      ['delivery_risk', '履约与经营风险', '从待决策与项目状态识别异常'],
    ],
  },
  huahuo: {
    name: '花火影像', specialistAction: { targetId: 'availabilityCenterRoot', label: '进入档期查询' },
    summary: [
      ['projects', '进行中项目', 'projects.active', 'number'],
      ['pending', '待交付', 'projects.pendingDelivery', 'number'],
      ['received', '已收金额', 'finance.cashIn', 'currency'],
      ['outstanding', '待回款', 'finance.outstanding', 'currency'],
    ],
    analysis: [
      ['project_delivery', '项目交付', '项目阶段、拍摄、后期与交付节奏'],
      ['cash_collection', '回款与收入', '合同额、已收与待回款'],
      ['schedule_capacity', '档期与产能', '拍摄档期、人员与设备容量'],
    ],
  },
  lingli: {
    name: '玲丽教育', specialistAction: { targetId: 'lingliCenterRoot', label: '查看招生与课消明细' },
    summary: [
      ['leads', '招生线索', 'operations.leads', 'number'],
      ['students', '在读学员', 'operations.students', 'number'],
      ['received', '本月实收', 'finance.cashIn', 'currency'],
      ['profit', '本月毛利', 'finance.grossProfit', 'currency'],
    ],
    analysis: [
      ['lead_conversion', '招生转化', '线索、试听与报名转化'],
      ['student_consumption', '学员与课消', '在读、排课、出勤与课消'],
      ['class_profit', '班级与毛利', '班级产能、收入、成本与毛利'],
    ],
  },
});

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

export function buildCompanyCockpit(company, input = {}) {
  const config = CONFIG[company];
  if (!config) throw new Error('unsupported company');
  const operating = input.operating || {};
  const summary = config.summary.map(([key, label, path, format]) => {
    const metric = readPath(operating, path) || { value: null, source: 'unavailable' };
    return { key, label, format, value: metric.value ?? null, source: metric.source || 'unavailable', available: Number.isFinite(metric.value) };
  });
  const risks = (input.decisions || []).filter((item) => {
    const itemCompany = String(item.company || item.source || '').toLowerCase();
    return item.status === 'open' && itemCompany.includes(company);
  });
  const intelligence = (input.intelligence || []).filter((item) => (item.relevantCompanies || []).includes(company));
  return {
    company, name: config.name, summary,
    analysis: config.analysis.map(([key, title, description]) => ({ key, title, description, metrics: summary })),
    risks: risks.slice(0, 5), intelligence: intelligence.slice(0, 5),
    source: operating.health || { state: 'pending', updatedAt: null, recordCount: null, safeCode: null },
    specialistAction: config.specialistAction,
  };
}

export const COMPANY_COCKPIT_CONFIG = CONFIG;
