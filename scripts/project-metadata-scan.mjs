#!/usr/bin/env node
// Project metadata scanner — local, read-only, no secrets.
//
// Reads a structured source export (feishu/manual JSON) and emits a
// `zos_business_cache`-compatible payload with source = 'projects'.
//
//   node scripts/project-metadata-scan.mjs <source.json> [--out out.json]
//
// The source file may be either:
//   - an array of project records, or
//   - an object with a `projects` array.
//
// Only METADATA is carried (id/name/type/status/owner/updatedAt/riskLevel/
// source). Any body/text fields are rejected by the contract validator.
//
// This script never writes to Supabase or to any source system; it only
// prints (or writes) the payload for a privileged Edge Function to cache.

import { readFileSync, writeFileSync } from 'node:fs';
import { buildProjectIndex, validateProjectIndex } from '../src/project-data.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      options.out = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else {
      positional.push(arg);
    }
  }
  return { source: positional[0], options };
}

function loadSource(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.projects)) return parsed.projects;
  throw new Error('source must be an array or { projects: [...] }');
}

function main() {
  const { source, options } = parseArgs(process.argv.slice(2));
  if (!source) {
    console.error('usage: node scripts/project-metadata-scan.mjs <source.json> [--out out.json]');
    process.exit(2);
  }

  const records = loadSource(source);
  const index = buildProjectIndex(records);
  validateProjectIndex(index);

  const json = JSON.stringify(index, null, 2);
  if (options.out) {
    writeFileSync(options.out, json, 'utf8');
    console.log(`wrote ${index.projects.length} project metadata entries -> ${options.out}`);
  } else {
    process.stdout.write(json);
  }
}

main();
