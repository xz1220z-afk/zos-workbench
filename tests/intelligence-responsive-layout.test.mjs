import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
const view = await readFile(new URL('../src/app/views/intelligence-view.mjs', import.meta.url), 'utf8');

test('intelligence toolbar and card actions use shrinkable wrapping tracks', () => {
  assert.match(css, /\.intelligence-workbench-toolbar\s*\{[^}]*repeat\(auto-fit,\s*minmax\(/s);
  assert.match(css, /\.intelligence-card\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.intelligence-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.intelligence-actions \.v13-action\s*\{[^}]*flex:/s);
});

test('intelligence empty state presents one explicit recovery action', () => {
  assert.match(view, /intelligence-empty-action/);
  assert.match(view, /data-refresh-intelligence/);
});

test('question drawer remains clickable above its backdrop', () => {
  assert.match(css, /\.intelligence-question-drawer\s*\{[^}]*z-index:\s*1200/s);
  assert.match(css, /\.task-drawer-backdrop\s*\{[^}]*z-index:\s*1198/s);
});
