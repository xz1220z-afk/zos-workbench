import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyOpenAiUpstreamError } from '../supabase/functions/_shared/openai-upstream-errors.mjs';
import { safeAiErrorMessage } from '../src/app/ai-error-messages.mjs';

test('OpenAI upstream failures expose only bounded safe codes', () => {
  assert.equal(classifyOpenAiUpstreamError(401, 'invalid_api_key'), 'ai_key_invalid');
  assert.equal(classifyOpenAiUpstreamError(403, 'access_denied'), 'ai_access_denied');
  assert.equal(classifyOpenAiUpstreamError(404, 'model_not_found'), 'ai_model_unavailable');
  assert.equal(classifyOpenAiUpstreamError(429, 'insufficient_quota'), 'ai_quota_exhausted');
  assert.equal(classifyOpenAiUpstreamError(429, 'rate_limit_exceeded'), 'ai_rate_limited');
  assert.equal(classifyOpenAiUpstreamError(500, 'internal_error'), 'ai_upstream_failed');
  assert.equal(classifyOpenAiUpstreamError(400, 'untrusted secret text'), 'ai_upstream_failed');
});

test('AI UI maps safe codes to actionable Chinese without reflecting upstream details', () => {
  assert.equal(safeAiErrorMessage(new Error('ai_key_invalid')), 'OpenAI 密钥无效，请更新后重试。');
  assert.equal(safeAiErrorMessage(new Error('ai_quota_exhausted')), 'OpenAI 账户额度不足，请充值或更换可用密钥后重试。');
  assert.equal(safeAiErrorMessage(new Error('ai_rate_limited')), 'OpenAI 请求过于频繁，请稍后重试。');
  assert.equal(safeAiErrorMessage(new Error('untrusted secret text')), 'AI 暂时不可用，请稍后重试。');
});
