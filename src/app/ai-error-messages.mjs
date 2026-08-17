const SAFE_AI_MESSAGES = Object.freeze({
  authentication_required: '登录状态已失效，请重新登录后重试。',
  ai_not_configured: 'OpenAI 尚未配置，请在系统设置完成配置后重试。',
  ai_key_invalid: 'OpenAI 密钥无效，请更新后重试。',
  ai_access_denied: '当前 OpenAI 账户无权使用该能力，请检查账户权限。',
  ai_model_unavailable: '当前 OpenAI 模型不可用，请检查模型权限或配置。',
  ai_quota_exhausted: 'OpenAI 账户额度不足，请充值或更换可用密钥后重试。',
  ai_rate_limited: 'OpenAI 请求过于频繁，请稍后重试。',
  knowledge_context_read_failed: '知识库上下文暂时不可读，本次输入已保留，请稍后重试。',
});

export function safeAiErrorMessage(error) {
  return SAFE_AI_MESSAGES[String(error?.message || error || '')] || 'AI 暂时不可用，请稍后重试。';
}
