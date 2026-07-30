// Local Obsidian Enterprise Brain metadata scanner.
//
// Walks the vault, extracts METADATA ONLY (never note bodies), applies the
// exclusion rules from src/obsidian-metadata-index.mjs, and emits the
// read-only metadata index as JSON. Pure local filesystem — no network,
// no secrets, no Supabase keys.
//
// Usage:
//   node scripts/obsidian-metadata-scan.mjs [vaultPath] [--out index.json]
//
// The emitted JSON is meant to be uploaded to Supabase `zos_business_cache`
// (source = 'brain') by a trusted process / edge function, exactly like the
// 万嘉 / 花火 business summaries. The PWA only ever reads it back.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  isPathIncluded,
  extractNoteMetadata,
  buildMetadataIndex,
} from '../src/obsidian-metadata-index.mjs';

const DEFAULT_VAULT = '/Users/zhushuai/Documents/ZOS/enterprise-brain/Enterprise Brain 企业大脑';

function parseFrontmatter(raw) {
  const fm = {};
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let val = kv[2].trim();
    if (key === 'tags') {
      if (val.startsWith('[')) {
        fm.tags = val.slice(1, -1).split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
      } else if (val) {
        fm.tags = [val.replace(/^#/, '')];
      } else {
        fm.tags = [];
      }
    } else {
      fm[key] = val;
    }
  }
  return fm;
}

function extractInlineTags(body) {
  const tags = new Set();
  const re = /#([\p{L}\p{N}_\-/]+)/gu;
  let m;
  while ((m = re.exec(body)) !== null) tags.add(m[1]);
  tags.delete(''); // allow heading markers like # Title to be ignored via space check
  return [...tags];
}

function walk(dir, base, out) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, base, out);
    } else if (entry.toLowerCase().endsWith('.md')) {
      const rel = relative(base, full).split(sep).join('/');
      if (!isPathIncluded(rel)) continue;
      try {
        const raw = readFileSync(full, 'utf8');
        const fm = parseFrontmatter(raw);
        const body = raw.replace(/^---\n[\s\S]*?\n---/, '');
        const titleMatch = body.match(/^#\s+(.+)$/m);
        const title = (fm.title || (titleMatch ? titleMatch[1] : entry.replace(/\.md$/i, ''))).trim();
        const tags = Array.from(new Set([...(fm.tags || []), ...extractInlineTags(body)]));
        out.push(extractNoteMetadata({
          relativePath: rel,
          title,
          tags,
          mtime: st.mtimeMs,
        }));
      } catch (err) {
        process.stderr.write(`skip ${rel}: ${err.message}\n`);
      }
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  let vault = DEFAULT_VAULT;
  let outFile = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outFile = args[++i];
    else if (!args[i].startsWith('--')) vault = args[i];
  }
  const notes = [];
  walk(vault, vault, notes);
  const index = buildMetadataIndex(notes);
  const json = JSON.stringify(index, null, 2);
  if (outFile) {
    writeFileSync(outFile, json);
    process.stdout.write(`Wrote ${index.notes.length} metadata entries to ${outFile}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
}

main();
