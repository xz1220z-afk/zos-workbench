import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { AGENT_OS_INDEX_SCHEMA_VERSION, validateAgentOsIndex } from './app/agent-os-index-contract.mjs?v=2.9.0';

const DIRECTORY_DEFINITIONS = Object.freeze([
  { directory: '02 Agents', collection: 'agents', idKey: 'agent_id', outputKey: 'agentId' },
  { directory: '03 Skills Registry', collection: 'skills', idKey: 'skill_id', outputKey: 'skillId' },
  { directory: '04 Workflows', collection: 'workflows', idKey: 'workflow_id', outputKey: 'workflowId' },
  { directory: '05 Evaluations', collection: 'evaluations', idKey: 'evaluation_id', outputKey: 'evaluationId', includeWithoutId: true },
  { directory: '06 Logs', collection: 'logs', idKey: 'task_id', outputKey: 'logId', includeWithoutId: true },
  { directory: '07 Runbooks', collection: 'runbooks', idKey: 'id', outputKey: 'runbookId', includeWithoutId: true },
]);

const SECTION_ALIASES = Object.freeze({
  mission: ['mission', '使命', '目标'],
  scopeIn: ['scope in', '范围内', '最小知识范围'],
  scopeOut: ['scope out', '范围外'],
  allowedActions: ['allowed actions', '允许动作'],
  forbiddenActions: ['human approval', '红线', '运行边界', '禁止动作'],
  outputContract: ['output contract', '输出'],
  fallback: ['fallback', '回退'],
  knowledge: ['context', 'read paths', 'knowledge', '知识入口'],
});

function frontmatter(text) {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) return [];
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    return [[key, value]];
  }));
}

function cleanLine(line) {
  return line
    .replace(/^\s*(?:[-*+] |\d+[.)] )/, '')
    .replace(/^>\s?(?:\[![^\]]+\]\s*)?/, '')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/[*_`#]/g, '')
    .trim();
}

function compactSection(lines, limit = 420) {
  const nonEmpty = lines.filter((line) => String(line || '').trim());
  const listLines = nonEmpty.filter((line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line));
  // Identity-card prose is reduced to its first paragraph. Structured lists may
  // keep several entries, but arbitrary trailing Markdown body is never copied.
  const selected = listLines.length ? listLines.slice(0, 12) : nonEmpty.slice(0, 1);
  const value = selected.map(cleanLine).filter(Boolean).join('；').replace(/；+/g, '；');
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function sections(text) {
  const output = {};
  const lines = String(text || '').split(/\r?\n/);
  let current = null;
  let buffer = [];
  const flush = () => {
    if (current && buffer.length) output[current] = compactSection(buffer);
    buffer = [];
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      const normalized = cleanLine(heading[1]).toLowerCase();
      current = Object.entries(SECTION_ALIASES)
        .find(([, aliases]) => aliases.some((alias) => normalized === alias || normalized.includes(alias)))?.[0] || null;
      continue;
    }
    if (current && !/^#{1,6}\s/.test(line)) buffer.push(line);
  }
  flush();
  if (!output.mission) {
    const body = String(text || '').replace(/^---[\s\S]*?---\s*/, '');
    const paragraphs = body.split(/\r?\n\s*\r?\n/)
      .map((paragraph) => compactSection(paragraph.split(/\r?\n/)))
      .filter((value) => value && !value.startsWith('#'));
    if (paragraphs[0]) output.mission = paragraphs[0].slice(0, 420);
  }
  return output;
}

function wikilinks(text) {
  return [...String(text || '').matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1].trim()).filter(Boolean);
}

function ids(text, pattern) {
  return [...new Set(String(text || '').match(pattern) || [])].sort();
}

function allAgentIds(text) {
  return ids(text, /\b(?:JARVIS|KNOWLEDGE|ERP|FIN|BUILDER|WANJIA|WJ-[A-Z]+|HUAHUO|HH-[A-Z]+|LL-[A-Z]+|LIFE-[A-Z]+|HEALTH|REL|LEARN)-\d{3}\b/g);
}

async function markdownFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return []; }
  const output = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) output.push(path);
  }
  return output.sort();
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}

function safeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function recordFor(root, path, definition) {
  const text = await readFile(path, 'utf8');
  const metadata = frontmatter(text);
  const primaryId = metadata[definition.idKey] || (definition.includeWithoutId ? metadata.id || null : null);
  if (!primaryId && !definition.includeWithoutId) return null;
  const fileStat = await stat(path);
  const agentIds = allAgentIds(text);
  const record = {
    ...(primaryId ? { [definition.outputKey]: primaryId } : {}),
    name: metadata.name || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.split(sep).at(-1).replace(/\.md$/i, ''),
    status: metadata.status || 'draft',
    confidentiality: metadata.confidentiality || 'internal',
    version: metadata.version || null,
    updatedAt: metadata.updated || metadata.created || safeDate(fileStat.mtimeMs),
    relativePath: relativePath(root, path),
    hash: createHash('sha256').update(text).digest('hex'),
    mtime: safeDate(fileStat.mtimeMs),
    agentIds,
  };
  if (definition.collection === 'agents') {
    record.category = metadata.category || null;
    record.company = metadata.company || null;
    record.domain = metadata.domain || null;
    record.business = metadata.business || null;
    record.sections = sections(text);
    record.skillIds = ids(text, /\bSK-[A-Z]+-\d{3}\b/g);
    record.workflowIds = ids(text, /\bWF-[A-Z]+-\d{3}\b/g);
    record.evidenceIds = ids(text, /\bEV-[A-Z-]+-\d{3}\b/g);
    record.logIds = ids(text, /\bPILOT-[A-Z]+-\d{3}\b/g);
    record.knowledgeEntries = wikilinks(text).slice(0, 20);
  }
  return record;
}

function attachRelations(index) {
  const agents = index.agents.map((agent) => ({ ...agent }));
  const collections = [...index.skills, ...index.workflows, ...index.evaluations, ...index.logs, ...index.runbooks];
  for (const agent of agents) {
    const related = collections.filter((record) => record.agentIds?.includes(agent.agentId));
    agent.skillIds = [...new Set([...agent.skillIds, ...related.map((item) => item.skillId).filter(Boolean)])].sort();
    agent.workflowIds = [...new Set([...agent.workflowIds, ...related.map((item) => item.workflowId).filter(Boolean)])].sort();
    agent.evidenceIds = [...new Set([...agent.evidenceIds, ...related.map((item) => item.evaluationId).filter(Boolean)])].sort();
    agent.logIds = [...new Set([...agent.logIds, ...related.map((item) => item.logId).filter(Boolean)])].sort();
    agent.runbookIds = related.map((item) => item.runbookId).filter(Boolean).sort();
  }
  return { ...index, agents };
}

export async function buildAgentOsIndex(root, options = {}) {
  const sourceRoot = resolve(root);
  const index = {
    schemaVersion: AGENT_OS_INDEX_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceRoot: options.sourceRootLabel || sourceRoot.split(sep).at(-1),
    agents: [], skills: [], workflows: [], evaluations: [], logs: [], runbooks: [],
  };
  for (const definition of DIRECTORY_DEFINITIONS) {
    for (const path of await markdownFiles(resolve(sourceRoot, definition.directory))) {
      const record = await recordFor(sourceRoot, path, definition);
      if (record) index[definition.collection].push(record);
    }
  }
  return validateAgentOsIndex(attachRelations(index));
}

export { AGENT_OS_INDEX_SCHEMA_VERSION, validateAgentOsIndex };
