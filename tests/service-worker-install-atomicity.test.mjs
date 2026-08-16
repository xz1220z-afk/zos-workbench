import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const CACHE_NAME = 'zos-workbench-v2.12.0';

async function installHarness({ failingAsset }) {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const cacheNames = new Set(['zos-workbench-v2.9.0']);
  const deleted = [];
  const cachedAssets = [];
  let skipWaitingCalls = 0;
  let installation;
  const cache = {
    put: async (assetUrl) => { cachedAssets.push(assetUrl); },
  };
  const context = {
    URL,
    console: { error() {} },
    fetch: async (assetUrl) => assetUrl.includes(failingAsset)
      ? { ok: false, status: 503 }
      : { ok: true, status: 200 },
    caches: {
      open: async (name) => { cacheNames.add(name); return cache; },
      delete: async (name) => { deleted.push(name); return cacheNames.delete(name); },
      keys: async () => [...cacheNames],
      match: async () => undefined,
    },
    self: {
      location: { origin: 'https://example.test' },
      registration: { scope: 'https://example.test/zos-workbench/' },
      addEventListener: (type, handler) => listeners.set(type, handler),
      skipWaiting: async () => { skipWaitingCalls += 1; },
    },
  };
  vm.runInNewContext(source, context, { filename: 'sw.js' });
  listeners.get('install')({ waitUntil: (promise) => { installation = promise; } });
  return { cachedAssets, cacheNames, deleted, installation, skipWaitingCalls: () => skipWaitingCalls };
}

test('a failed precache install removes only the partial new generation and rejects before activation can delete an old cache', async () => {
  const harness = await installHarness({ failingAsset: 'src/data-model.mjs' });

  await assert.rejects(harness.installation, /Failed to refresh .*503/);
  assert.ok(harness.cachedAssets.length > 0, 'the failure must occur after the new cache has received entries');
  assert.deepEqual(harness.deleted, [CACHE_NAME]);
  assert.equal(harness.cacheNames.has(CACHE_NAME), false);
  assert.equal(harness.cacheNames.has('zos-workbench-v2.9.0'), true);
  assert.equal(harness.skipWaitingCalls(), 0);
});
