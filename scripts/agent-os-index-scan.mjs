#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAgentOsIndex } from '../src/agent-os-index.mjs';

const args = process.argv.slice(2);
const root = args.find((value) => !value.startsWith('--'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;

if (!root) {
  console.error('Usage: node scripts/agent-os-index-scan.mjs <agent-os-root> [--output agent-os-index.json]');
  process.exitCode = 1;
} else {
  const index = await buildAgentOsIndex(resolve(root));
  const json = `${JSON.stringify(index, null, 2)}\n`;
  if (output) await writeFile(resolve(output), json, 'utf8');
  else process.stdout.write(json);
}

