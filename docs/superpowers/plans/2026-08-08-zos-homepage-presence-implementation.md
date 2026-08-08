# ZOS Homepage Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Upgrade the existing work and life homepages into dynamic daily briefs with lightweight liquid-glass material and tactile feedback, without changing navigation, data authority, or external writes.

**Architecture:** Add a pure `homepage-presence` selector module that converts the existing view model into bounded work/life hero states. Keep rendering in the existing dashboard and life view modules, and layer scoped CSS over the existing v14 design tokens. No new framework, WebGL renderer, external service, or data collection is introduced.

**Tech Stack:** Existing browser-native ES modules, static HTML, CSS custom properties, Node built-in test runner.

## Global Constraints

- Modify only the current ZOS workbench; preserve routes, left navigation, source rails, and all business pages.
- Do not create a React runtime or use a real-time shader/animation loop.
- Use liquid glass only for work/life hero and primary actions; retain opaque readable surfaces for KPI, lists, and data tables.
- Work and personal data remain isolated; life rendering only consumes existing life/date/ritual data.
- No Flybook, Vault, Supabase, calendar, agent, or external-message write occurs in this feature.
- Respect `prefers-reduced-motion`; no visual state relies solely on motion or color.
- Ship only after focused tests, full tests, three-size layout checks, and a production asset check pass.

---

### Task 1: Derive bounded daily hero states

**Files:**
- Create: `src/app/homepage-presence.mjs`
- Create: `tests/homepage-presence.test.mjs`

**Interfaces:**
- Consumes: existing fields `decisions`, `importantDates.work`, `todayTop3`, `mustRead`, `calendar`, `lifeNextSevenDays`, `importantDates.life`, `rituals`, and `life`.
- Produces: `buildWorkHomepagePresence(viewModel)` and `buildLifeHomepagePresence(viewModel)`, each returning `{ kicker, title, summary, primaryAction, secondaryAction, tone }`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkHomepagePresence, buildLifeHomepagePresence } from '../src/app/homepage-presence.mjs';

test('work presence prioritizes CEO decisions over lower-priority signals', () => {
  const result = buildWorkHomepagePresence({
    decisions: [{ id: 'd-1', title: '确认报价' }],
    importantDates: { work: [{ id: 'w-1', title: '交付', days: 1 }] },
    todayTop3: [{ id: 't-1', title: '准备方案' }],
  });
  assert.equal(result.title, '今天有 1 件事需要你拍板');
  assert.equal(result.primaryAction.target, 'decisions');
});

test('life presence names upcoming dates without exposing a private title', () => {
  const result = buildLifeHomepagePresence({
    importantDates: { life: [{ id: 'l-1', title: '纪念日', days: 3 }] },
    lifeNextSevenDays: [], rituals: [], life: [],
  });
  assert.equal(result.title, '未来 7 天有 1 个值得提前准备的日子');
  assert.equal(result.primaryAction.target, 'important-dates');
  assert.doesNotMatch(result.summary, /纪念日/);
});

test('both presences fall back to non-slogan states when records are empty', () => {
  assert.equal(buildWorkHomepagePresence({}).title, '今天的节奏已排好');
  assert.equal(buildLifeHomepagePresence({}).title, '今天可以给自己留一点空间');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/homepage-presence.test.mjs`
Expected: FAIL because `src/app/homepage-presence.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
export function buildWorkHomepagePresence(model = {}) {
  const decisions = Array.isArray(model.decisions) ? model.decisions : [];
  const dates = Array.isArray(model.importantDates?.work) ? model.importantDates.work : [];
  const actions = Array.isArray(model.todayTop3) ? model.todayTop3 : [];
  if (decisions.length) return {
    kicker: 'TODAY · DECISION',
    title: `今天有 ${decisions.length} 件事需要你拍板`,
    summary: `${actions.length} 项行动已进入今日清单`,
    primaryAction: { label: '查看待我决策', target: 'decisions' },
    secondaryAction: { label: '快速收集', event: 'quick-capture' },
    tone: 'decision',
  };
  if (dates.length) return {
    kicker: 'TODAY · PRIORITY',
    title: `今天有 ${dates.length} 个节点值得优先处理`,
    summary: `${actions.length} 项行动已进入今日清单`,
    primaryAction: { label: '查看今日行动', target: 'today' },
    secondaryAction: { label: '快速收集', event: 'quick-capture' },
    tone: 'priority',
  };
  return {
    kicker: 'TODAY · OPERATING RHYTHM',
    title: '今天的节奏已排好',
    summary: actions.length ? `${actions.length} 项行动已进入今日清单` : '暂未发现需要立即处理的事项',
    primaryAction: { label: '查看今日行动', target: 'today' },
    secondaryAction: { label: '快速收集', event: 'quick-capture' },
    tone: 'calm',
  };
}
```

Implement the life helper with counts and existing action identifiers only; never include a private record title in its summary.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/homepage-presence.test.mjs`
Expected: PASS with 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/homepage-presence.mjs tests/homepage-presence.test.mjs
git commit -m "feat: derive dynamic homepage briefs"
```

### Task 2: Render dynamic work and life briefs

**Files:**
- Modify: `src/app/views/dashboard-view.mjs:1-120`
- Modify: `src/app/views/life-view.mjs:1-55`
- Modify: `tests/homepage-presence.test.mjs`

**Interfaces:**
- Consumes: `buildWorkHomepagePresence(viewModel)` and `buildLifeHomepagePresence(viewModel)`.
- Produces: work hero `data-home-presence="work"`; life hero `data-home-presence="life"`; buttons mapped only to existing handlers.

- [ ] **Step 1: Write the failing render tests**

```js
test('dashboard renders the current decision brief and existing decision route', () => {
  const html = renderDashboardToString({ decisions: [{ id: 'd-1', title: '确认报价' }], importantDates: { work: [] }, todayTop3: [] });
  assert.match(html, /今天有 1 件事需要你拍板/);
  assert.match(html, /data-page="decisions"/);
  assert.doesNotMatch(html, /今天，先处理最重要的事/);
});

test('life view renders private rhythm copy without the retired work slogan', () => {
  const html = renderLifeToString({ importantDates: { life: [] }, lifeNextSevenDays: [], rituals: [], life: [] });
  assert.match(html, /今天可以给自己留一点空间/);
  assert.doesNotMatch(html, /把生活安排好，工作才有稳定的能量/);
});
```

Use the existing fake-container convention from `tests/important-dates-view.test.mjs` so tests invoke actual render functions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/homepage-presence.test.mjs`
Expected: FAIL because existing views render static titles.

- [ ] **Step 3: Implement renderer integration**

```js
const presence = buildWorkHomepagePresence(viewModel);
const hero = `<section class="v14-hero v25-glass-hero" data-home-presence="work" data-presence-tone="${escapeHtml(presence.tone)}">
  <div><span class="v14-kicker">${escapeHtml(presence.kicker)}</span><h2>${escapeHtml(presence.title)}</h2><p>${escapeHtml(presence.summary)}</p>
  <div class="v14-hero-actions"><button class="v13-action v13-action-primary" data-page="${escapeHtml(presence.primaryAction.target)}">${escapeHtml(presence.primaryAction.label)}</button><button class="v13-action" data-quick-capture>${escapeHtml(presence.secondaryAction.label)}</button></div></div>
  <div class="v14-hero-aside">${weatherSummary(viewModel.weather)}</div>
</section>`;
```

For life, map `important-dates` to `data-important-dates-open="life"`; otherwise use existing `data-life-capture`. Keep private-date import as a secondary action.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/homepage-presence.test.mjs tests/important-dates-view.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/views/dashboard-view.mjs src/app/views/life-view.mjs tests/homepage-presence.test.mjs
git commit -m "feat: render dynamic work and life briefs"
```

### Task 3: Add lightweight material, tactile feedback, and responsive fallback

**Files:**
- Modify: `assets/app.css:1600-1810, 2260-2410`
- Modify: `tests/homepage-presence.test.mjs`

**Interfaces:**
- Consumes: `v25-glass-hero`, `data-home-presence`, and existing `v13-action`.
- Produces: scoped glass material, 120–180ms press response, static fallback, and reduced-motion behavior.

- [ ] **Step 1: Write the failing style test**

```js
test('homepage material has a readable fallback and reduced-motion override', () => {
  const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.v25-glass-hero[\s\S]*background:/);
  assert.match(css, /@supports \(backdrop-filter: blur\(1px\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.v25-glass-hero/);
});
```

This catches removal of the static fallback or an accessibility regression in the product stylesheet.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/homepage-presence.test.mjs`
Expected: FAIL because `.v25-glass-hero` does not exist.

- [ ] **Step 3: Add scoped CSS**

```css
.v25-glass-hero { position: relative; overflow: hidden; background: linear-gradient(125deg, rgba(28,43,67,.94), rgba(23,19,25,.96)); }
@supports (backdrop-filter: blur(1px)) {
  .v25-glass-hero { background: linear-gradient(125deg, rgba(38,58,88,.62), rgba(38,26,26,.62)); backdrop-filter: blur(14px) saturate(118%); }
  .v25-glass-hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; border: 1px solid rgba(255,255,255,.15); border-radius: inherit; }
}
.v25-glass-hero .v13-action:active { transform: scale(.985); transition-duration: 120ms; }
@media (prefers-reduced-motion: reduce) { .v25-glass-hero, .v25-glass-hero * { transition: none; animation: none; } }
```

Add mobile rules that keep the primary action first and prevent hero buttons from exceeding the container width. Do not add mouse tracking, canvas, WebGL, SVG displacement, or `requestAnimationFrame`.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/homepage-presence.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/app.css tests/homepage-presence.test.mjs
git commit -m "style: add accessible homepage glass material"
```

### Task 4: Archive and release verification

**Files:**
- Modify: `CHANGELOG.md`
- Create: `docs/releases/zos-ceo-os-v2.5.1.md`
- Modify: `sw.js`, `manifest.json`, and module version query strings only if the release version advances.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: versioned release note with scope, visual behavior, data boundary, validation results, rollback tag, and no secrets.

- [ ] **Step 1: Update release ledger**

Record that v2.5.1 changes only work/life homepage expression and CSS; it does not change data sources or write behavior. Record prior tag `zos-workbench-v2.5.0` as rollback target.

- [ ] **Step 2: Run source and full tests**

Run: `node --check src/app/homepage-presence.mjs && node --check src/app/views/dashboard-view.mjs && node --check src/app/views/life-view.mjs && node --test tests/*.test.mjs`
Expected: exit 0 and full pass count recorded verbatim.

- [ ] **Step 3: Perform three-size visual inspection**

Open production-equivalent app at `#dashboard` and `#life` at desktop, tablet, and mobile widths. Verify dynamic hero title, readable actions, no horizontal overflow, no console errors, reduced-motion fallback CSS, and no life titles on work page.

- [ ] **Step 4: Run production asset checks after deploy**

Run: `curl -fsSL https://xz1220z-afk.github.io/zos-workbench/ | rg 'v=2.5.1'` and verify `manifest.json` and `sw.js` expose the same release version before claiming production is live.

- [ ] **Step 5: Create an immutable archive and publish**

```bash
git add CHANGELOG.md docs/releases/zos-ceo-os-v2.5.1.md sw.js manifest.json index.html src assets tests
git commit -m "feat: refine daily homepage presence"
git tag zos-workbench-v2.5.1
git push origin main --follow-tags
```

Do not include `.superpowers/`. The Git commit, pushed tag, and release note form the version archive; rollback is `git revert` or restoring `zos-workbench-v2.5.0`, not deleting user data.
