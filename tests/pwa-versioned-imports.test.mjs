import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

async function moduleFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? moduleFiles(join(directory, entry.name))
    : entry.name.endsWith('.mjs') ? [join(directory, entry.name)] : []));
  return nested.flat();
}

test('every browser module import is release-versioned so an old service worker cannot mix module generations', async () => {
  const failures = [];
  for (const file of await moduleFiles(root)) {
    const source = await readFile(file, 'utf8');
    const imports = [...source.matchAll(/(?:from\s+|import\s*\()["'](\.{1,2}\/[^"']+\.mjs(?:\?[^"']*)?)["']/g)];
    for (const match of imports) {
      if (!match[1].endsWith('?v=2.11.0')) failures.push(`${file.slice(root.length + 1)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('service worker caches the static mobile Agent directory module', async () => {
  const serviceWorker = await readFile(join(root, '..', 'sw.js'), 'utf8');
  assert.match(serviceWorker, /'src\/app\/mobile-agent-directory\.mjs'/);
});
