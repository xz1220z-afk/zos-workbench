import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

test('Wanjia console contains wide merchant tables without expanding the page grid', () => {
  assert.match(css, /\.wanjia-shell\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.wanjia-shell\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.wanjia-table-wrap\s*\{[^}]*width:\s*100%[^}]*overflow-x:\s*auto/);
});
