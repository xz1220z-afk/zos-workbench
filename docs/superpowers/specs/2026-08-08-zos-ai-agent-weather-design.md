# ZOS AI Assistant, Agent Invocation, Weather, and Calendar Default Design

## Goal

Extend the existing ZOS CEO Operating System without replacing its routes, navigation, data collections, or visual system. Version 2.5.0 adds a real, user-triggered OpenAI analysis path, controlled Agent OS invocation, an explicitly authorized knowledge-context index, a privacy-preserving weather surface, and a month-first calendar default.

## Decisions already approved

- OpenAI is called only through authenticated Supabase Edge Functions. The browser never receives an OpenAI key.
- ChatGPT API usage is explicit: a user clicks an answer or Agent analysis control and submits a question. There is no background model call, external action, or automatic write.
- Knowledge assistance uses only an imported, sanitized excerpt index. The source Vault, private relationship data, health, finance, credentials, chat transcripts, and full Markdown bodies stay out of the model context by default.
- Agent OS identity-card discovery remains local and metadata-only. Static GitHub Pages cannot scan a local Vault; importing the existing read-only Agent index remains the truthful bridge.
- Agent invocation performs analysis only. A `draft` Agent is labelled as an identity-card simulation; `pilot` and `active` are labelled as controlled analysis. No state claims that an Agent is autonomously running.
- Weather uses an explicit city setting (default: 阳西), not device geolocation. It is fetched from a public forecast endpoint, cached briefly in browser storage, and never blocks the initial workspace render.
- Calendar defaults to `month`; day, week, and list views remain available.

## Components

1. `zos-ai-assistant` Edge Function authenticates the caller, retrieves only that user’s approved context excerpts, selects a bounded relevant subset, calls the OpenAI Responses API, and returns an answer plus disclosed source titles. It returns explicit setup or upstream error codes without leaking configuration.
2. `zos-knowledge-context` Edge Function accepts a bounded, sanitized context-index import for the signed-in owner. A migration adds an owner-scoped RLS table. A local script creates the index without modifying the Vault or uploading it.
3. Browser clients expose both protected endpoints through the existing Supabase runtime. The intelligence drawer sends its card plus the user question to the assistant and visibly distinguishes model output, card evidence, approved knowledge excerpts, and general explanation.
4. The existing Agent OS cards retain “带入任务草稿” and add an explicit “直接分析” drawer. It receives the imported identity-card context and uses the same assistant endpoint. It never invokes tools, sends messages, writes Feishu, or edits the Vault.
5. `weather-center` normalizes public forecast responses and gives dashboard/life views a non-blocking local weather card. The card states location, fetch time, and availability rather than inventing a condition.

## Error, Privacy, and Performance Rules

- Request limits: question 1,200 characters; identity context 12,000 characters; up to six approved excerpts; no raw Vault path is included in the model prompt.
- Assistant errors are safe states: `authentication_required`, `ai_not_configured`, `knowledge_context_unavailable`, `ai_upstream_failed`, and `request_invalid`.
- OpenAI requests contain a stable hashed owner safety identifier, never an email address.
- Knowledge-index upload rejects absolute paths, body-like forbidden keys, private scopes, secret-like values, and excessive chunks. It is opt-in and owner-only.
- Weather has a 15-minute client cache and is fetched asynchronously after first render.
- No new background scheduler, write automation, or external integration is enabled.

## Acceptance Criteria

1. An authenticated intelligence question reaches the configured OpenAI backend and preserves the source intelligence record.
2. Agent OS no longer presents a task draft as an invocation: its explicit analysis control uses the same backend and shows the Agent’s real status.
3. The UI clearly explains when no key, no login, or no approved knowledge index is available.
4. Agent and knowledge index safety tests prove that private data and Markdown bodies are not included in model payloads.
5. Month is the initial calendar view on a clean load.
6. Weather does not block startup and does not use browser geolocation.
7. Existing routes, local-only REL-001 behavior, task drafts, cloud synchronization, and existing 564 regression tests remain intact.

## Rollback

The deployment is a tagged Git commit. Reverting the release commit and redeploying the prior Edge Function revision restores v2.4.0. The knowledge context table is additive; no existing data or collection is migrated or deleted. Removing the `OPENAI_API_KEY` secret disables only AI analysis and causes an explicit configuration state.
