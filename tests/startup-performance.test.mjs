import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

function runLocalFileGuard(html, location) {
  const source = html.match(/<script data-local-file-redirect>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source, 'the static shell must include an executable local-file guard');
  vm.runInNewContext(source, { window: { location } });
}

test('v2.0 renders the local shell before remote startup and updates without a forced reload', async () => {
  const [app, legacy, worker] = await Promise.all([
    readFile(new URL('src/app.mjs', root), 'utf8'),
    readFile(new URL('src/legacy-app.mjs', root), 'utf8'),
    readFile(new URL('sw.js', root), 'utf8'),
  ]);
  const startBody = app.slice(app.indexOf('async function start()'), app.indexOf('function stop()'));
  assert.ok(startBody.indexOf('renderAll();') < startBody.indexOf('const remoteStartup = initializeRemote()'));
  assert.match(startBody, /initializeRemote\(\)\.catch/);
  assert.doesNotMatch(legacy, /controllerchange[\s\S]{0,180}window\.location\.reload\(\)/);
  assert.match(worker, /fetch\(assetUrl, \{ cache: 'reload' \}\)/);
  assert.match(worker, /zos-workbench-v2\.9\.0/);
});

test('double-clicking index.html redirects immediately to the official app while https stays in place', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const redirected = [];
  runLocalFileGuard(html, {
    protocol: 'file:', hash: '#calendar',
    replace(url) { redirected.push(url); },
  });
  assert.deepEqual(redirected, ['https://xz1220z-afk.github.io/zos-workbench/?v=2.9.0#calendar']);

  const onlineRedirected = [];
  runLocalFileGuard(html, {
    protocol: 'https:', hash: '#calendar',
    replace(url) { onlineRedirected.push(url); },
  });
  assert.deepEqual(onlineRedirected, []);
});
