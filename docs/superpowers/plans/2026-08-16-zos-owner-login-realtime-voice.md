# ZOS Owner Login, Realtime Sync, and ChatGPT Voice Implementation Plan

> **Execution rule:** Follow this plan sequentially with `superpowers:test-driven-development`. Every production change starts with a failing test, then the smallest passing implementation. Use `superpowers:verification-before-completion` before any completion or release claim.

**Goal:** Turn the existing ZOS PWA into an owner-only, four-end workspace with a dedicated login gate, authenticated realtime synchronization, quick voice turns, and a controlled ChatGPT realtime voice session—without exposing secrets, weakening existing approval boundaries, or losing local data.

**Architecture:** Supabase Auth establishes the owner identity before the app shell boots. Edge Functions enforce `ZOS_OWNER_USER_ID` for company-wide reads and Feishu approval writes. User-scoped records continue to use existing RLS. Supabase Realtime is a change signal only: each signal triggers the existing authoritative pull/merge path, with BroadcastChannel for same-device tabs and the current timer/online/visibility paths retained as fallback. Quick voice reuses the existing browser transcript flow plus `zos-ai-assistant`; realtime voice uses WebRTC through a new server-side OpenAI session endpoint. High-impact actions remain preview-only until an explicit on-screen confirmation.

**Technology:** Existing HTML/CSS/ES modules, Node test runner, Supabase Auth/Postgres/Realtime/Edge Functions, OpenAI Responses and Realtime WebRTC APIs, GitHub Pages PWA.

**Release target:** `2.11.0`

---

## Fixed product and security invariants

- The app shell and business modules do not initialize before the user is authorized as the configured owner.
- Email/password login is the primary path. OTP/magic-link login must use `create_user: false`; the PWA never creates accounts.
- The browser may remember the email and Supabase session. It never stores the plaintext password; password saving is delegated to the OS/browser password manager.
- Anonymous requests return `401`; authenticated non-owner requests to global company data, approval preview/execute, AI, and voice endpoints return `403`.
- User-scoped `zos_records` remains protected by `auth.uid() = user_id`; Realtime never broadens this access.
- A realtime event is only a wake-up signal. The client always rereads via the existing sync transport and conflict engine before rendering.
- Company business data remains sourced from the current verified Feishu/Supabase cache paths; realtime must not convert stale or missing data into “current” data.
- Quick voice stores transcript/task context only when the user submits it. Realtime voice does not persist raw microphone audio.
- The OpenAI API key and Supabase service-role key remain server-side.
- Voice can draft, search, analyze, and prepare approval previews. It cannot send, write Feishu, publish, pay, delete, or execute an approval without an explicit on-screen confirmation.
- Local data migrations and synchronization must preserve the v2.10.0 durability guarantees and existing tombstone/conflict behavior.

---

## Task 0: Baseline and release safety checkpoint

**Read/verify:**

- `docs/superpowers/specs/2026-08-16-zos-owner-login-realtime-voice-design.md`
- `index.html`
- `src/app.mjs`
- `src/legacy-app.mjs`
- `src/app/browser-runtime.mjs`
- `src/app/sync-controller.mjs`
- `supabase/functions/_shared/auth.ts`
- `supabase/config.toml`
- `manifest.json`
- `sw.js`

**Step 1: Record the clean starting point**

Run:

```bash
git status --short --untracked-files=all
git rev-parse --short HEAD
```

Expected: only the pre-existing untracked `.superpowers/brainstorm/`; HEAD includes the approved design commit.

**Step 2: Run the current baseline**

Run:

```bash
node --test tests/*.test.mjs
git diff --check
```

Expected: all existing tests pass and no whitespace errors. Save the exact count in the release report; do not guess it.

**Step 3: Create a recoverable release checkpoint**

Create a lightweight local tag only after the baseline is green:

```bash
git tag zos-workbench-v2.10.0-pre-owner-auth HEAD
```

Do not force or replace an existing tag. If it exists, verify it resolves to the expected pre-change commit and record that fact instead.

---

## Task 1: Owner authorization primitive and security regression tests

**Files:**

- Modify: `supabase/functions/_shared/auth.ts`
- Modify: `tests/business-edge-function.test.mjs`
- Modify: `tests/feishu-approval-edge.test.mjs`
- Create: `tests/owner-authorization.test.mjs`

**Step 1: Write failing owner-authorization tests**

Cover:

- missing token -> `authentication_required`, status `401`;
- invalid token -> `authentication_invalid`, status `401`;
- valid non-owner -> `authorization_forbidden`, status `403`;
- missing `ZOS_OWNER_USER_ID` -> `service_not_configured`, status `503`;
- configured owner -> returns the existing `{ user, token, supabase }` identity;
- error payloads never include user IDs, tokens, environment values, or upstream response bodies.

Add static integration assertions requiring `requireOwnerUser(req)` in global business and approval endpoints.

Run:

```bash
node --test tests/owner-authorization.test.mjs tests/business-edge-function.test.mjs tests/feishu-approval-edge.test.mjs
```

Expected RED: `requireOwnerUser` is absent and the global endpoints still accept any authenticated user.

**Step 2: Implement the smallest shared helper**

In `_shared/auth.ts`:

- extend `AuthError` with `authorization_forbidden`;
- export `requireOwnerUser(req)`;
- call `requireUser(req)` first;
- compare `identity.user.id` to `Deno.env.get('ZOS_OWNER_USER_ID')` using an exact string comparison;
- return `503` when the owner environment is absent, not `403`;
- return the existing identity shape for the owner.

**Step 3: Re-run focused tests**

Expected GREEN.

**Step 4: Commit**

```bash
git add supabase/functions/_shared/auth.ts tests/owner-authorization.test.mjs tests/business-edge-function.test.mjs tests/feishu-approval-edge.test.mjs
git commit -m "security: add owner authorization boundary"
```

---

## Task 2: Protect global business reads and Feishu approval writes

**Files:**

- Modify: `supabase/functions/zos-business-data/index.ts`
- Modify: `supabase/functions/zos-feishu-approval-preview/index.ts`
- Modify: `supabase/functions/zos-feishu-approval-execute/index.ts`
- Modify: `supabase/functions/zos-ai-assistant/index.ts`
- Modify: `tests/business-edge-function.test.mjs`
- Modify: `tests/feishu-approval-edge.test.mjs`
- Modify: `tests/ai-assistant-contract.test.mjs`
- Create: `tests/owner-endpoint-boundaries.test.mjs`

**Step 1: Add RED endpoint-boundary tests**

Assert that all four endpoints use `requireOwnerUser`, preserve CORS/method checks, and map `AuthError` to its safe status/code. Preserve existing approval invariants:

- ten-minute preview expiry;
- immutable snapshot hash;
- single-use atomic claim;
- source drift rejection;
- server-resolved Feishu targets/fields;
- exact readback before success.

Run:

```bash
node --test tests/owner-endpoint-boundaries.test.mjs tests/business-edge-function.test.mjs tests/feishu-approval-edge.test.mjs tests/ai-assistant-contract.test.mjs
```

Expected RED: normal business, approval, and AI calls still use `requireUser`.

**Step 2: Replace the endpoint guard only**

Use `requireOwnerUser` at the request boundary. Do not change data mapping, approval payloads, Feishu target resolution, history rules, or AI knowledge selection.

**Step 3: Re-run the focused suite and the existing function suites**

```bash
node --test tests/owner-endpoint-boundaries.test.mjs tests/business-edge-function.test.mjs tests/feishu-approval-edge.test.mjs tests/ai-assistant-contract.test.mjs tests/business-refresh-guard.test.mjs
```

Expected GREEN.

**Step 4: Commit**

```bash
git add supabase/functions/zos-business-data/index.ts supabase/functions/zos-feishu-approval-preview/index.ts supabase/functions/zos-feishu-approval-execute/index.ts supabase/functions/zos-ai-assistant/index.ts tests
git commit -m "security: restrict company endpoints to owner"
```

---

## Task 3: Dedicated authentication state machine

**Files:**

- Modify: `src/supabase-auth.mjs`
- Create: `src/app/auth-gate.mjs`
- Create: `src/app/owner-session-client.mjs`
- Create: `supabase/functions/zos-auth-session/index.ts`
- Modify: `supabase/config.toml`
- Create: `tests/auth-gate.test.mjs`
- Create: `tests/owner-session-edge.test.mjs`
- Modify: `tests/supabase-auth.test.mjs`
- Modify: `tests/application-reliability.test.mjs`

**Step 1: Write RED tests for the agreed states**

Cover the state machine:

- `checking` while restoring/refreshing a saved session;
- `signed_out` when no session exists;
- `authenticating` during password/OTP verification;
- `authorized` only after a server owner check succeeds;
- `blocked` for valid non-owner or invalid local offline lease;
- stale/invalid refresh token is cleared safely;
- the remembered field is email only;
- password is never returned to persistence callbacks;
- `requestOtp` sends `create_user: false`;
- sign-out clears the current session but may preserve remembered email;
- “remove this device” clears session, remembered email, device lease, and user-scoped local caches through explicit callbacks.
- the owner-session endpoint returns only a safe authorization state, never user IDs, tokens, business data, or configuration values.

Run:

```bash
node --test tests/auth-gate.test.mjs tests/supabase-auth.test.mjs tests/application-reliability.test.mjs
```

Expected RED.

**Step 2: Add the minimal owner-session endpoint**

Create an authenticated `GET` endpoint that calls `requireOwnerUser(req)` and returns only `{ state: 'authorized' }`. Anonymous/invalid/non-owner/configuration errors preserve the safe `AuthError` code and status. Configure `verify_jwt = true`. This endpoint must not initialize Feishu, OpenAI, service-role clients, or read any business table.

**Step 3: Implement `createAuthGate` and its client**

Inject storage, auth client, owner verifier, clock, connectivity, and cleanup callbacks. Keep it DOM-independent and expose:

- `bootstrap()`;
- `signInWithPassword(email, password, rememberEmail)`;
- `requestOtp(email)` / `verifyOtp(email, token)`;
- `signOut()`;
- `removeDevice()`;
- `subscribe(listener)`;
- `getState()`.

The offline read-only lease is valid only for the same previously owner-verified user/device and at most 24 hours. It must not permit remote calls or approval execution while offline.

`createOwnerSessionClient` calls only `zos-auth-session` with the Supabase access token and accepts only the exact `{ state: 'authorized' }` contract.

**Step 4: Make OTP non-provisioning**

Change `requestOtp` to `create_user: false` in the modular auth client. Add a later cleanup task for the legacy duplicate so this task stays focused.

**Step 5: Re-run focused tests and commit**

```bash
node --test tests/auth-gate.test.mjs tests/owner-session-edge.test.mjs tests/supabase-auth.test.mjs tests/application-reliability.test.mjs
git add src/supabase-auth.mjs src/app/auth-gate.mjs src/app/owner-session-client.mjs supabase/functions/zos-auth-session/index.ts supabase/config.toml tests/auth-gate.test.mjs tests/owner-session-edge.test.mjs tests/supabase-auth.test.mjs tests/application-reliability.test.mjs
git commit -m "feat: add owner login state machine"
```

---

## Task 4: Separate four-end login screen and boot gate

**Files:**

- Modify: `index.html`
- Modify: `assets/app.css`
- Modify: `src/app.mjs`
- Modify: `src/app/browser-runtime.mjs`
- Modify: `src/legacy-app.mjs`
- Create: `src/app/views/login-view.mjs`
- Create: `tests/login-screen.test.mjs`
- Create: `tests/authenticated-boot.test.mjs`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/mobile-dashboard.test.mjs`

**Step 1: Write RED structural and lifecycle tests**

Assert:

- the initial HTML exposes a dedicated login root and a hidden/inert app root;
- no business/knowledge/Agent refresh starts before authorization;
- signed-out users cannot reveal page contents by changing the URL hash;
- authorized users enter the requested safe route or the default dashboard;
- blocked users see a non-sensitive owner-only message;
- login fields use appropriate `autocomplete` (`username`, `current-password`, `one-time-code`);
- “remember email” is explicit and checked by user choice;
- password is never placed into HTML, localStorage, sessionStorage, logs, or query/hash URLs;
- Mac/Windows desktop and iPhone/Android widths have a usable single-column login screen, 44px minimum targets, visible focus, and no horizontal overflow;
- logout returns to the gate before remote runtimes stop/clear;
- legacy Settings login controls no longer create a second independent auth flow.

Run:

```bash
node --test tests/login-screen.test.mjs tests/authenticated-boot.test.mjs tests/pwa-baseline.test.mjs tests/mobile-dashboard.test.mjs
```

Expected RED.

**Step 2: Implement the view and boot sequence**

- Render the auth screen immediately.
- Bootstrap the auth gate before constructing the remote runtime.
- Only import/start the app shell after `authorized` (or valid offline read-only lease).
- Keep Supabase URL and publishable key as public configuration; never expose service-role/OpenAI keys.
- On logout, stop realtime/sync/voice, clear the authorized DOM, then render login.
- Preserve the current route/nav/data structures after authorization.

**Step 3: Remove the duplicate legacy authority**

Retain compatibility wrappers only if existing tests or migration flows require them, but delegate all sign-in/session writes to the modular auth gate. Set legacy OTP to `create_user: false` as defense in depth.

**Step 4: Re-run focused UI suites**

```bash
node --test tests/login-screen.test.mjs tests/authenticated-boot.test.mjs tests/supabase-auth.test.mjs tests/application-reliability.test.mjs tests/pwa-baseline.test.mjs tests/mobile-dashboard.test.mjs tests/router.test.mjs
```

Expected GREEN.

**Step 5: Commit**

```bash
git add index.html assets/app.css src/app.mjs src/app/browser-runtime.mjs src/legacy-app.mjs src/app/views/login-view.mjs tests
git commit -m "feat: gate workspace behind owner login"
```

---

## Task 5: Realtime change signal with authoritative reread

**Files:**

- Create: `src/app/realtime-sync-signal.mjs`
- Modify: `src/app/sync-controller.mjs`
- Modify: `src/app/browser-runtime.mjs`
- Create: `tests/realtime-sync-signal.test.mjs`
- Modify: `tests/sync-controller.test.mjs`
- Modify: `tests/automatic-refresh-integration.test.mjs`
- Modify: `tests/data-durability.test.mjs`

**Step 1: Write RED synchronization tests**

Cover:

- subscribe only after owner authorization and a valid access token;
- filter Postgres changes to `user_id=eq.<authorized-user-id>`;
- INSERT/UPDATE/DELETE coalesce into one authoritative `sync('realtime-signal')` call;
- payload content is never written directly into app state;
- an event during an active sync schedules one follow-up pull instead of being lost;
- same-browser tabs notify each other through BroadcastChannel without loops;
- reconnect and refreshed JWT resubscribe once;
- offline/retry/visibility/local-change fallbacks remain functional;
- stop/logout removes channel, BroadcastChannel, timers, handlers, and prevents late callbacks from mutating state;
- conflict, tombstone, and stale-projection durability tests remain green.

Run:

```bash
node --test tests/realtime-sync-signal.test.mjs tests/sync-controller.test.mjs tests/automatic-refresh-integration.test.mjs tests/data-durability.test.mjs
```

Expected RED.

**Step 2: Implement a transport-neutral signal adapter**

`createRealtimeSyncSignal` receives an injected channel factory; it does not import a CDN at runtime. It exposes `start`, `setAccessToken`, `stop`, and status subscription. The event handler calls a coalesced callback only.

**Step 3: Integrate with the existing sync controller**

Add a public signal scheduling method or reuse a safe exported scheduler without bypassing `pull -> merge -> write -> upsert`. Preserve current retry and conflict semantics.

**Step 4: Pin the browser runtime dependency locally**

Use a locally versioned module or a minimal repository-owned WebSocket adapter. Do not introduce an unpinned CDN dependency. Add the exact module to `sw.js` in Task 10.

**Step 5: Re-run focused tests and commit**

```bash
node --test tests/realtime-sync-signal.test.mjs tests/sync-controller.test.mjs tests/automatic-refresh-integration.test.mjs tests/data-durability.test.mjs tests/supabase-transport.test.mjs
git add src/app/realtime-sync-signal.mjs src/app/sync-controller.mjs src/app/browser-runtime.mjs tests
git commit -m "feat: add authenticated realtime sync signals"
```

---

## Task 6: Realtime database publication and RLS verification

**Files:**

- Create: `supabase/migrations/012_zos_records_realtime.sql`
- Modify: `tests/supabase-migration.test.mjs`
- Create: `tests/realtime-migration.test.mjs`
- Modify: `docs/superpowers/plans/2026-08-16-zos-owner-login-realtime-voice.md` only if live schema forces a documented deviation

**Step 1: Write RED migration tests**

Assert that the migration:

- adds `public.zos_records` to `supabase_realtime` only if absent;
- is idempotent;
- does not disable RLS or broaden policies;
- retains `auth.uid() = user_id` SELECT/INSERT/UPDATE/DELETE boundaries;
- contains no secrets or fixed user IDs.

Run:

```bash
node --test tests/realtime-migration.test.mjs tests/supabase-migration.test.mjs
```

Expected RED: migration absent.

**Step 2: Add the idempotent publication migration**

Postgres Changes with RLS sends only rows the connected user may read. The client still applies its own `user_id` filter and authoritative reread.

**Step 3: Local verification and commit**

```bash
node --test tests/realtime-migration.test.mjs tests/supabase-migration.test.mjs
git add supabase/migrations/012_zos_records_realtime.sql tests/realtime-migration.test.mjs tests/supabase-migration.test.mjs
git commit -m "feat: enable RLS scoped realtime records"
```

**Step 4: Production migration gate**

Before applying remotely, perform a read-only schema check. Apply exactly migration 012, then read back publication membership and RLS policies. Any mismatch stops deployment; do not modify unrelated tables.

---

## Task 7: Quick voice turn with ChatGPT answer and spoken output

**Files:**

- Modify: `src/app/voice-input.mjs`
- Create: `src/app/voice-turn.mjs`
- Modify: `src/app/ai-assistant-client.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/ai-command-view.mjs`
- Modify: `supabase/functions/zos-ai-assistant/index.ts`
- Modify: `supabase/functions/_shared/ai-assistant-contract.mjs`
- Create: `tests/voice-turn.test.mjs`
- Modify: `tests/voice-input.test.mjs`
- Modify: `tests/ai-command-voice-integration.test.mjs`
- Modify: `tests/ai-assistant-contract.test.mjs`

**Step 1: Write RED quick-voice tests**

Cover:

- tap/hold microphone -> browser transcript -> editable draft;
- transcript is not submitted automatically;
- submit sends selected Agent/page/minimal approved knowledge context;
- response renders text first and optionally speaks it;
- user can stop audio immediately;
- microphone permission denial and unsupported recognition produce clear fallbacks;
- stale transcript/result cannot overwrite a newer turn;
- logout/destroy stops recognition and audio;
- no raw audio blob is persisted;
- only owner-authorized AI calls succeed;
- high-impact intent produces a controlled preview/draft, never direct execution.

Run:

```bash
node --test tests/voice-turn.test.mjs tests/voice-input.test.mjs tests/ai-command-voice-integration.test.mjs tests/ai-assistant-contract.test.mjs
```

Expected RED.

**Step 2: Implement the orchestration layer**

Keep recognition, assistant request, and audio playback as separate injected adapters. Preserve the existing pointer lifecycle fixes. Add cancellation/generation guards so late callbacks cannot update a newer route/Agent/turn.

**Step 3: Extend the safe assistant contract**

Allow explicit `interactionMode: 'text' | 'quick_voice'`, page context, Agent ID, and output preference. Server instructions must retain `事实 / 推断 / 建议 / 待确认 / 下一步` and controlled-execution boundaries. Do not accept client-provided system instructions, knowledge bodies, model names, tool definitions, or destination IDs.

**Step 4: Use safe browser speech output initially**

If a server OpenAI TTS endpoint is not already configured, use the browser speech output as a functioning fallback and label voice quality accordingly. The realtime mode in Task 8 provides the direct OpenAI audio experience. Do not expose an API key to add TTS.

**Step 5: Re-run and commit**

```bash
node --test tests/voice-turn.test.mjs tests/voice-input.test.mjs tests/ai-command-voice-integration.test.mjs tests/ai-assistant-client.test.mjs tests/ai-assistant-contract.test.mjs
git add src/app/voice-input.mjs src/app/voice-turn.mjs src/app/ai-assistant-client.mjs src/app.mjs src/app/views/ai-command-view.mjs supabase/functions/zos-ai-assistant/index.ts supabase/functions/_shared/ai-assistant-contract.mjs tests
git commit -m "feat: add controlled quick voice turns"
```

---

## Task 8: OpenAI realtime voice session endpoint

**Files:**

- Create: `supabase/functions/zos-ai-realtime-session/index.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/functions/_shared/realtime-voice-contract.mjs`
- Create: `tests/realtime-voice-edge.test.mjs`
- Create: `tests/realtime-voice-contract.test.mjs`
- Modify: `tests/owner-endpoint-boundaries.test.mjs`

**Step 1: Write RED endpoint tests**

Assert:

- `OPTIONS` is safe and `POST` only;
- `requireOwnerUser` is mandatory;
- request accepts only SDP plus a bounded, server-normalized context envelope;
- request rejects client model names, system prompts, tools, API keys, destinations, or raw knowledge bodies;
- OpenAI key comes only from `OPENAI_API_KEY`;
- server calls `https://api.openai.com/v1/realtime/calls` with the SDP and server-owned session configuration;
- response returns SDP only, with no OpenAI secret/session metadata;
- upstream failure returns safe codes;
- idle and maximum-session limits are present in the contract;
- `verify_jwt = true` is configured.

Run:

```bash
node --test tests/realtime-voice-edge.test.mjs tests/realtime-voice-contract.test.mjs tests/owner-endpoint-boundaries.test.mjs
```

Expected RED.

**Step 2: Implement the unified WebRTC server interface**

Build the OpenAI realtime session instructions server-side from:

- authenticated owner identity;
- selected Agent ID and existing Agent boundary;
- current route/page summary;
- minimal approved knowledge excerpts/refs;
- controlled execution policy.

Never accept arbitrary system instructions or tool destinations from the browser. Default to no external write tools.

**Step 3: Re-run and commit**

```bash
node --test tests/realtime-voice-edge.test.mjs tests/realtime-voice-contract.test.mjs tests/owner-endpoint-boundaries.test.mjs
git add supabase/functions/zos-ai-realtime-session/index.ts supabase/functions/_shared/realtime-voice-contract.mjs supabase/config.toml tests
git commit -m "feat: add owner-only realtime voice session"
```

---

## Task 9: Realtime WebRTC client and four-end voice UI

**Files:**

- Create: `src/app/realtime-voice.mjs`
- Create: `src/app/views/realtime-voice-view.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/ai-command-view.mjs`
- Modify: `src/app/views/mobile-view.mjs`
- Modify: `assets/app.css`
- Create: `tests/realtime-voice-client.test.mjs`
- Create: `tests/realtime-voice-ui.test.mjs`
- Modify: `tests/mobile-command-sheet-accessibility.test.mjs`
- Modify: `tests/mobile-interaction-performance.test.mjs`

**Step 1: Write RED client lifecycle tests**

Cover:

- user gesture is required before microphone/WebRTC creation;
- local microphone track, remote audio element, and `oai-events` data channel are wired;
- SDP exchange goes only through `zos-ai-realtime-session` with the Supabase access token;
- connection states: idle, connecting, listening, speaking, muted, reconnecting, ended, failed;
- interruption stops current response playback without ending the session;
- mute disables the outgoing track;
- captions are optional and removable;
- 90-second idle warning/stop and 15-minute hard cap;
- one reconnect attempt only; failure returns to quick voice/text;
- route change, logout, background timeout, and explicit end stop tracks, audio, peer connection, timers, handlers, and late callbacks;
- no raw audio or SDP is persisted;
- reduced-motion, keyboard, screen-reader labels, 44px targets, safe-area insets, and no horizontal overflow at four representative widths.

Run:

```bash
node --test tests/realtime-voice-client.test.mjs tests/realtime-voice-ui.test.mjs tests/mobile-command-sheet-accessibility.test.mjs tests/mobile-interaction-performance.test.mjs
```

Expected RED.

**Step 2: Implement the client state machine**

Inject `RTCPeerConnection`, `getUserMedia`, timers, document, and fetch for deterministic tests. Use generation/stopped guards on every async callback.

**Step 3: Add a progressive voice surface**

- Central microphone keeps quick voice as the default low-friction action.
- “实时对话” is an explicit second choice.
- Display selected Agent, knowledge scope, listening/speaking/mute state, and the statement “不会自动执行外部操作”.
- Keep text input fully usable when voice is unavailable.

**Step 4: Re-run and commit**

```bash
node --test tests/realtime-voice-client.test.mjs tests/realtime-voice-ui.test.mjs tests/mobile-command-sheet-accessibility.test.mjs tests/mobile-interaction-performance.test.mjs tests/ai-command-voice-integration.test.mjs
git add src/app/realtime-voice.mjs src/app/views/realtime-voice-view.mjs src/app.mjs src/app/views/ai-command-view.mjs src/app/views/mobile-view.mjs assets/app.css tests
git commit -m "feat: add four-end realtime ChatGPT voice"
```

---

## Task 10: Versioned PWA release, atomic cache, and backups

**Files:**

- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: all browser module imports containing `?v=2.10.0`
- Modify: version assertions in `tests/pwa-baseline.test.mjs`, `tests/pwa-versioned-imports.test.mjs`, `tests/v2-release.test.mjs`, `tests/release-governance.test.mjs`
- Create: `docs/releases/zos-workbench-v2.11.0.md`

**Step 1: Write/adjust RED version integrity tests**

Require one exact version across HTML, manifest, service-worker cache, module imports, and release documentation. Require the new auth, realtime, and voice modules in the atomic cache list.

Run:

```bash
node --test tests/pwa-baseline.test.mjs tests/pwa-versioned-imports.test.mjs tests/service-worker-install-atomicity.test.mjs tests/v2-release.test.mjs tests/release-governance.test.mjs
```

Expected RED: app remains at 2.10.0 and new modules are not cached.

**Step 2: Upgrade atomically to 2.11.0**

- bump all versioned imports and cache names together;
- retain atomic install failure cleanup;
- cache the dedicated login shell and locally pinned realtime dependency;
- do not cache API responses, sessions, SDP, audio, or secrets;
- record commits, migrations, functions, environment variable names, tests, rollout, and rollback in the release document.

**Step 3: Commit**

```bash
node --test tests/pwa-baseline.test.mjs tests/pwa-versioned-imports.test.mjs tests/service-worker-install-atomicity.test.mjs tests/v2-release.test.mjs tests/release-governance.test.mjs
git add index.html manifest.json sw.js src tests docs/releases/zos-workbench-v2.11.0.md
git commit -m "release: prepare zos workbench v2.11.0"
```

---

## Task 11: Full verification and adversarial review

**Step 1: Syntax and static safety checks**

Run:

```bash
node --check src/app.mjs
node --check src/legacy-app.mjs
find src -name '*.mjs' -print0 | xargs -0 -n1 node --check
git diff --check
rg -n "service_role|OPENAI_API_KEY|FEISHU_APP_SECRET|password\s*[:=]" index.html src tests manifest.json sw.js
```

Expected: syntax clean; only intentional server-side environment variable references/tests, no committed values and no password persistence.

**Step 2: Full automated suite**

```bash
node --test tests/*.test.mjs
```

Expected: all tests pass. Record the actual count.

**Step 3: Security scan**

Run the repository security diff scan over the branch changes. Specifically validate:

- auth bypass through hash routes or cached shell;
- authenticated non-owner access;
- OTP user creation;
- token/session leakage;
- arbitrary prompt/tool injection into voice endpoints;
- CSRF-like approval execution paths;
- realtime cross-user data leakage;
- microphone tracks surviving logout/route change;
- unsafe offline authorization;
- PWA caching of private responses.

Any validated high/critical finding blocks release. Fix through a new RED test before changing production code.

**Step 4: Three acceptance rounds**

Round 1 — desktop Mac/Windows widths:

- fresh signed-out load;
- password-manager compatible login;
- wrong password/non-owner/expired session;
- authorized boot and route restoration;
- realtime update between two tabs;
- quick voice and realtime voice start/interruption/end;
- logout and remove-device cleanup;
- console errors = 0; horizontal overflow = 0.

Round 2 — iPhone/Android widths/PWA mode:

- dedicated login, keyboard resize, safe area, tap targets;
- session restore and offline lease messaging;
- central microphone, permissions, mute, captions, fallback;
- realtime sync reconnect after foreground/network change;
- console errors = 0; horizontal overflow = 0.

Round 3 — regression and data durability:

- existing work/life/company/Agent/intelligence/calendar routes;
- local create/edit/delete, tombstones, conflict resolution, legacy projection;
- Wanjia/Huohuo/Lingli data truth labels;
- approval preview/execute retains exact confirmation and readback;
- repeated reload/PWA update does not lose data;
- anonymous 401 and authenticated non-owner 403.

Capture screenshots and non-sensitive response summaries only. Do not capture credentials, session tokens, raw audio, private knowledge bodies, or raw business JSON.

---

## Task 12: Controlled production deployment and rollback proof

**Deployment order:**

1. Verify required environment variable names exist without reading or printing their values:
   - `ZOS_OWNER_USER_ID`
   - `OPENAI_API_KEY`
   - existing Supabase/Feishu server variables.
2. Apply migration `012_zos_records_realtime.sql`; read back publication membership and RLS.
3. Deploy owner-protected existing functions:
   - `zos-business-data`
   - `zos-feishu-approval-preview`
   - `zos-feishu-approval-execute`
   - `zos-ai-assistant`.
4. Deploy `zos-ai-realtime-session`.
5. Probe anonymously: protected functions must return `401`.
6. Probe with an authorized owner session through the UI, never printing the token.
7. Probe with a controlled non-owner test identity only if one is already authorized for security testing; expected `403`. Do not create a new user for this test.
8. Push the exact green commit and deploy GitHub Pages.
9. Verify production `index.html`, `manifest.json`, `sw.js`, and representative modules all report `2.11.0` and HTTP 200.
10. Repeat the three acceptance rounds against the formal URL.

**Rollback:**

- PWA: redeploy the pre-release commit/tag with a new cache version so installed clients receive the rollback.
- Functions: redeploy the prior known-good function sources. Do not remove owner enforcement from global business/approval endpoints; if voice is defective, disable only the new voice entry/session function.
- Realtime: client can fall back to timer/online/visibility sync. If required, remove `zos_records` from the publication using a separately reviewed rollback migration; RLS stays enabled.
- Data: no migration in this release deletes or rewrites user records. Never reset localStorage or cloud rows as a rollback shortcut.

**Final release evidence:**

- implementation and release commit hashes;
- Supabase migration/function versions;
- GitHub Pages version and URL;
- test counts and three-round acceptance results;
- security scan outcome;
- unresolved items explicitly marked, never implied complete;
- exact rollback reference.
