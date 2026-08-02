import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireUser } from '../_shared/auth.ts';
import { FeishuRequestError, getTenantAccessToken, listRecords, safeFeishuCode } from '../_shared/feishu.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function scalar(value: unknown): unknown {
  if (Array.isArray(value)) return value[0] ?? null;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return record.text ?? record.link ?? record.url ?? record.name ?? null;
  }
  return value;
}

function text(fields: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = scalar(fields[name]);
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function credibility(value: string) {
  return ({ 高: 'high', 中: 'medium', 低: 'low', high: 'high', medium: 'medium', low: 'low' } as Record<string, string>)[value] || 'medium';
}

function companies(value: string) {
  const result = new Set<string>();
  if (/万嘉|本地生活|商家|抖音/.test(value)) result.add('wanjia');
  if (/花火|影像|摄影|视频|婚礼/.test(value)) result.add('huahuo');
  if (/玲丽|教育|培训|招生|课程/.test(value)) result.add('lingli');
  if (/管理|战略|AI|效率|财务/.test(value) || !result.size) result.add('ceo');
  return [...result];
}

function timestamp(value?: string) {
  if (!value) return null;
  const numeric = Number(value);
  const milliseconds = Number.isFinite(numeric) ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : NaN;
  const date = Number.isFinite(milliseconds) ? new Date(milliseconds) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapRecord(record: { record_id?: string; fields?: Record<string, unknown>; last_modified_time?: string }) {
  const fields = record.fields || {};
  const title = text(fields, '标题');
  const summary = text(fields, '摘要', '影响分析');
  if (!record.record_id || !title || !summary) return null;
  const score = Number(scalar(fields['价值评分']));
  const suggestion = text(fields, '建议归属');
  const type = text(fields, '建议知识类型', '分类标签');
  return {
    external_id: record.record_id,
    title,
    source_name: text(fields, '来源名称', '来源平台') || '飞书情报候选池',
    source_url: text(fields, '来源链接'),
    published_at: text(fields, '发布时间') || null,
    captured_at: text(fields, '抓取时间') || new Date().toISOString(),
    credibility: credibility(text(fields, '可信度')),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    relevant_companies: companies(`${suggestion} ${type} ${title}`),
    tags: text(fields, '关联知识关键词', '分类标签').split(/[,，、]/).map((item) => item.trim()).filter(Boolean),
    fact_summary: summary,
    impact_analysis: text(fields, '影响分析'),
    suggested_action: text(fields, '建议动作', '摘要'),
    source_updated_at: timestamp(record.last_modified_time),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  let identity;
  try { identity = await requireUser(req); }
  catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return response({ error: 'service_not_configured' }, 503);
  const supabase = createClient(url, serviceRole);
  let refreshState = 'cached';

  if (new URL(req.url).searchParams.get('refresh') === 'feishu') {
    const appToken = Deno.env.get('FEISHU_INTELLIGENCE_APP_TOKEN');
    const tableId = Deno.env.get('FEISHU_INTELLIGENCE_TABLE_ID');
    if (!appToken || !tableId) refreshState = 'pending_configuration';
    else {
      try {
        const token = await getTenantAccessToken();
        const records = await listRecords(token, { appToken, tableId }, [
          '标题', '摘要', '影响分析', '抓取时间', '来源链接', '发布时间', '可信度',
          '关联知识关键词', '价值评分', '建议归属', '建议知识类型', '分类标签', '来源名称', '来源平台',
        ]);
        const rows = records.map(mapRecord).filter(Boolean).map((item) => ({ ...item, user_id: identity.user.id }));
        if (rows.length) {
          const { error } = await supabase.from('zos_intelligence_items').upsert(rows, { onConflict: 'user_id,external_id' });
          if (error) throw error;
        }
        refreshState = 'synced';
      } catch (error) {
        refreshState = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed';
      }
    }
  }

  const { data, error } = await supabase.from('zos_intelligence_items')
    .select('external_id,title,source_name,source_url,published_at,captured_at,credibility,score,relevant_companies,tags,fact_summary,impact_analysis,suggested_action,status,source_updated_at')
    .eq('user_id', identity.user.id).neq('status', 'ignored')
    .order('score', { ascending: false }).order('published_at', { ascending: false }).limit(100);
  if (error) return response({ error: 'intelligence_read_failed' }, 502);
  return response({ items: data || [], state: refreshState, mode: 'private_summary_cache', fetchedAt: new Date().toISOString() });
});
