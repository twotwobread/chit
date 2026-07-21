# Chit Pure Dark Graphite UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Chit Pure Dark Graphite UI direction across shared mobile design primitives and core app screens without copying Toss 1:1.

**Architecture:** Start with token/source-guard tests, then update shared design tokens and primitives, then migrate navigation shell, core root screens, trip tabs, forms, and overlay surfaces. Keep behavior/routing/API untouched; most verification is source-guard, unit, typecheck, and smoke evidence.

**Tech Stack:** Expo / React Native, TypeScript, Expo Router, Node test runner (`node:test`), pnpm workspaces, existing `apps/mobile/lib/design` foundation/component/pattern layers.

## Global Constraints

- Do not clone Toss proprietary UI 1:1; use broad dark fintech polish principles and keep Chit-owned visual identity.
- Default app UI language: `Pure Dark Graphite` — near-black shell, dark graphite app bars/tabs/cards/lists/forms/sheets, off-white text tiers, sparse Acid Lime signals.
- Off-white is not a default card/sheet/form surface; it is an explicit escape for long-readability, legal, export/share, or accessibility-driven contexts only.
- Graphite is the default primary CTA fill; Acid Lime is rare and explicit.
- Use `Compact Premium Dark`: hero titles, total spend, settlement results, and next actions are large; repeated rows/chips/settings/forms are compact, aligned, and 44pt+ touch-safe.
- Avoid prior visual issues: large floating off-white blocks, repeated Acid Lime fills, over-rounded pill/card repetition, weak all-bold hierarchy, clipped day chips/carousels, appbar misalignment, unsafe sheet/safe-area spacing, placeholder-quality place cards.
- No API, DB, auth, route, or business-logic changes.
- Use theme tokens only; no raw screen hex colors or ad-hoc `rgba(...)` outside token/theme definitions.
- Keep Korean copy short, confident, and clear; do not make error states sarcastic.
- Platform parity: report iOS and Android smoke status for runtime UI changes.

---

## Scope and slice strategy

This is broad app-wide visual work. Implement it in staged commits but keep this branch coherent:

1. Token and source guard update.
2. Shared design primitives update.
3. Navigation shell update.
4. Root screens update.
5. Trip tabs and map/search update.
6. Forms/detail flows update.
7. Verification and screenshot/device smoke.

## Files likely to change

### Design tokens and primitives

- `apps/mobile/lib/design/theme.ts` — Pure Dark Graphite color/layer tokens, text tiers, radius/density tuning.
- `apps/mobile/lib/design/foundation/surface-frame.tsx` — dark default surfaces.
- `apps/mobile/lib/design/components/card.tsx` — `Card`, `BrandStamp`, `ScreenBackground` dark defaults.
- `apps/mobile/lib/design/components/button.tsx` — Graphite CTA default, rare Lime support.
- `apps/mobile/lib/design/components/chip.tsx` — dark selected chips with small Lime signal.
- `apps/mobile/lib/design/components/tab-button.tsx` — selected tabs use dark surface + Lime underline/dot/edge.
- `apps/mobile/lib/design/components/floating-action-button.tsx` — routine FAB is dark with Lime icon/signal.
- `apps/mobile/lib/design/components/row.tsx`, `badge.tsx`, `amount-text.tsx`, `avatar.tsx`, `place.tsx`, `segmented-control.tsx`, `selectable-card.tsx` — dark row/badge/card variants and compact density.
- `apps/mobile/lib/design/patterns/hero.tsx` — Pure Dark Graphite hero defaults, Graphite primary CTA default.
- `apps/mobile/lib/design/patterns/form-field.tsx`, `input-field.tsx`, `state-card.tsx` — dark form/state surfaces.

### Navigation and shell

- `apps/mobile/lib/navigation/BottomMenu.tsx`
- `apps/mobile/lib/navigation/TripTabBar.tsx`
- `apps/mobile/lib/navigation/tab-selection.ts`
- `apps/mobile/lib/trip-ui/AppBar.tsx`
- `apps/mobile/lib/trip-ui/TripScreenScaffold.tsx`
- `apps/mobile/lib/trip-ui/BottomSheet.tsx`
- `apps/mobile/lib/trip-ui/TripRootFab.tsx`
- `apps/mobile/lib/trip-ui/DayChips.tsx`

### Core screens and trip UI

- Root: `apps/mobile/app/login.tsx`, `apps/mobile/app/index.tsx`, `apps/mobile/app/mypage.tsx`, `apps/mobile/app/notifications.tsx`, `apps/mobile/app/account.tsx`.
- Trip creation/edit/detail: `apps/mobile/app/trips/new.tsx`, `apps/mobile/app/trips/[tripId]/detail.tsx`, `apps/mobile/app/trips/[tripId]/edit.tsx`.
- Trip tabs: `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`, `map.tsx`, `itinerary.tsx`, `expenses.tsx`, `settle.tsx`.
- Day/edit/search flows: `apps/mobile/app/trips/[tripId]/days/[date].tsx`, place search/manual add, expense quick/edit flows.
- Trip UI parts: `apps/mobile/lib/home-ui/TripCards.tsx`, `apps/mobile/lib/account-ui/AccountRows.tsx`, `apps/mobile/lib/trip-ui/*` screen-part/style files including `NextPlaceHeroCard.tsx`, `TodaySpendCard.tsx`, `TripMapScreenParts.tsx`, `TripMapScreenStyles.ts`, `DayItineraryEditorStyles.ts`, `ExpenseRow.tsx`, `ParticipantsScreenParts.tsx`, `ParticipantsScreenStyles.ts`, `MyPageParts.tsx`, `MyPageStyles.ts`, flight UI files.

### Tests/source guards

- `apps/mobile/lib/app-info/chit-ui-foundation.test.mts` — update old off-white/dark-shell assertions to Pure Dark Graphite assertions.
- `apps/mobile/lib/app-info/shared-design-primitives.test.mts` — update Hero/FAB/Tab/Button source assertions.
- Add if useful: `apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts` — focused source guard for no default off-white surfaces and no repeated Lime fills.
- Existing focused tests may need source assertion updates where they encode Lime CTA/default off-white behavior.

---

## Test-first plan

Use source-guard tests first because this is a broad visual refactor and there is no visual regression infrastructure yet.

The first failing tests should assert:

- theme default `surface`, `surfaceSoft`, `surfaceSunken`, `bg`, `shell`, `shellElevated`, `actionPrimary`, `primary` reflect Pure Dark Graphite semantics;
- `SurfaceFrame`/`Card` default surfaces are dark graphite, not off-white;
- `TabButton` selected surface is not `theme.color.primary` full fill;
- `FloatingActionButton` routine default is graphite, not Lime;
- `HeroActions` default primary action stays Graphite unless `tone: 'lime'` is explicit;
- representative root/trip surfaces import and use shared dark primitives;
- no screen source introduces raw colors or local Lime-heavy selected fills.

---

### Task 1: Pure Dark Graphite token and source guard baseline

**Files:**
- Modify: `apps/mobile/lib/design/theme.ts`
- Modify: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`
- Modify: `apps/mobile/lib/app-info/shared-design-primitives.test.mts`
- Create: `apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts`

**Interfaces:**
- Consumes: existing `theme.color.*`, `theme.layout.*`, `theme.radius.*` public shape.
- Produces: stable Pure Dark token names through existing semantic keys: `bg`, `surface`, `surfaceSunken`, `surfaceSoft`, `shell`, `shellElevated`, `shellRaised`, `shellHighest`, `actionPrimary`, `onActionPrimary`, `primary`, `onPrimary`, `uiAccent`, `uiAccentSoft`, text tiers.

- [x] **Step 1: Write failing Pure Dark theme tests**

Add this test to `apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

test('Pure Dark Graphite tokens make dark graphite the default app surface', () => {
  assert.equal(theme.color.bg, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shell, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shellElevated, theme.color.chit.graphiteRaised);
  assert.equal(theme.color.surface, theme.color.chit.graphiteCard);
  assert.equal(theme.color.surfaceSoft, theme.color.chit.graphiteElevated);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.graphiteSunken);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.offWhiteText);
  assert.notEqual(theme.color.surface, theme.color.chit.offWhiteElevated);
  assert.notEqual(theme.color.surfaceSunken, theme.color.chit.offWhiteSubtle);
  assert.notEqual(theme.color.primary, theme.color.actionPrimary);
});

test('Pure Dark Graphite keeps off-white as text or escape only', () => {
  assert.equal(theme.color.textStrong, theme.color.chit.offWhiteText);
  assert.equal(theme.color.textBody, theme.color.chit.mutedText);
  assert.equal(theme.color.textMuted, theme.color.chit.faintText);
  assert.equal(theme.color.lightEscape, theme.color.chit.offWhiteElevated);
});

test('mobile UI rule documents Pure Dark Graphite and Compact Premium Dark', () => {
  const rule = readFileSync(new URL('../../../../.harness/rules/code/mobile-ui.md', import.meta.url), 'utf8');
  assert.match(rule, /Pure Dark Graphite/);
  assert.match(rule, /Compact Premium Dark/);
  assert.match(rule, /large floating off-white blocks/);
  assert.match(rule, /placeholder-quality place cards/);
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="Pure Dark Graphite"
```

Expected: FAIL because `theme.color.chit.graphiteShell` and related Pure Dark tokens do not exist yet, or because `surface` still maps to off-white.

- [x] **Step 3: Update `theme.ts` tokens**

In `apps/mobile/lib/design/theme.ts`, extend `chit` and remap semantic tokens. Preserve existing old aliases only when needed for compatibility.

```ts
const chit = {
  charcoal: '#111315',
  matteCharcoal: '#191B1F',
  graphiteShell: '#101215',
  graphiteRaised: '#1A1E23',
  graphiteCard: '#20252B',
  graphiteElevated: '#262C33',
  graphiteHighest: '#303740',
  graphiteSunken: '#171B20',
  graphiteLine: 'rgba(255,255,255,0.08)',
  graphiteLineStrong: 'rgba(255,255,255,0.15)',
  offWhiteText: '#F7F7F2',
  mutedText: '#C5C9C1',
  faintText: '#8E958B',
  acidLime: '#C8FF00',
  acidLimeHover: '#B8F000',
  acidLimePressed: '#A6DB00',
  acidLimeSurface: '#273218',
  acidLimeSurfacePressed: '#1E2814',
  offWhite: '#F7F7F2',
  offWhiteElevated: '#FCFCF8',
  offWhiteSubtle: '#F0F0EA',
  offWhiteBorder: '#E4E3DA',
  warmPaper: '#F5F1E8',
  fintechBlue: '#78A7FF',
  fintechBlueSoft: '#18243A',
  punchRed: '#FF5A67',
  punchRedSoft: '#321A20',
  stampCoral: '#FF765C',
  stampCoralSoft: '#33211E',
} as const;
```

Then set semantic mappings like this:

```ts
export const color = {
  chit,
  // keep palettes here...
  primary: chit.acidLime,
  primaryHover: chit.acidLimeHover,
  primaryPressed: chit.acidLimePressed,
  primarySoft: chit.acidLimeSurface,
  onPrimary: chit.charcoal,
  brandAccent: chit.acidLime,
  actionPrimary: chit.graphiteHighest,
  actionPrimaryPressed: chit.graphiteElevated,
  onActionPrimary: chit.offWhiteText,
  uiAccent: chit.acidLime,
  uiAccentSoft: chit.acidLimeSurface,
  onUiAccent: chit.charcoal,
  bg: chit.graphiteShell,
  surface: chit.graphiteCard,
  surfaceSunken: chit.graphiteSunken,
  surfaceSoft: chit.graphiteElevated,
  lightEscape: chit.offWhiteElevated,
  shell: chit.graphiteShell,
  shellElevated: chit.graphiteRaised,
  shellRaised: chit.graphiteElevated,
  shellHighest: chit.graphiteHighest,
  textStrong: chit.offWhiteText,
  textBody: chit.mutedText,
  textMuted: chit.faintText,
  textFaint: 'rgba(247,247,242,0.48)',
  textOnDark: chit.offWhiteText,
  textOnShell: chit.offWhiteText,
  textOnShellMuted: 'rgba(247,247,242,0.72)',
  textOnShellFaint: 'rgba(247,247,242,0.52)',
  textLink: chit.fintechBlue,
  primaryTextOnLight: chit.offWhiteText,
  borderSubtle: chit.graphiteLine,
  borderDefault: chit.graphiteLine,
  borderStrong: chit.graphiteLineStrong,
  success: chit.acidLime,
  danger: chit.punchRed,
  warning: chit.stampCoral,
  info: chit.fintechBlue,
  credit: chit.fintechBlue,
  debit: chit.punchRed,
} as const;
```

- [x] **Step 4: Update old source assertions**

In `chit-ui-foundation.test.mts`, replace the old test named `Issue 385 theme exposes clean matte dark shell and off-white content tokens` with:

```ts
test('Issue 385 theme exposes Pure Dark Graphite surface tokens', () => {
  assert.equal(theme.color.bg, theme.color.chit.graphiteShell);
  assert.equal(theme.color.surface, theme.color.chit.graphiteCard);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.graphiteSunken);
  assert.equal(theme.color.borderDefault, theme.color.chit.graphiteLine);
  assert.equal(theme.color.shell, theme.color.chit.graphiteShell);
  assert.equal(theme.color.brandAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.shellHighest, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.uiAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.uiAccentSoft, theme.color.chit.acidLimeSurface);
  assert.notEqual(theme.color.actionPrimary, theme.color.brandAccent);
  assert.notEqual(theme.color.surface, theme.color.chit.warmPaper);
  assert.notEqual(theme.color.surface, theme.color.chit.offWhiteElevated);
});
```

- [x] **Step 5: Run token tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="Pure Dark Graphite|Issue 385 theme"
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/lib/design/theme.ts apps/mobile/lib/app-info/chit-ui-foundation.test.mts apps/mobile/lib/app-info/shared-design-primitives.test.mts apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts
git commit -m "feat: add pure dark graphite theme tokens"
```

---

### Task 2: Shared dark surfaces, buttons, chips, tabs, and FAB

**Files:**
- Modify: `apps/mobile/lib/design/foundation/surface-frame.tsx`
- Modify: `apps/mobile/lib/design/components/card.tsx`
- Modify: `apps/mobile/lib/design/components/button.tsx`
- Modify: `apps/mobile/lib/design/components/chip.tsx`
- Modify: `apps/mobile/lib/design/components/tab-button.tsx`
- Modify: `apps/mobile/lib/design/components/floating-action-button.tsx`
- Modify: `apps/mobile/lib/design/patterns/hero.tsx`
- Modify: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`
- Modify: `apps/mobile/lib/app-info/shared-design-primitives.test.mts`

**Interfaces:**
- Consumes: Pure Dark semantic tokens from Task 1.
- Produces: shared components whose default visual language is dark graphite; later screens can migrate mostly by using existing components.

- [x] **Step 1: Write failing source assertions for shared primitives**

In `pure-dark-graphite-ui.test.mts`, add:

```ts
const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('shared surfaces default to dark graphite instead of off-white', () => {
  const surfaceFrame = read('../design/foundation/surface-frame.tsx');
  const card = read('../design/components/card.tsx');
  const hero = read('../design/patterns/hero.tsx');

  assert.match(surfaceFrame, /frame:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.match(surfaceFrame, /graphite:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(card, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.match(hero, /heroCardPanel:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.doesNotMatch(hero, /tone: 'lime' as PrimaryButtonTone, \.\.\.primary/);
});

test('routine nav and floating actions avoid full Acid Lime fill', () => {
  const tabButton = read('../design/components/tab-button.tsx');
  const fab = read('../design/components/floating-action-button.tsx');

  assert.doesNotMatch(tabButton, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.primary/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*borderBottomColor: theme\.color\.uiAccent/);
  assert.doesNotMatch(fab, /tone = 'lime'/);
  assert.match(fab, /tone = 'graphite'/);
});
```

- [x] **Step 2: Run assertions to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="shared surfaces|routine nav"
```

Expected: FAIL because Hero still defaults Lime and selected tabs/FAB are Lime-heavy.

- [x] **Step 3: Update SurfaceFrame/Card defaults**

In `surface-frame.tsx`, keep `variant='content'` but make all variants dark by relying on Task 1 semantic tokens:

```ts
const styles = StyleSheet.create({
  frame: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[5],
    width: '100%',
    ...theme.shadow.sm,
  },
  hero: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    gap: theme.space[5],
    padding: theme.space[6],
    ...theme.shadow.md,
  },
  graphite: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderStrong,
    ...theme.shadow.md,
  },
  dark: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.borderStrong,
    ...theme.shadow.md,
  },
  shelf: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    shadowOpacity: 0,
  },
});
```

- [x] **Step 4: Update HeroActions default CTA**

In `patterns/hero.tsx`, change:

```ts
const primaryAction = { tone: 'lime' as PrimaryButtonTone, ...primary };
```

to:

```ts
const primaryAction = { tone: 'graphite' as PrimaryButtonTone, ...primary };
```

Also make `heroCardPanel`, `heroCardSplit`, `heroSplitBody`, `metricPanelNeutral`, and `heroEyebrow` use dark semantic tokens.

- [x] **Step 5: Update TabButton selected style**

In `components/tab-button.tsx`, keep icon/text selected contrast but change the selected container:

```ts
tabButtonSelected: {
  backgroundColor: theme.color.surfaceSoft,
  borderBottomColor: theme.color.uiAccent,
  borderBottomWidth: 3,
}
```

Remove `...theme.shadow.xs` if it makes the tab look like a floating Lime pill.

- [x] **Step 6: Update FloatingActionButton default**

In `components/floating-action-button.tsx`, set default tone to graphite:

```ts
export function FloatingActionButton({ tone = 'graphite', ...props }: FloatingActionButtonProps) {
  // existing implementation
}
```

Ensure the icon passed by callers can still use `theme.color.uiAccent` for the small Lime signal.

- [x] **Step 7: Update chip selected styles**

In `components/chip.tsx`, make selected dense UI use dark surfaces:

```ts
filterChipSelected: {
  backgroundColor: theme.color.uiAccentSoft,
  borderColor: theme.color.uiAccent,
},
filterChipSelectedAccent: {
  backgroundColor: theme.color.uiAccentSoft,
  borderColor: theme.color.uiAccent,
},
choiceChipSelectedAccent: {
  backgroundColor: theme.color.uiAccentSoft,
  borderColor: theme.color.uiAccent,
},
```

Keep text readable on dark surfaces with `theme.color.textStrong`, not `onPrimary` when the fill is not full Lime.

- [x] **Step 8: Update old source tests to new expectations**

Replace assertions that require `tone: 'lime'`, selected tab primary fill, or FAB Lime default with new Pure Dark expectations. Keep one explicit Lime test that verifies Lime is possible when a caller opts in.

- [x] **Step 9: Run shared primitive tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="Pure Dark Graphite|shared design|shared surfaces|routine nav|Hero"
```

Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add apps/mobile/lib/design apps/mobile/lib/app-info/chit-ui-foundation.test.mts apps/mobile/lib/app-info/shared-design-primitives.test.mts apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts
git commit -m "feat: convert shared primitives to pure dark graphite"
```

---

### Task 3: Navigation shell and safe-area chrome

**Files:**
- Modify: `apps/mobile/lib/navigation/BottomMenu.tsx`
- Modify: `apps/mobile/lib/navigation/TripTabBar.tsx`
- Modify: `apps/mobile/lib/navigation/tab-selection.ts`
- Modify: `apps/mobile/lib/trip-ui/AppBar.tsx`
- Modify: `apps/mobile/lib/trip-ui/TripScreenScaffold.tsx`
- Modify: `apps/mobile/lib/trip-ui/BottomSheet.tsx`
- Modify: `apps/mobile/lib/trip-ui/TripRootFab.tsx`
- Modify: `apps/mobile/lib/trip-ui/DayChips.tsx`
- Modify: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`

**Interfaces:**
- Consumes: updated shared `TabButton`, `FloatingActionButton`, dark Card/ScreenBackground.
- Produces: dark shell navigation used by all root and trip screens.

- [x] **Step 1: Write failing nav source assertions**

Add to `pure-dark-graphite-ui.test.mts`:

```ts
test('navigation shell uses dark selected surfaces and avoids Lime capsules', () => {
  const bottomMenu = read('../navigation/BottomMenu.tsx');
  const tripTabBar = read('../navigation/TripTabBar.tsx');
  const selection = read('../navigation/tab-selection.ts');
  const appBar = read('../trip-ui/AppBar.tsx');
  const dayChips = read('../trip-ui/DayChips.tsx');

  assert.doesNotMatch(selection, /backgroundColor: theme\.color\.primary/);
  assert.match(selection, /backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(bottomMenu, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(tripTabBar, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(appBar, /backgroundColor: theme\.color\.shell/);
  assert.match(dayChips, /FilterChip/);
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="navigation shell"
```

Expected: FAIL while `tab-selection.ts` still encodes primary/Lime selected fill.

- [x] **Step 3: Update `tab-selection.ts`**

Replace selected fill with dark selected surface plus explicit signal fields if the helper supports style objects:

```ts
export const selectedTabContainerStyle = {
  backgroundColor: theme.color.surfaceSoft,
  borderBottomColor: theme.color.uiAccent,
  borderBottomWidth: 3,
};
```

If the helper currently returns only background/shadow, update callers/tests together to preserve route behavior.

- [x] **Step 4: Update BottomMenu and TripTabBar containers**

Ensure wrappers use:

```ts
backgroundColor: theme.color.shellElevated,
borderTopColor: theme.color.borderDefault,
```

Keep route calls unchanged: `router.replace('/')`, `router.replace('/mypage')`, `tripTabPathWithState(...)`.

- [x] **Step 5: Update AppBar grid alignment**

In `AppBar.tsx`, keep the same data/route behavior but ensure leading icon, title, utility action, and avatar use fixed token sizes and `alignItems: 'center'`. Avoid raw positional tweaks.

- [x] **Step 6: Update BottomSheet surface**

In `BottomSheet.tsx`, make sheet frame dark:

```ts
backgroundColor: theme.color.shellElevated,
borderColor: theme.color.borderDefault,
```

Make the handle use a tokenized border/text tier, not raw rgba.

- [x] **Step 7: Run nav and context-bound checks**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="navigation shell|navigation chrome|tab"
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add apps/mobile/lib/navigation apps/mobile/lib/trip-ui/AppBar.tsx apps/mobile/lib/trip-ui/TripScreenScaffold.tsx apps/mobile/lib/trip-ui/BottomSheet.tsx apps/mobile/lib/trip-ui/TripRootFab.tsx apps/mobile/lib/trip-ui/DayChips.tsx apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts apps/mobile/lib/app-info/chit-ui-foundation.test.mts
git commit -m "feat: apply pure dark navigation shell"
```

---

### Task 4: Root screens and account surfaces

**Files:**
- Modify: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/app/mypage.tsx`
- Modify: `apps/mobile/app/notifications.tsx`
- Modify: `apps/mobile/app/account.tsx`
- Modify: `apps/mobile/lib/home-ui/TripCards.tsx`
- Modify: `apps/mobile/lib/account-ui/AccountRows.tsx`
- Modify: `apps/mobile/lib/trip-ui/MyPageParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/MyPageStyles.ts`
- Modify: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`

**Interfaces:**
- Consumes: dark shared Card, Button, StateCard, BottomMenu.
- Produces: login/home/mypage/notifications/account consistent with Pure Dark Graphite.

- [x] **Step 1: Write root-screen source assertions**

Add to `pure-dark-graphite-ui.test.mts`:

```ts
test('root screens use Pure Dark Graphite shared surfaces without local off-white blocks', () => {
  for (const relativePath of [
    '../../app/login.tsx',
    '../../app/index.tsx',
    '../../app/mypage.tsx',
    '../../app/notifications.tsx',
    '../home-ui/TripCards.tsx',
    '../trip-ui/MyPageParts.tsx',
    '../trip-ui/MyPageStyles.ts',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /offWhiteElevated|offWhiteSubtle|warmPaper/);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
  }
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="root screens use Pure Dark"
```

Expected: FAIL where old hero cards or CTA styles still use `theme.color.primary` or old off-white tokens.

- [x] **Step 3: Update login**

Keep provider button brand colors. Update the surrounding card/hero styles to dark tokens. Keep BrandStamp as the main Lime brand moment.

- [x] **Step 4: Update home trip cards**

In `TripCards.tsx`, make current-trip hero a dark graphite card with Graphite CTA. If an explicit Lime signal is needed, use badge/dot/BrandStamp, not a giant Lime button.

- [x] **Step 5: Update mypage/account rows**

Use dark cards/rows. Keep settings rows compact with `theme.layout.tapMin` minHeight and muted metadata.

- [x] **Step 6: Update notifications rows**

Unread state: small Lime dot plus explicit/readable text context. Do not use Lime as the whole row background.

- [x] **Step 7: Run root-screen focused tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="root screens|My Page|Notifications|Home"
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add apps/mobile/app/login.tsx apps/mobile/app/index.tsx apps/mobile/app/mypage.tsx apps/mobile/app/notifications.tsx apps/mobile/app/account.tsx apps/mobile/lib/home-ui apps/mobile/lib/account-ui apps/mobile/lib/trip-ui/MyPageParts.tsx apps/mobile/lib/trip-ui/MyPageStyles.ts apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts apps/mobile/lib/app-info/chit-ui-foundation.test.mts
git commit -m "feat: migrate root screens to pure dark graphite"
```

---

### Task 5: Trip tabs, expenses, settlement, itinerary, and today

**Files:**
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/expenses.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`
- Modify: `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`
- Modify: `apps/mobile/lib/trip-ui/TodaySpendCard.tsx`
- Modify: `apps/mobile/lib/trip-ui/DayItineraryEditorStyles.ts`
- Modify: `apps/mobile/lib/trip-ui/DayItineraryContent.tsx`
- Modify: `apps/mobile/lib/trip-ui/ItineraryTimeline.tsx`
- Modify: `apps/mobile/lib/trip-ui/ExpenseRow.tsx`
- Modify: `apps/mobile/lib/trip-ui/TransferRow.tsx`

**Interfaces:**
- Consumes: dark shell primitives and Graphite Hero pattern.
- Produces: primary trip tabs using large core moments + compact rows.

- [x] **Step 1: Write trip tab source assertions**

Add to `pure-dark-graphite-ui.test.mts`:

```ts
test('trip tabs use compact premium dark density and avoid routine Lime CTA fill', () => {
  for (const relativePath of [
    '../../app/trips/[tripId]/(tabs)/today.tsx',
    '../../app/trips/[tripId]/(tabs)/itinerary.tsx',
    '../../app/trips/[tripId]/(tabs)/expenses.tsx',
    '../../app/trips/[tripId]/(tabs)/settle.tsx',
    '../trip-ui/NextPlaceHeroCard.tsx',
    '../trip-ui/TodaySpendCard.tsx',
    '../trip-ui/DayItineraryEditorStyles.ts',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
    assert.doesNotMatch(source, /tone="lime"|tone: 'lime'/);
    assert.doesNotMatch(source, /offWhiteElevated|offWhiteSubtle|warmPaper/);
  }
});
```

If one screen truly needs an explicit Lime hero CTA, document that exception in the test with a named allowlist and spec comment.

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="trip tabs use compact"
```

Expected: FAIL where Today/Spend/Map still explicitly use Lime CTA.

- [x] **Step 3: Update Today hero**

Use `HeroCard variant="graphite"` or dark default. Default primary action should be Graphite. Use Lime as small route/selected/brand signal only.

- [x] **Step 4: Update TodaySpendCard**

Keep total amount large. Make add/view actions Graphite/secondary unless a spec explicitly calls for Lime.

- [x] **Step 5: Update expenses**

Total spend hero: dark accent card, large amount. Expense rows: compact dark rows, right-aligned tabular amounts, category badge/icons with semantic colors.

- [x] **Step 6: Update settlement**

Settlement hero may keep Chit brand copy. Credit/debit stays blue/red with `+`/`−`. Do not use Lime for receive/send amount semantics.

- [x] **Step 7: Update itinerary/day editor styles**

Day chips and selected travel mode use dark selected surfaces with Lime edge/dot. Avoid giant full Lime chips.

- [x] **Step 8: Run trip focused tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="Today|expense|settlement|itinerary|trip tabs"
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add apps/mobile/app/trips/[tripId]/\(tabs\) apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx apps/mobile/lib/trip-ui/TodaySpendCard.tsx apps/mobile/lib/trip-ui/DayItineraryEditorStyles.ts apps/mobile/lib/trip-ui/DayItineraryContent.tsx apps/mobile/lib/trip-ui/ItineraryTimeline.tsx apps/mobile/lib/trip-ui/ExpenseRow.tsx apps/mobile/lib/trip-ui/TransferRow.tsx apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts
git commit -m "feat: migrate trip tabs to compact dark graphite"
```

---

### Task 6: Map/search overlays and place cards

**Files:**
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/map.tsx`
- Modify: `apps/mobile/lib/trip-ui/TripMapScreenParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/TripMapScreenStyles.ts`
- Modify: `apps/mobile/lib/trip-ui/GooglePlaceMapSearch.tsx` if present in worktree
- Modify: `apps/mobile/lib/places/*` only if view model needs image/category thumbnail fields already available from API data

**Interfaces:**
- Consumes: dark bottom sheet, dark chips, dark place rows.
- Produces: map/search with polished result cards and no placeholder-quality text blocks.

- [x] **Step 1: Write map/search assertions**

Add to `pure-dark-graphite-ui.test.mts`:

```ts
test('map search overlays use dark surfaces and polished place thumbnails', () => {
  const mapParts = read('../trip-ui/TripMapScreenParts.tsx');
  const mapStyles = read('../trip-ui/TripMapScreenStyles.ts');

  assert.doesNotMatch(mapParts, /tone="lime"|tone: 'lime'/);
  assert.doesNotMatch(mapStyles, /backgroundColor: theme\.color\.primary/);
  assert.match(mapStyles, /backgroundColor: theme\.color\.surface|backgroundColor: theme\.color\.shellElevated/);
  assert.match(mapParts, /photo|thumbnail|category|Place/);
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="map search overlays"
```

Expected: FAIL until map parts/styles stop Lime-heavy and expose polished thumbnail/category treatment.

- [x] **Step 3: Update bottom sheet/search overlay styles**

Use dark `theme.color.shellElevated`, `surface`, `surfaceSunken`, `borderDefault`. Keep provider/context-bound boundaries intact; do not move gesture/map components outside their provider tree.

- [x] **Step 4: Update place cards**

If place photo data exists, show it. If not, use a tokenized dark category thumbnail with vector/category text/icon. Avoid large light green placeholder boxes.

- [x] **Step 5: Run map/context checks**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="map|place|Google"
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/app/trips/[tripId]/\(tabs\)/map.tsx apps/mobile/lib/trip-ui/TripMapScreenParts.tsx apps/mobile/lib/trip-ui/TripMapScreenStyles.ts apps/mobile/lib/trip-ui/GooglePlaceMapSearch.tsx apps/mobile/lib/places apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts
git commit -m "feat: refine map search with dark place cards"
```

---

### Task 7: Forms, participants, flights, trip detail/edit, notifications polish

**Files:**
- Modify: `apps/mobile/app/trips/new.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/detail.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/edit.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/participants.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/flights/index.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/flights/new.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/flights/[flightId].tsx`
- Modify: `apps/mobile/lib/trip-ui/ParticipantsScreenParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/ParticipantsScreenStyles.ts`
- Modify: flight/trip form style helpers as needed

**Interfaces:**
- Consumes: dark form fields, buttons, cards, chips.
- Produces: remaining detail/form flows consistent with core surfaces.

- [x] **Step 1: Write form/detail assertions**

Add to `pure-dark-graphite-ui.test.mts`:

```ts
test('form and detail flows use dark graphite form surfaces', () => {
  for (const relativePath of [
    '../../app/trips/new.tsx',
    '../../app/trips/[tripId]/detail.tsx',
    '../../app/trips/[tripId]/edit.tsx',
    '../../app/trips/[tripId]/participants.tsx',
    '../../app/trips/[tripId]/flights/index.tsx',
    '../trip-ui/ParticipantsScreenParts.tsx',
    '../trip-ui/ParticipantsScreenStyles.ts',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /offWhiteElevated|offWhiteSubtle|warmPaper/);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
  }
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="form and detail flows"
```

Expected: FAIL until remaining form/detail styles stop relying on old off-white/default Lime patterns.

- [x] **Step 3: Update trip creation/edit forms**

Make form fields and date picker dark. Focus state uses border/small Lime signal. Sticky footer buttons remain Graphite/secondary.

- [x] **Step 4: Update participants invite card**

Use dark Acid Lime Surface for invite hero if needed. Keep share buttons compact; Kakao button may keep provider yellow token.

- [x] **Step 5: Update flights**

Use dark vault-like cards, large route codes, compact passenger/time metadata. Do not introduce new route behavior.

- [x] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- --test-name-pattern="trip date|flight|participant|form|sticky"
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/app/trips/new.tsx apps/mobile/app/trips/[tripId]/detail.tsx apps/mobile/app/trips/[tripId]/edit.tsx apps/mobile/app/trips/[tripId]/participants.tsx apps/mobile/app/trips/[tripId]/flights apps/mobile/lib/trip-ui/ParticipantsScreenParts.tsx apps/mobile/lib/trip-ui/ParticipantsScreenStyles.ts apps/mobile/lib/app-info/pure-dark-graphite-ui.test.mts
git commit -m "feat: migrate forms and detail flows to dark graphite"
```

---

### Task 8: Full verification, docs/run artifacts, and smoke status

**Files:**
- Modify: `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/implementation-plan.md` (copy/update plan summary)
- Modify: `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/evaluation-report.md`
- Modify: `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/verification.md`
- Modify: `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/ledger.md`

**Interfaces:**
- Consumes: all implementation commits.
- Produces: evidence needed for completion/PR.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/mobile format:check
pnpm --filter @i-um/mobile lint
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
pnpm harness:validate
```

Expected: all commands exit 0. If `pnpm --filter @i-um/mobile lint` is not available, run repository `pnpm lint` and record that substitution.

- [ ] **Step 2: Run source searches for forbidden patterns**

Run:

```bash
rg -n "warmPaper|offWhiteElevated|offWhiteSubtle|backgroundColor: theme\.color\.primary|tone=\"lime\"|tone: 'lime'" apps/mobile/app apps/mobile/lib --glob '*.tsx' --glob '*.ts'
```

Expected: no routine UI matches. Any remaining match must be an explicitly justified BrandStamp/provider/semantic exception and recorded in `evaluation-report.md`.

- [ ] **Step 3: Record verification artifact**

Write `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/verification.md` with the exact commands, results, and any manual smoke gap.

- [ ] **Step 4: Manual smoke if devices are available**

Smoke at least:

- iOS: login, home, new trip, trip tabs, map search, expense add, settlement, participants, flights, mypage/notifications.
- Android: same matrix.

If device/simulator is unavailable, record explicit gap and do not claim manual smoke passed.

- [ ] **Step 5: Update evaluation report**

Create `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/evaluation-report.md` with acceptance criteria mapping:

```md
# Evaluation Report

## Acceptance criteria

- Pure Graphite Shell default: pass/fail with file evidence.
- Dark graphite cards/lists/forms/sheets: pass/fail with file evidence.
- Off-white default removed: pass/fail with source search evidence.
- Sparse Acid Lime: pass/fail with source search evidence.
- Compact Premium Dark density: pass/fail with representative screenshots/source notes.
- Map/place placeholders replaced: pass/fail with file evidence.
- Behavior unchanged: pass/fail with test evidence.

## Smoke

- iOS: pass/fail/blocked.
- Android: pass/fail/blocked.
```

- [ ] **Step 6: Commit artifacts if needed**

Run artifacts are gitignored; do not force-add them unless project policy explicitly requires it. Commit tracked docs/code only:

```bash
git status --short
git add apps/mobile docs/features .harness/rules/code/mobile-ui.md .pi/rules/mobile-ui.md
git commit -m "feat: apply pure dark graphite UI system"
```

Expected: commit only tracked implementation/docs changes. Do not commit `여비_어플_비교.MP4`.

---

## Verification

Baseline already run in the worktree:

```text
pnpm --filter @i-um/mobile test
# tests 741, pass 741, fail 0
```

Required before completion:

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/mobile format:check
pnpm lint
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
pnpm harness:validate
```

Manual smoke status must be reported for Android and iOS or explicitly marked blocked.

## Risks / rollback

- **Risk:** Broad token remapping may invert many surfaces at once. **Mitigation:** source-guard tests and staged commits.
- **Risk:** Dark-only contrast regressions. **Mitigation:** text tier tokens and screenshot/device smoke.
- **Risk:** Existing tests encode old off-white/Lime behavior. **Mitigation:** update tests only when they assert visual policy, not behavior.
- **Risk:** Map/search overlays are context-bound. **Mitigation:** keep provider-owned components in place and run context-bound UI check.
- **Risk:** Users may perceive dark-only forms as dense. **Mitigation:** Compact Premium Dark keeps key titles/amounts large and repeated rows precise, not tiny.
- **Rollback:** Revert staged commits in reverse order; token-first commit should be reverted last because later commits depend on it.

## Self-review

- Spec coverage: Pure Dark Graphite, sparse Acid Lime, Compact Premium Dark, Off-white Escape, map placeholders, previous visual issues, and platform smoke are all covered by tasks.
- Placeholder scan: no unresolved placeholder markers are present.
- Type consistency: produced/consumed interfaces use existing public `theme` and design component names.
- Scope check: app-wide implementation is split into staged tasks to reduce PR risk.
