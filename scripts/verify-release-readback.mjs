#!/usr/bin/env node

const args = process.argv.slice(2);
const option = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : fallback;
};

const version = option('--version');
const base = option('--base', 'https://xz1220z-afk.github.io/zos-workbench/');

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/verify-release-readback.mjs --version X.Y.Z [--base URL]');
  process.exit(2);
}

const root = new URL(base.endsWith('/') ? base : `${base}/`);
const checks = [
  ['index.html', (body) => body.includes(`?v=${version}`)],
  ['manifest.json', (body) => JSON.parse(body).version === version],
  ['sw.js', (body) => body.includes(`zos-workbench-v${version}`)],
  ['src/app.mjs', (body) => body.includes(`APP_VERSION = '${version}'`)],
];

let failed = false;
for (const [asset, validate] of checks) {
  const url = new URL(`${asset}?readback=${Date.now()}`, root);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.text();
    const valid = response.ok && validate(body);
    console.log(`${valid ? 'PASS' : 'FAIL'} HTTP ${response.status} ${asset}`);
    if (!valid) failed = true;
  } catch (error) {
    console.log(`FAIL HTTP unavailable ${asset}: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`PASS release readback v${version}`);

