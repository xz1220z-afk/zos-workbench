import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('v2.10.0 release cache includes the mobile AI office module graph', async () => {
  const [sw, manifest, app, html] = await Promise.all([
    readFile(new URL('sw.js', root), 'utf8'),
    readFile(new URL('manifest.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('src/app.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  assert.match(sw, /zos-workbench-v2\.10\.0/);
  assert.equal(manifest.version, '2.10.0');
  assert.match(app, /APP_VERSION\s*=\s*'2\.10\.0'/);
  assert.match(html, /assets\/app\.css\?v=2\.10\.0/);
  assert.match(html, /src\/legacy-app\.mjs\?v=2\.10\.0/);
  assert.match(html, /src\/app\.mjs\?v=2\.10\.0/);
  for (const asset of [
    'src/app/content-growth.mjs', 'src/app/knowledge-workspace.mjs',
    'src/app/social-insight-center.mjs', 'src/app/agent-workbench.mjs',
    'src/app/data-durability.mjs', 'src/app/snapshot-repository.mjs',
    'src/app/company-cockpit.mjs', 'src/app/ritual-calendar.mjs', 'src/app/private-date-import.mjs',
    'src/app/homepage-presence.mjs', 'src/app/wanjia-history.mjs', 'src/app/agent-task-context.mjs',
    'src/app/settings-sync-bridge.mjs', 'src/app/wanjia-ops-navigation.mjs',
    'src/app/ai-command-center.mjs', 'src/app/intent-router.mjs',
    'src/app/controlled-execution.mjs', 'src/app/voice-input.mjs',
    'src/app/mobile-navigation.mjs', 'src/app/mobile-dashboard.mjs',
    'src/app/mobile-agent-directory.mjs', 'src/app/views/mobile-command-sheet.mjs',
    'src/app/views/content-growth-view.mjs', 'src/app/views/knowledge-workspace-view.mjs',
    'src/app/views/social-insights-view.mjs', 'src/app/views/agent-workbench-view.mjs',
    'src/app/views/company-cockpit-view.mjs',
    'src/app/views/ai-command-view.mjs',
  ]) assert.match(sw, new RegExp(asset.replaceAll('.', '\\.')), `${asset} must be cached`);
});
