function fieldsOf(record) {
  return record?.fields || {};
}

function numberOf(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(records, fieldName) {
  return (records || []).reduce((total, record) => total + numberOf(fieldsOf(record)[fieldName]), 0);
}

function isActiveMerchant(value) {
  return value === true || value === '是' || value === '已动销';
}

export function summarizeWanjia(records = []) {
  return {
    source: 'wanjia-merchant-operations',
    totalMerchants: records.length,
    activeMerchants: records.filter((record) => isActiveMerchant(fieldsOf(record)['是否动销'])).length,
    paymentGmv: sum(records, '支付GMV'),
    redeemedGmv: sum(records, '核销GMV'),
    videoPosts: sum(records, '视频投稿数'),
    liveSessions: sum(records, '直播场次数'),
    estimatedCommission: sum(records, '总预估佣金'),
  };
}

export function summarizeHuahuo({ projects = [], deliveries = [], receipts = [] } = {}) {
  const receivedAmount = receipts
    .filter((record) => fieldsOf(record)['收款状态'] === '已收款')
    .reduce((total, record) => total + numberOf(fieldsOf(record)['收款金额']), 0);
  const contractAmount = sum(projects, '合同金额');

  return {
    source: 'huahuo-project-delivery-receipt',
    activeProjects: projects.filter((record) => fieldsOf(record)['项目状态'] === '进行中').length,
    pendingDeliveries: deliveries.filter((record) => fieldsOf(record)['交付状态'] === '待交付').length,
    contractAmount,
    receivedAmount,
    outstandingAmount: Math.max(0, contractAmount - receivedAmount),
  };
}
