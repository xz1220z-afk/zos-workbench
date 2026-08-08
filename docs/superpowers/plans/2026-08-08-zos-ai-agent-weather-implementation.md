# ZOS AI Assistant, Agent Invocation, Weather, and Calendar Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver ZOS v2.5.0 as an incremental, authenticated AI and weather upgrade without changing existing workspace routes or writing external business systems.

**Architecture:** Add two authenticated Supabase Edge Functions and an additive RLS data table for explicitly approved knowledge excerpts. Extend existing browser runtime and views for direct analysis, Agent status-aware use, non-blocking weather, and a month-first calendar. Keep Agent identity discovery metadata-only and locally imported.

**Tech Stack:** Existing static ES modules, Node test runner, Supabase Edge Functions/Deno, PostgreSQL RLS, OpenAI Responses API, Open-Meteo public forecast endpoint.

## Global Constraints

- Do not expose, log, commit, or fetch the value of `OPENAI_API_KEY`.
- Do not upload whole Vault Markdown, personal chat text, health, finance, relationship, credential, or location data.
- All OpenAI and knowledge-context endpoints require a valid Supabase user JWT.
- Preserve `#local-life`, Agent OS metadata-only imports, REL-001 local-only behavior, existing calendar views, and all current routes.
- No external action is triggered by model output. Agent output is analysis/draft-only.
- Calendar initial default is `month`.

---

### Task 1: Establish behavior contracts

**Files:**
- Create: `tests/ai-assistant-client.test.mjs`
- Create: `tests/knowledge-context.test.mjs`
- Modify: `tests/intelligence-question-actions.test.mjs`
- Modify: `tests/v2-app-actions.test.mjs`
- Modify: `tests/calendar-view.test.mjs`

**Interfaces:**
- Produces `createAiAssistantClient`, `normalizeKnowledgeContextIndex`, `buildAgentAnalysisRequest`, and initial month-view expectations.

- [ ] Write tests for authenticated assistant request headers/payload, rejected unsafe context, Agent direct-analysis status labelling, and clean-load month default.
- [ ] Run the targeted tests and confirm they fail because the new modules and behavior do not exist.

### Task 2: Add bounded server-side AI and knowledge context

**Files:**
- Create: `supabase/migrations/010_zos_ai_knowledge_context.sql`
- Create: `supabase/functions/zos-ai-assistant/index.ts`
- Create: `supabase/functions/zos-knowledge-context/index.ts`
- Modify: `supabase/config.toml`
- Create: `scripts/knowledge-context-index-scan.mjs`

**Interfaces:**
- Consumes authenticated JWTs and the `OPENAI_API_KEY` Edge secret.
- Produces owner-scoped sanitized excerpt storage and `POST /functions/v1/zos-ai-assistant` responses.

- [ ] Add the owner-only RLS table and bounded validation function.
- [ ] Implement the assistant using Responses API with a server-only secret, a hashed safety identifier, six maximum excerpts, and safe error codes.
- [ ] Implement local read-only scanner exclusions and test its output validation.
- [ ] Run the server contract tests and confirm pass.

### Task 3: Connect existing intelligence and Agent OS UI

**Files:**
- Create: `src/app/ai-assistant-client.mjs`
- Create: `src/app/knowledge-context.mjs`
- Modify: `src/app/browser-runtime.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `src/app/views/agent-workbench-view.mjs`

**Interfaces:**
- Consumes browser Supabase session and imported Agent identity metadata.
- Produces model-backed answer panels and explicit no-configuration/no-context UI states.

- [ ] Replace the local-only question answer action with the protected assistant client while retaining card evidence.
- [ ] Add “直接分析” and task text entry to the current Agent OS drawer; keep “带入任务草稿”.
- [ ] Add a knowledge-index import control that performs explicit owner-only upload, never auto-import.
- [ ] Run targeted app and view tests.

### Task 4: Add weather and month-first calendar

**Files:**
- Create: `src/app/weather-center.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `src/app/views/life-view.mjs`
- Modify: `tests/calendar-view.test.mjs`
- Create: `tests/weather-center.test.mjs`

**Interfaces:**
- Produces normalized cached weather state, default 阳西 location, and asynchronous non-blocking refresh.

- [ ] Test forecast normalization and unavailable fallback.
- [ ] Load weather only after first render with 15-minute cache and no geolocation.
- [ ] Render small source-disclosed weather cards in existing work and life views.
- [ ] Change clean runtime `calendarView` and invalid view fallback to `month`.

### Task 5: Release integrity and production deployment

**Files:**
- Modify: `sw.js`
- Modify: `manifest.json`
- Modify: every active module cache import from `2.4.0` to `2.5.0`
- Create: `docs/releases/v2.5.0-release.md`

**Interfaces:**
- Produces a cache-complete versioned PWA and a manual secret setup notice.

- [ ] Add all new browser modules to service worker graph.
- [ ] Run all tests three times, `node --check` application/worker files, and production asset/version probes.
- [ ] Apply the additive migration and deploy only the two new Edge Functions.
- [ ] Commit, tag `zos-workbench-v2.5.0`, push the existing production branch, and verify GitHub Pages response/version.
