# ZOS v2 Content Growth Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and release the approved ZOS v2.0 content-growth, knowledge-reading, intelligence, Agent and asset-compounding workflows without weakening the existing source-of-truth or approval boundaries.

**Architecture:** Extend the existing local-first record store with focused domain modules and route-owned views. New collections reuse the current revision, tombstone, sync, retry, conflict and backup infrastructure; a generic authenticated Supabase record table remains the cloud transport. The browser loads the current route immediately and delays remote work so the executive home never waits for content, knowledge or analytics modules.

**Tech Stack:** Static HTML/CSS, native ES modules, Node test runner, localStorage, Supabase/PostgREST, GitHub Pages PWA.

## Global Constraints

- Release version is `2.0.0`; every browser import, service-worker cache name, manifest and visible version label must match.
- Feishu ERP, contracts and platform backends remain current business fact sources.
- Enterprise Brain remains the long-term knowledge source; Obsidian note bodies are not uploaded.
- External publishing, messages and business-fact writes require explicit human approval.
- All empty states must identify the real missing input or connector; no sample metrics may appear as live data.
- Desktop, tablet and mobile controls must remain usable with 44px touch targets and no horizontal page overflow.
- Preserve the existing `.superpowers/` and `package-lock.json` user-owned untracked files.

---

## File Map

**Create domain modules**

- `src/app/content-growth.mjs`: content stages, platform variants, metrics, experiments and compounding candidates.
- `src/app/knowledge-workspace.mjs`: reading items, highlights, knowledge cards, brainstorm nodes and reading reviews.
- `src/app/social-insight-center.mjs`: social evidence normalization, opportunity ranking and company routing.
- `src/app/agent-workbench.mjs`: approved agent catalog, run drafts, action boundaries and run summaries.

**Create views**

- `src/app/views/content-growth-view.mjs`: pipeline, studio, assets, analytics, experiments and compounding tabs.
- `src/app/views/agent-workbench-view.mjs`: agent catalog, runner and run history.
- `src/app/views/knowledge-workspace-view.mjs`: reading, cards, graph, brainstorm and shelf areas embedded in Enterprise Brain.

**Modify composition and platform files**

- `src/app/state-store.mjs`, `src/sync-engine.mjs`, `src/app/search-center.mjs`: collections, conflicts, cloud payloads and search indexing.
- `src/app.mjs`, `src/app/router.mjs`, `index.html`, `assets/app.css`: state composition, routes, page shells, interactions and responsive visual system.
- `sw.js`, `manifest.webmanifest`, `README.md`: release and cache version.
- `src/sync-engine.mjs`: compatibility namespace for new logical entity types without a production schema change.

**Create/modify tests**

- `tests/content-growth.test.mjs`
- `tests/knowledge-workspace.test.mjs`
- `tests/social-insight-center.test.mjs`
- `tests/agent-workbench.test.mjs`
- `tests/v2-ui.test.mjs`
- `tests/v2-sync.test.mjs`
- `tests/v2-performance.test.mjs`
- existing version and full-regression tests.

---

### Task 1: Isolated release workspace and v2 record collections

**Files:**
- Modify: `src/app/state-store.mjs`
- Modify: `src/sync-engine.mjs`
- Create: `tests/v2-sync.test.mjs`

**Interfaces:**
- Produces: `V2_ENTITY_TYPES`, generic `saveEntity/deleteEntity/restoreEntity` support and cloud round-trip for all nine new collections.

- [ ] **Step 1: Create an isolated `codex/zos-v2-content-growth` worktree from the spec commit.**
- [ ] **Step 2: Write failing tests that save, update, soft-delete, restore and cloud-round-trip each new collection.**

```js
for (const entityType of ['content_items','knowledge_cards','reading_items','agent_runs','social_insights','content_assets','brainstorms','content_experiments','compound_candidates']) {
  const row = store.saveEntity(entityType, { title: entityType });
  assert.equal(store.load().collections[entityType][0].id, row.id);
  store.deleteEntity(entityType, row.id);
  assert.equal(store.load().tombstones.at(-1).entity, entityType);
  store.restoreEntity(entityType, row.id);
}
```

- [ ] **Step 3: Run `node --test tests/v2-sync.test.mjs` and confirm it fails with `unsupported entity type`.**
- [ ] **Step 4: Add the nine collection names to the state store and include content/knowledge/agent records in conflict detection where unreviewed work must not be overwritten.**
- [ ] **Step 5: Run the test and full `node --test tests/*.test.mjs`; commit `feat: add v2 workspace collections`.**

### Task 2: Content lifecycle, analytics, experiments and compounding

**Files:**
- Create: `src/app/content-growth.mjs`
- Create: `tests/content-growth.test.mjs`

**Interfaces:**
- Produces: `normalizeContentItem(input, options)`, `transitionContent(item, nextStage, options)`, `contentOverview(items)`, `contentPerformance(items)`, `evaluateExperiment(experiment)`, `buildCompoundCandidate(item, options)`.

- [ ] **Step 1: Write failing tests for the exact stage sequence, platform-specific variants, review gate, zero-safe metrics and evidence-linked compounding.**

```js
assert.throws(() => transitionContent(draft, 'published', { approved: false }), /approval_required/);
assert.deepEqual(contentPerformance([]), { published: 0, views: 0, leads: 0, revenue: 0, conversionRate: null });
assert.equal(buildCompoundCandidate(winner, { type: 'case' }).sourceContentId, winner.id);
```

- [ ] **Step 2: Run the focused test and verify the missing module failure.**
- [ ] **Step 3: Implement normalized company/platform/status fields, allowed transitions, metric aggregation, experiment winner rules and provenance-preserving reuse candidates.**
- [ ] **Step 4: Re-run focused and full tests; commit `feat: model content growth lifecycle`.**

### Task 3: Reading, knowledge cards and brainstorm workflow

**Files:**
- Create: `src/app/knowledge-workspace.mjs`
- Create: `tests/knowledge-workspace.test.mjs`

**Interfaces:**
- Produces: `normalizeReadingItem`, `readingProgress`, `createKnowledgeCard`, `knowledgeReviewQueue`, `createBrainstorm`, `selectBrainstormDirection`.

- [ ] **Step 1: Write failing tests for article/video/PDF/book metadata, highlight provenance, source-less card rejection, progress clamping, review queue and mobile outline fallback.**

```js
assert.throws(() => createKnowledgeCard({ insight: 'x' }), /source_required/);
assert.equal(readingProgress({ progress: 180 }), 100);
assert.equal(createKnowledgeCard({ sourceId: 'r1', quote: '原文', insight: '理解' }).sourceId, 'r1');
```

- [ ] **Step 2: Run the focused test and verify failure.**
- [ ] **Step 3: Implement the pure domain functions; keep body content optional and metadata safe for sync.**
- [ ] **Step 4: Re-run focused and full tests; commit `feat: add reading and knowledge workflows`.**

### Task 4: Social insight and controlled Agent domains

**Files:**
- Create: `src/app/social-insight-center.mjs`
- Create: `src/app/agent-workbench.mjs`
- Create: `tests/social-insight-center.test.mjs`
- Create: `tests/agent-workbench.test.mjs`

**Interfaces:**
- Produces: `normalizeSocialInsight`, `rankSocialOpportunities`, `routeInsightCompany`, `AGENT_CATALOG`, `createAgentRun`, `agentActionPolicy`, `summarizeAgentRuns`.

- [ ] **Step 1: Write failing tests requiring URL/platform/capturedAt evidence for facts, separating inference from fact, and denying publish/message/ERP-write/delete actions without approval.**

```js
assert.equal(agentActionPolicy('publish', { approved: false }).allowed, false);
assert.equal(agentActionPolicy('draft', { approved: false }).allowed, true);
assert.equal(normalizeSocialInsight({ claim: '趋势' }).status, 'pending_evidence');
```

- [ ] **Step 2: Run focused tests and verify missing module failures.**
- [ ] **Step 3: Implement the six-agent catalog, allowed action matrix, evidence scoring and company routing.**
- [ ] **Step 4: Re-run focused and full tests; commit `feat: add social insight and agent domains`.**

### Task 5: Content Growth and Agent Workbench pages

**Files:**
- Create: `src/app/views/content-growth-view.mjs`
- Create: `src/app/views/agent-workbench-view.mjs`
- Modify: `index.html`
- Modify: `src/app/router.mjs`
- Modify: `src/app.mjs`
- Create: `tests/v2-ui.test.mjs`

**Interfaces:**
- Consumes: Task 2 and Task 4 functions and state-store collections.
- Produces: routes `content-growth` and `agents`, render functions and delegated `data-action` events.

- [ ] **Step 1: Write failing DOM/source tests for the two routes, six content tabs, agent catalog, truthful empty states, filters, create/edit/delete/restore controls and approval labels.**
- [ ] **Step 2: Run `node --test tests/v2-ui.test.mjs` and verify route/page failures.**
- [ ] **Step 3: Add the two navigation items and page shells, then implement data-driven views with no inline sample records.**
- [ ] **Step 4: Wire creation, editing, stage transitions, filtering, soft deletion, restore, agent-run creation and approval submission through delegated events.**
- [ ] **Step 5: Run UI and full tests; commit `feat: add content growth and agent workbench`.**

### Task 6: Enterprise Brain and Intelligence upgrades

**Files:**
- Create: `src/app/views/knowledge-workspace-view.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `src/app/intelligence-center.mjs`
- Modify: `src/app.mjs`
- Modify: `index.html`
- Modify: `tests/v2-ui.test.mjs`
- Modify: `tests/intelligence-edge.test.mjs`

**Interfaces:**
- Consumes: reading, card, brainstorm and social insight collections.
- Produces: Enterprise Brain tabs `reading/cards/graph/brainstorm/shelf`; Intelligence tabs `daily/industry/social/competitors/opportunities`.

- [ ] **Step 1: Add failing tests for all tabs, source attribution, convert-to-card/topic/task actions, progress editing and pending-connector copy.**
- [ ] **Step 2: Verify failures, then implement reading triage, three-pane reader, cards, graph/list switch, brainstorm selection, shelf and social opportunity panels.**
- [ ] **Step 3: Ensure Obsidian metadata remains read-only and existing brain index rendering still works.**
- [ ] **Step 4: Run focused and full tests; commit `feat: expand knowledge and intelligence centers`.**

### Task 7: Search, review and cross-workflow conversion

**Files:**
- Modify: `src/app/search-center.mjs`
- Modify: `src/app/views/search-view.mjs`
- Modify: `src/app/views/review-view.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/relation-review-center.test.mjs`
- Modify: `tests/v2-ui.test.mjs`

**Interfaces:**
- Produces: searchable content/reading/cards/insights/agent-runs and review sections for content performance, experiment results and compounding candidates.

- [ ] **Step 1: Write failing tests for cross-module search and provenance-preserving conversions.**
- [ ] **Step 2: Implement new index sources and review groups without indexing secrets or Obsidian bodies.**
- [ ] **Step 3: Wire `intelligence → content/topic/task/card`, `highlight → card/task`, `content → review/compound` actions.**
- [ ] **Step 4: Run focused and full tests; commit `feat: connect content knowledge and review workflows`.**

### Task 8: Premium responsive layout and startup performance

**Files:**
- Modify: `assets/app.css`
- Modify: `src/app.mjs`
- Create: `tests/v2-performance.test.mjs`
- Modify: `tests/startup-performance.test.mjs`

**Interfaces:**
- Produces: route-owned lazy rendering, paged list rendering, 12/8/1-column layouts and mobile bottom actions.

- [ ] **Step 1: Write failing tests that prohibit eager remote calls before first paint and require new mobile menu routes and 44px targets.**
- [ ] **Step 2: Add route-local render scheduling, skeletons, 40-item paging and debounced search/filtering.**
- [ ] **Step 3: Apply the deep navy/graphite, restrained champagne accent, 8px grid, 6–10px radius visual system; add desktop split panes, tablet reductions and mobile single-column/toolbars.**
- [ ] **Step 4: Run performance/UI/full tests and `git diff --check`; commit `perf: polish v2 responsive workspace`.**

### Task 9: Cloud compatibility, release version and operational docs

**Files:**
- Modify: `src/sync-engine.mjs`
- Modify: `sw.js`
- Modify: `manifest.webmanifest`
- Modify: `index.html`
- Modify: all browser ES-module import query strings
- Modify: `README.md`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/pwa-versioned-imports.test.mjs`
- Create: `docs/zos-ceo-os-v2.0.0-production-acceptance.md`

**Interfaces:**
- Produces: v2 logical entity compatibility on the existing owner-only table, consistent `2.0.0` assets and release checklist.

- [ ] **Step 1: Add failing version/import/cloud-compatibility assertions.**
- [ ] **Step 2: Add a logical-to-physical private namespace mapping and round-trip tests; update all release identifiers to `2.0.0`.**
- [ ] **Step 3: Update README and acceptance document with real status fields left pending until validation.**
- [ ] **Step 4: Run full tests and module syntax/import checks; commit `chore: prepare ZOS v2 release`.**

### Task 10: Three-pass validation, production merge and deployment

**Files:**
- Modify: `docs/zos-ceo-os-v2.0.0-production-acceptance.md`

**Interfaces:**
- Produces: validated main deployment and final production URL.

- [ ] **Step 1: Validation pass 1 — run all Node tests, dynamic-import every browser module, `git diff --check`, secret-pattern scan and service-worker/version checks.**
- [ ] **Step 2: Validation pass 2 — serve locally and inspect desktop 1440px, tablet 834px and mobile 390px across work home, content growth, agent workbench, Enterprise Brain, intelligence, reviews and search; create/edit/delete/restore a disposable local record, then clear it.**
- [ ] **Step 3: Verify the linked Supabase project is healthy and the v2 sync adapter only emits entity types already accepted by the deployed owner-only table.**
- [ ] **Step 4: Merge the isolated branch into main, tag `zos-workbench-v2.0.0`, push main and tag, then verify the GitHub Pages deployment and versioned assets return HTTP 200.**
- [ ] **Step 5: Validation pass 3 — inspect the official URL at desktop/tablet/mobile sizes, confirm no fatal console errors or horizontal overflow, and exercise the core input-to-review flow with production-safe local-only test data.**
- [ ] **Step 6: Record exact pass counts, commit SHA, deployment URL, Supabase evidence, known limitations and rollback reference in the acceptance report; commit and push only if the recorded facts match the checks.**
