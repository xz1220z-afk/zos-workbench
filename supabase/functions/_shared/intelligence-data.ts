import { getTenantAccessToken, listRecords } from './feishu.ts';
import { mapIntelligenceRecord } from './intelligence-values.mjs';

const INTELLIGENCE_FIELDS = [
  '标题', '摘要', '影响分析', '抓取时间', '来源链接', '发布时间', '可信度',
  '关联知识关键词', '价值评分', '建议归属', '建议知识类型', '分类标签', '来源名称', '来源平台',
];

export class IntelligenceConfigurationError extends Error {
  code = 'pending_configuration';
}

export async function readIntelligenceSource() {
  const appToken = Deno.env.get('FEISHU_INTELLIGENCE_APP_TOKEN');
  const tableId = Deno.env.get('FEISHU_INTELLIGENCE_TABLE_ID');
  if (!appToken || !tableId) throw new IntelligenceConfigurationError('intelligence source not configured');
  const token = await getTenantAccessToken();
  const records = await listRecords(token, { appToken, tableId }, INTELLIGENCE_FIELDS);
  return records.map((record) => mapIntelligenceRecord(record)).filter(Boolean);
}
