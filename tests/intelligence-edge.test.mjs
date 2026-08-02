import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('supabase/functions/zos-intelligence-data/index.ts', root), 'utf8');
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');

test('intelligence endpoint requires a real user and returns summaries only', () => {
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /zos_intelligence_items/);
  assert.match(source, /FEISHU_INTELLIGENCE_APP_TOKEN/);
  assert.match(source, /FEISHU_INTELLIGENCE_TABLE_ID/);
  assert.doesNotMatch(source, /raw_body|article_body|full_content/i);
  assert.match(source, /pending_configuration/);
});

test('Supabase verifies JWT for intelligence reads', () => {
  assert.match(config, /\[functions\.zos-intelligence-data\][\s\S]*?verify_jwt\s*=\s*true/);
});

