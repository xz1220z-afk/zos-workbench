import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('v1.9 renders the local shell before remote startup and updates without a forced reload', async () => {
  const [app, legacy, worker] = await Promise.all([
    readFile(new URL('src/app.mjs', root), 'utf8'),
    readFile(new URL('src/legacy-app.mjs', root), 'utf8'),
    readFile(new URL('sw.js', root), 'utf8'),
  ]);
  const startBody = app.slice(app.indexOf('async function start()'), app.indexOf('function stop()'));
  assert.ok(startBody.indexOf('renderAll();') < startBody.indexOf('startupWork = initializeRemote()'));
  assert.match(startBody, /initializeRemote\(\)\.catch/);
  assert.doesNotMatch(legacy, /controllerchange[\s\S]{0,180}window\.location\.reload\(\)/);
  assert.match(worker, /fetch\(assetUrl, \{ cache: 'reload' \}\)/);
  assert.match(worker, /zos-workbench-v1\.9\.0/);
});
