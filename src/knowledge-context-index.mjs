const ALLOWED_SCOPES = new Set(['general', 'work', 'life', 'learning']);
const FORBIDDEN_FIELDS = new Set(['content', 'body', 'text', 'markdown', 'raw', 'privateNotes']);
const SECRET_PATTERN = /(?:sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{16,}|api[_ -]?key\s*[:=])/i;

function text(value, field, max) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) throw new Error(`knowledge_${field}_invalid`);
  return normalized;
}

export function normalizeKnowledgeContextIndex(input = {}) {
  const chunks = Array.isArray(input?.chunks) ? input.chunks : null;
  if (!chunks || chunks.length > 500) throw new Error('knowledge_chunks_invalid');
  const ids = new Set();
  return {
    version: '1',
    chunks: chunks.map((item) => {
      if (!item || typeof item !== 'object') throw new Error('knowledge_chunk_invalid');
      if (Object.keys(item).some((key) => FORBIDDEN_FIELDS.has(key))) throw new Error('knowledge_forbidden_field');
      const chunkId = text(item.chunkId, 'chunk_id', 160);
      if (ids.has(chunkId)) throw new Error('knowledge_chunk_duplicate');
      ids.add(chunkId);
      const scope = String(item.scope || 'general').trim().toLowerCase();
      if (!ALLOWED_SCOPES.has(scope)) throw new Error('knowledge_scope_not_allowed');
      const sourceRef = text(item.sourceRef, 'source_ref', 280);
      if (/^(?:\/|[A-Za-z]:[\\/])/.test(sourceRef)) throw new Error('knowledge_source_ref_must_be_relative');
      const excerpt = text(item.excerpt, 'excerpt', 1400);
      if (SECRET_PATTERN.test(excerpt)) throw new Error('knowledge_secret_detected');
      const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 12) : [];
      return { chunkId, title: text(item.title, 'title', 180), sourceRef, scope, excerpt, tags, contentHash: text(item.contentHash, 'content_hash', 160), updatedAt: item.updatedAt ? String(item.updatedAt) : null };
    }),
  };
}
