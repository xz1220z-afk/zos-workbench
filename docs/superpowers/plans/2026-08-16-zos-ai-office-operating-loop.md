# ZOS AI Office Operating Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing AI entry, Agent OS, controlled execution, goals and tasks into a visible AI Office operating loop without creating a second workspace.

**Architecture:** Add three pure derived-model modules for office status, execution history and continuity prompts. Compose those models in `src/app.mjs`, render them inside the existing dashboard and Agent OS views, and preserve all existing stores, routes and safety gates.

**Tech Stack:** Browser-native ES modules, existing ZOS state store and view system, Node built-in test runner, Supabase-backed PWA.

## Global Constraints

- Target version is `2.12.0`; do not publish before three-stage acceptance.
- No new framework, navigation system or duplicate workspace.
- No automatic Vault, Feishu, calendar, message, publication, payment, contract, permission or deletion actions.
- Do not persist raw audio, knowledge bodies, Feishu rows, secrets or private relationship text.
- Preserve `.superpowers/brainstorm/` and all existing user data.

---

### Task 1: Dynamic AI Office Status

**Files:**
- Create: `src/app/ai-office.mjs`
- Test: `tests/ai-office.test.mjs`

**Interfaces:**
- Consumes: `{ agents, agentRuns, taskArchives, now }`.
- Produces: `buildAiOffice(input): { summary, organizations, agents }`.

- [ ] Write failing tests proving status precedence, latest-task selection, dynamic organization grouping and REL-001 redaction.
- [ ] Run `node --test tests/ai-office.test.mjs` and verify failures are caused by the missing module.
- [ ] Implement pure normalization, latest-record selection and status rules.
- [ ] Run the focused test and existing Agent OS tests.
- [ ] Commit the independently working model.

### Task 2: Unified Execution Ledger

**Files:**
- Create: `src/app/execution-ledger.mjs`
- Modify: `src/app/ai-command-center.mjs`
- Test: `tests/execution-ledger.test.mjs`
- Test: `tests/ai-command-center.test.mjs`

**Interfaces:**
- Consumes: safe AI activities, Agent runs, task archives and approval summaries.
- Produces: `buildExecutionLedger(input, options): Array<LedgerEntry>` and an expanded safe activity record.

- [ ] Write failing tests for normalization, chronological ordering, status labels, limit handling and sensitive-field exclusion.
- [ ] Run the focused tests and verify the expected RED state.
- [ ] Implement minimal ledger normalization and safe AI activity metadata.
- [ ] Run focused AI-command and ledger tests.
- [ ] Commit the ledger model.

### Task 3: Continuity and Anti-Forget Prompts

**Files:**
- Create: `src/app/continuity-engine.mjs`
- Test: `tests/continuity-engine.test.mjs`

**Interfaces:**
- Consumes: `{ targets, gaps, tasks, agentRuns, aiCommand, now }`.
- Produces: `buildContinuityPrompts(input, options): Array<ContinuityPrompt>`.

- [ ] Write failing tests for target gaps without tasks, overdue tasks, completed Agent runs without follow-up, pending AI next steps, deduplication and private-content redaction.
- [ ] Run `node --test tests/continuity-engine.test.mjs` and verify RED.
- [ ] Implement deterministic rules that only recommend existing safe actions.
- [ ] Run the focused test and priority-engine tests.
- [ ] Commit the continuity model.

### Task 4: Compose Existing Views

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/app/views/agent-workbench-view.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `styles.css`
- Test: `tests/ai-office-ui.test.mjs`
- Test: `tests/app-composition.test.mjs`

**Interfaces:**
- Consumes: the three pure models from Tasks 1–3.
- Produces: `viewModel.aiOffice`, `viewModel.executionLedger`, `viewModel.continuityPrompts` and visible incremental sections.

- [ ] Write failing UI tests for office status, ledger, permission registry, dashboard prompts, no duplicate navigation and private redaction.
- [ ] Run focused UI tests and verify RED.
- [ ] Import and compose models only on dashboard or Agent pages.
- [ ] Render the new sections with existing buttons and routes; do not introduce direct external executors.
- [ ] Add responsive CSS using existing tokens, no `transition: all` and no large continuous blur.
- [ ] Run focused UI and integration tests.
- [ ] Commit view composition.

### Task 5: Version, Backup and Acceptance

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: versioned ES module imports under `src/`
- Modify: release contract tests
- Create: `docs/releases/zos-workbench-v2.12.0.md`
- Create: `docs/zos-ceo-os-v2.12.0-production-acceptance.md`

**Interfaces:**
- Consumes: verified v2.12 feature commits.
- Produces: an atomic PWA release candidate with documented rollback.

- [ ] Write/update release tests first and verify they fail against v2.11.0.
- [ ] Update all entry, manifest, service-worker cache and module query versions atomically to `2.12.0`.
- [ ] Run `node --test tests/*.test.mjs`, syntax checks and `git diff --check` three times from clean processes.
- [ ] Validate desktop 1440px, tablet 834px and mobile 390px for non-empty content, no horizontal overflow and console error count zero.
- [ ] Record exact evidence, rollback tag and uncompleted boundaries in release documents.
- [ ] Commit the release candidate; do not push or tag the final release until production acceptance passes.
