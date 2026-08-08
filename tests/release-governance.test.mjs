import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('every release keeps a feature ledger, acceptance evidence and exact readback gate', async () => {
  const [policy, ledger, script, readme] = await Promise.all([
    readFile(new URL('docs/release-governance.md', root), 'utf8'),
    readFile(new URL('docs/feature-ledger.md', root), 'utf8'),
    readFile(new URL('scripts/verify-release-readback.mjs', root), 'utf8'),
    readFile(new URL('README.md', root), 'utf8'),
  ]);

  for (const marker of ['发布前回读', '功能账本', 'Git 标签', '验收记录', '禁止备份']) {
    assert.match(policy, new RegExp(marker));
  }
  for (const marker of ['情报卡上下文问答', 'Apple 交互层', '保留的数据', '回滚']) {
    assert.match(ledger, new RegExp(marker));
  }
  assert.match(script, /index\.html/);
  assert.match(script, /manifest\.json/);
  assert.match(script, /sw\.js/);
  assert.match(script, /src\/app\.mjs/);
  assert.match(script, /HTTP/);
  assert.match(readme, /release-governance\.md/);
  assert.match(readme, /feature-ledger\.md/);
});
