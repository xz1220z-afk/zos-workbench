import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, legacy] = await Promise.all([
  readFile(new URL('assets/app.css', root), 'utf8'),
  readFile(new URL('src/legacy-app.mjs', root), 'utf8'),
]);

test('primary controls share one responsive press contract instead of generic transition all', () => {
  assert.match(css, /--motion-page:\s*220ms/);
  assert.match(css, /:where\(\.v13-action,\s*\.nav-item,\s*\.workspace-switch button,\s*\.bottom-nav-item,\s*\.company-overview button\)[^{]*\{[^}]*min-height:\s*44px[^}]*transition:\s*transform/s);
  assert.match(css, /:where\(\.v13-action,\s*\.nav-item,\s*\.workspace-switch button,\s*\.bottom-nav-item,\s*\.company-overview button\):active\s*\{[^}]*scale\(\.98\)/s);
  const navRule = css.match(/\.nav-item\s*\{[^}]*\}/s)?.[0] || '';
  assert.doesNotMatch(navRule, /transition:\s*all/);
});

test('route changes use a short content-level entry transition with a reduced-motion fallback', () => {
  assert.match(css, /\.page\.is-entering\s*\{[^}]*animation:\s*pageEnter/s);
  assert.match(css, /@keyframes\s+pageEnter\s*\{[\s\S]*opacity:\s*\.94[\s\S]*translateY\(3px\)[\s\S]*translateY\(0\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.page\.is-entering\s*\{[^}]*animation:\s*none/s);
  assert.match(legacy, /target\.classList\.add\('is-entering'\)/);
  assert.match(legacy, /requestAnimationFrame\([\s\S]*target\.classList\.remove\('is-entering'\)/);
});
