import { detectRisks } from '../risk-detector.mjs?v=2.1.0';
import { reconcileDecisions } from './decision-center.mjs?v=2.1.0';
import {
  METRIC_CATALOG, actualMetrics, buildDailySnapshots, calculateGap, validateTarget,
} from './targets.mjs?v=2.1.0';
import { classifySourceHealth } from './source-health.mjs?v=2.1.0';
import { generateCeoBrief, shouldGenerateBrief } from './daily-brief.mjs?v=2.1.0';
import { humanText } from './value-utils.mjs?v=2.1.0';

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function decisionItems(source, records, risks) {
  const recordById = new Map(records.map((record) => [String(record.id), record]));
  return risks.map((risk) => {
    const record = recordById.get(risk.recordId) || {};
    return {
      ...risk,
      source,
      sourceRecordId: record.sourceRecordId || risk.recordId,
      category: risk.reasons?.[0]?.code || 'risk',
      factSummary: `${humanText(risk.name, humanText(record.merchantName || record.projectName || record.name, String(risk.recordId)))}：${risk.reasons.map((reason) => reason.label).join('；')}`,
      recommendedAction: '请核对负责人、下一步和完成时间',
      severity: risk.level === '高' ? 'high' : 'medium',
      sourceUpdatedAt: record.updatedAt || null,
    };
  });
}

export function createOperatingLoop({
  userId,
  deviceId,
  now = () => new Date().toISOString(),
  date = () => now().slice(0, 10),
  refreshBusiness,
  approvalClient,
  saveSnapshots = async () => {},
  saveHealth = async () => {},
  getTasks = () => [],
  initialState = {},
} = {}) {
  required(userId, 'userId');
  required(deviceId, 'deviceId');
  required(refreshBusiness, 'refreshBusiness');
  required(approvalClient, 'approvalClient');

  const state = {
    sources: clone(initialState.sources) || {},
    decisions: clone(initialState.decisions) || [],
    targets: clone(initialState.targets) || [],
    gaps: clone(initialState.gaps) || [],
    briefs: clone(initialState.briefs) || [],
    health: clone(initialState.health) || [],
    conflicts: clone(initialState.conflicts) || [],
    approvals: clone(initialState.approvals) || [],
  };

  function briefInput() {
    return {
      wanjia: state.sources.wanjia,
      huahuo: state.sources.huahuo,
      targetGaps: state.gaps,
      decisions: state.decisions,
      health: state.health,
      risks: state.decisions.filter((item) => item.status === 'open'),
      calendarConflicts: state.conflicts,
      tasks: clone(getTasks()) || [],
    };
  }

  return {
    getState() { return clone(state); },

    updateDecision(decision) {
      const id = required(decision?.id, 'decision id');
      const index = state.decisions.findIndex((item) => item.id === id);
      if (index === -1) throw new Error(`decision not found: ${id}`);
      state.decisions[index] = clone(decision);
      return clone(state.decisions[index]);
    },

    async refresh(source) {
      const facts = await refreshBusiness(source);
      state.sources[source] = clone(facts);
      const health = classifySourceHealth({ source, ...(facts.health || {}) }, { now: now() });
      state.health = [...state.health.filter((item) => item.source !== source), health];
      await saveHealth(clone(health));

      const metrics = actualMetrics(state.sources);
      await saveSnapshots(buildDailySnapshots(metrics, {
        userId, date: date(), contractVersion: '1.3',
      }));

      const sourceRecords = Array.isArray(facts.records)
        ? facts.records
        : (Array.isArray(facts.records?.records) ? facts.records.records : []);
      const sourceRisks = ['wanjia', 'huahuo'].includes(source)
        ? detectRisks(sourceRecords, source, { asOf: new Date(now()) })
        : [];
      const existingForSource = state.decisions.filter((item) => item.source === source);
      const otherSources = state.decisions.filter((item) => item.source !== source);
      const reconciled = reconcileDecisions(
        existingForSource,
        decisionItems(source, sourceRecords, sourceRisks),
        { now: now(), deviceId },
      );
      state.decisions = [...otherSources, ...reconciled].sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));
      return clone(facts);
    },

    confirmTargets(targets = []) {
      state.targets = targets.map((target) => validateTarget(target));
      const metrics = actualMetrics(state.sources);
      state.gaps = state.targets.map((target) => ({
        ...target,
        label: METRIC_CATALOG[target.metricKey].label,
        target: target.value,
        ...calculateGap(target, metrics[target.metricKey]?.value),
      }));
      return clone(state.gaps);
    },

    ensureDailyBrief() {
      const input = briefInput();
      const today = date();
      if (shouldGenerateBrief(state.briefs, input, { date: today })) {
        state.briefs.push(generateCeoBrief(input, { date: today, now: now() }));
      }
      return clone([...state.briefs].reverse().find((brief) => brief.date === today));
    },

    setConflicts(conflicts = []) {
      state.conflicts = clone(conflicts);
      return clone(state.conflicts);
    },

    async previewFeishu(proposal) {
      const approval = await approvalClient.preview(clone(proposal));
      state.approvals = [...state.approvals.filter((item) => item.approvalId !== approval.approvalId), clone(approval)];
      return clone(approval);
    },

    async executeFeishu(approvalId) {
      const result = await approvalClient.execute(approvalId);
      if (result?.verified !== true) throw new Error('readback verification required');
      state.approvals = state.approvals.map((item) => item.approvalId === approvalId ? { ...item, ...clone(result) } : item);
      return clone(result);
    },
  };
}
