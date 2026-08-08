function endpoint(baseUrl) {
  return new URL('/functions/v1/zos-ai-assistant', `${String(baseUrl || '').replace(/\/$/, '')}/`);
}

export function createAiAssistantClient({ url, anonKey, getAccessToken, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !anonKey || typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function') throw new Error('ai_client_configuration_invalid');
  return {
    async ask(payload = {}) {
      const token = await getAccessToken();
      if (!token) throw new Error('authentication_required');
      const response = await fetchImpl(endpoint(url), {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body = {};
      try { body = await response.json(); } catch { /* A safe generic error follows. */ }
      if (!response.ok) throw new Error(body?.error || 'ai_request_failed');
      if (body?.state !== 'answered' || typeof body.answer !== 'string') throw new Error('ai_response_contract_invalid');
      return body;
    },
  };
}
