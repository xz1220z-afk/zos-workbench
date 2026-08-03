import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('supabase/functions/zos-intelligence-data/index.ts', root), 'utf8');
const sharedSource = await readFile(new URL('supabase/functions/_shared/intelligence-data.ts', root), 'utf8');
const externalSource = await readFile(new URL('supabase/functions/_shared/external-intelligence.mjs', root), 'utf8');
const runtimeSource = `${source}\n${sharedSource}\n${externalSource}`;
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');

test('intelligence endpoint requires a real user and returns summaries only', () => {
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /zos_intelligence_items/);
  assert.match(runtimeSource, /FEISHU_INTELLIGENCE_APP_TOKEN/);
  assert.match(runtimeSource, /FEISHU_INTELLIGENCE_TABLE_ID/);
  assert.match(source, /readAihotSource\(/);
  assert.doesNotMatch(runtimeSource, /raw_body|article_body|full_content/i);
  assert.match(runtimeSource, /pending_configuration/);
});

test('Supabase verifies JWT for intelligence reads', () => {
  assert.match(config, /\[functions\.zos-intelligence-data\][\s\S]*?verify_jwt\s*=\s*true/);
});
