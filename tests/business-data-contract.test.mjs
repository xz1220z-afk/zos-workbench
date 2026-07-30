import assert from 'node:assert/strict';
import { summarizeHuahuo, summarizeWanjia } from '../src/business-data-contract.mjs';

const wanjia = summarizeWanjia([
  { fields: { '商家名称': '甲店', '是否动销': true, '支付GMV': 1200, '核销GMV': 900, '视频投稿数': 3, '直播场次数': 1, '总预估佣金': 120 } },
  { fields: { '商家名称': '乙店', '是否动销': false, '支付GMV': 800, '核销GMV': 0, '视频投稿数': 1, '直播场次数': 0, '总预估佣金': 80 } },
]);

assert.deepEqual(wanjia, {
  source: 'wanjia-merchant-operations',
  totalMerchants: 2,
  activeMerchants: 1,
  paymentGmv: 2000,
  redeemedGmv: 900,
  videoPosts: 4,
  liveSessions: 1,
  estimatedCommission: 200,
});

const huahuo = summarizeHuahuo({
  projects: [
    { fields: { '项目状态': '进行中', '合同金额': 10000, '已收金额': 3000 } },
    { fields: { '项目状态': '已完成', '合同金额': 8000, '已收金额': 8000 } },
  ],
  deliveries: [
    { fields: { '交付状态': '待交付' } },
    { fields: { '交付状态': '已交付' } },
  ],
  receipts: [
    { fields: { '收款状态': '已收款', '收款金额': 5000 } },
    { fields: { '收款状态': '待收款', '收款金额': 1000 } },
  ],
});

assert.deepEqual(huahuo, {
  source: 'huahuo-project-delivery-receipt',
  activeProjects: 1,
  pendingDeliveries: 1,
  contractAmount: 18000,
  receivedAmount: 5000,
  outstandingAmount: 13000,
});

assert.equal(summarizeWanjia([]).totalMerchants, 0);
assert.equal(summarizeHuahuo({}).activeProjects, 0);

console.log('Business data contract checks passed');
