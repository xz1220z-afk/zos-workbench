import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('settings uses complete safe backup, merge restore and undo instead of legacy overwrite', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const legacy = await readFile(new URL('../src/legacy-app.mjs', import.meta.url), 'utf8');
  assert.match(html, /完整安全备份/);
  assert.match(html, /安全合并恢复/);
  assert.match(html, /撤销上次恢复/);
  assert.match(legacy, /ZOS_CEO_OS\.exportSafeBackup/);
  assert.match(legacy, /app\.previewBackupText/);
  assert.match(legacy, /app\.importBackupText/);
  assert.match(legacy, /app\.undoLastRestore/);
  assert.doesNotMatch(legacy, /导入将覆盖当前所有本地数据/);
});
