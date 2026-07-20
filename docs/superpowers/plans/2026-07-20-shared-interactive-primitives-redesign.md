# Shared Interactive Primitives Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mobile design-system internals into foundation/component/pattern layers, add a Graphite Hero with one Lime CTA pattern, and apply it to representative Today/Expense/Map surfaces for #395.

**Architecture:** Keep `apps/mobile/lib/design/index.ts` as the public surface while moving repeated interaction/accessibility/touch/label/surface logic into `foundation/*`. Public components remain backward-compatible wrappers over focused `components/*` and `patterns/*` modules. Representative screens adopt the new primitives without changing route/data/copy semantics.

**Tech Stack:** Expo React Native, TypeScript, React Native `Pressable`, existing Chit `theme.ts`, Node `node:test` source guards, pnpm workspace scripts.

## Global Constraints

- Existing imports from `../design` must keep compiling.
- No API, DB, auth, route, loading semantics, or navigation behavior changes.
- No raw hex colors, decorative emoji, or new visual language.
- Touch targets remain at least `theme.layout.tapMin` (44pt floor).
- Default `PrimaryButton` remains Graphite; Lime CTA is explicit via `tone="lime"`.
- Hero default visual direction is Graphite-centered with at most one Lime core CTA.
- Preserve Korean copy meaning and current information hierarchy.
- Map/search/bottom-sheet overlays must respect context-bound mobile UI rules.

---

## File Structure

- Create `apps/mobile/lib/design/foundation/accessibility.ts`: shared `buildAccessibilityState` helper.
- Create `apps/mobile/lib/design/foundation/interactive-surface.tsx`: one base `Pressable` wrapper for role/state/pressed/disabled/hitSlop/min-target behavior.
- Create `apps/mobile/lib/design/foundation/responsive-label.tsx`: tokenized text component that computes dynamic line height.
- Create `apps/mobile/lib/design/foundation/surface-frame.tsx`: shared surface/card frame variants.
- Create `apps/mobile/lib/design/foundation/action-group.tsx`: shared action row/wrap spacing.
- Create `apps/mobile/lib/design/components/card.tsx`, `button.tsx`, `icon-button.tsx`, `link.tsx`, `chip.tsx`, `row.tsx`, `badge.tsx`, `amount-text.tsx`, `segmented-control.tsx`: focused public component implementations.
- Create `apps/mobile/lib/design/patterns/hero.tsx`, `form-field.tsx`, `state-card.tsx`: composed reusable patterns.
- Modify `apps/mobile/lib/design/components.tsx` and `primitives.tsx`: compatibility barrels that re-export from the new modules.
- Modify `apps/mobile/lib/design/index.ts`: export new Hero/foundation-backed public types and components.
- Modify `apps/mobile/lib/app-info/shared-design-primitives.test.mts` and `chit-ui-foundation.test.mts`: source guards for new layering, Hero exports, and representative adoption.
- Modify representative surfaces: `NextPlaceHeroCard.tsx`, `TodaySpendCard.tsx`, `expenses.tsx`, `TripMapScreenParts.tsx`.

---

### Task 1: Write source-guard tests for C-layering and Hero adoption

**Files:**
- Modify: `apps/mobile/lib/app-info/shared-design-primitives.test.mts`
- Modify: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`

**Interfaces:**
- Consumes: Existing source-reading helper pattern in both tests.
- Produces: Failing tests that require foundation files, Hero exports, explicit Lime tone, and representative adoption imports/usages.

- [ ] **Step 1: Add failing design-layer guards**

Add these constants near existing source constants in `shared-design-primitives.test.mts`:

```ts
const foundationInteractiveSource = readMobileSource('../design/foundation/interactive-surface.tsx');
const foundationAccessibilitySource = readMobileSource('../design/foundation/accessibility.ts');
const buttonSource = readMobileSource('../design/components/button.tsx');
const heroSource = readMobileSource('../design/patterns/hero.tsx');
```

Add `Hero` public exports to `primitiveExports` or a new Hero export list:

```ts
const heroExports = ['HeroCard', 'HeroHeader', 'HeroMetricPanel', 'HeroActions'];
const heroTypeExports = ['HeroCardVariant', 'HeroAction', 'HeroMetricPanelTone'];
```

Add this test:

```ts
test('Issue 395 shared design layer exposes foundation-backed Hero primitives', () => {
  for (const exportName of heroExports) {
    assert.match(heroSource, new RegExp(`export function ${exportName}\\b`), `${exportName} should be implemented`);
    assert.match(indexSource, new RegExp(`\\b${exportName}\\b`), `${exportName} should be re-exported from design index`);
  }

  for (const exportName of heroTypeExports) {
    assert.match(heroSource, new RegExp(`export type ${exportName}\\b`), `${exportName} type should be public`);
    assert.match(indexSource, new RegExp(`\\b${exportName}\\b`), `${exportName} type should be re-exported from design index`);
  }

  assert.match(foundationAccessibilitySource, /export function buildAccessibilityState/);
  assert.match(foundationInteractiveSource, /export function InteractiveSurface/);
  assert.match(foundationInteractiveSource, /accessibilityState=\{buildAccessibilityState/);
  assert.match(foundationInteractiveSource, /minHeight: minHeight \?\? theme\.layout\.tapMin/);
  assert.match(foundationInteractiveSource, /Pressable/);

  assert.match(buttonSource, /export type PrimaryButtonTone = 'graphite' \| 'lime'/);
  assert.match(buttonSource, /tone = 'graphite'/);
  assert.match(buttonSource, /primaryButtonLime/);
  assert.match(buttonSource, /backgroundColor: theme\.color\.uiAccent/);
  assert.match(buttonSource, /color: theme\.color\.onUiAccent/);

  assert.match(heroSource, /variant = 'panel'/);
  assert.match(heroSource, /HeroActions/);
  assert.match(heroSource, /tone: 'lime'/);
  assert.match(heroSource, /theme\.color\.actionPrimary/);
  assert.match(heroSource, /theme\.color\.uiAccent/);
  assert.doesNotMatch(heroSource, /#[0-9a-fA-F]{3,8}\b/);
});
```

- [ ] **Step 2: Add failing representative adoption guards**

Add these constants to `chit-ui-foundation.test.mts`:

```ts
const expensesSource = readMobileSource('../../app/trips/[tripId]/(tabs)/expenses.tsx');
const todaySpendSource = readMobileSource('../trip-ui/TodaySpendCard.tsx');
const nextPlaceHeroSource = readMobileSource('../trip-ui/NextPlaceHeroCard.tsx');
const mapPartsSource = readMobileSource('../trip-ui/TripMapScreenParts.tsx');
```

Add this test:

```ts
test('Issue 395 representative surfaces adopt Hero and shared action primitives', () => {
  assert.match(nextPlaceHeroSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroHeader/);
  assert.doesNotMatch(nextPlaceHeroSource, /<Pressable/);
  assert.match(todaySpendSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroMetricPanel/);
  assert.match(todaySpendSource, /tone="lime"/);
  assert.match(expensesSource, /import \{[\s\S]*FilterChip[\s\S]*InlineAction[\s\S]*TextLink/);
  assert.doesNotMatch(expensesSource, /function FilterChip\(/);
  assert.match(mapPartsSource, /import \{[\s\S]*FilterChip[\s\S]*PrimaryButton/);
  assert.match(mapPartsSource, /tone="lime"/);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/app-info/shared-design-primitives.test.mts lib/app-info/chit-ui-foundation.test.mts
```

Expected: FAIL because `../design/foundation/*` and `../design/patterns/hero.tsx` do not exist and representative surfaces do not import the new components.

- [ ] **Step 4: Commit RED tests only if project convention allows red commits**

Do not commit failing tests alone unless explicitly requested. Keep the RED evidence in `.harness/runs/F395-primitive-components-redesign/artifacts/ledger.md` instead.

---

### Task 2: Add foundation primitives and compatibility-preserving component modules

**Files:**
- Create: `apps/mobile/lib/design/foundation/accessibility.ts`
- Create: `apps/mobile/lib/design/foundation/interactive-surface.tsx`
- Create: `apps/mobile/lib/design/foundation/responsive-label.tsx`
- Create: `apps/mobile/lib/design/foundation/surface-frame.tsx`
- Create: `apps/mobile/lib/design/foundation/action-group.tsx`
- Create: `apps/mobile/lib/design/components/card.tsx`
- Create: `apps/mobile/lib/design/components/button.tsx`
- Create: `apps/mobile/lib/design/components/icon-button.tsx`
- Create: `apps/mobile/lib/design/components/link.tsx`
- Create: `apps/mobile/lib/design/components/chip.tsx`
- Create: `apps/mobile/lib/design/components/row.tsx`
- Create: `apps/mobile/lib/design/components/badge.tsx`
- Create: `apps/mobile/lib/design/components/amount-text.tsx`
- Create: `apps/mobile/lib/design/components/segmented-control.tsx`
- Modify: `apps/mobile/lib/design/components.tsx`
- Modify: `apps/mobile/lib/design/primitives.tsx`
- Modify: `apps/mobile/lib/design/index.ts`

**Interfaces:**
- Consumes: `theme`, `responsive-text.ts` helpers.
- Produces: Existing public components plus `PrimaryButtonTone`; all existing call sites keep compiling.

- [ ] **Step 1: Implement `buildAccessibilityState`**

Create `accessibility.ts` with:

```ts
import type { PressableProps } from 'react-native';

export function buildAccessibilityState({
  busy,
  disabled,
  expanded,
  selected,
}: {
  busy?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
}): PressableProps['accessibilityState'] {
  const state: NonNullable<PressableProps['accessibilityState']> = {};
  if (busy !== undefined) state.busy = busy;
  if (disabled !== undefined) state.disabled = disabled;
  if (expanded !== undefined) state.expanded = expanded;
  if (selected !== undefined) state.selected = selected;
  return state;
}
```

- [ ] **Step 2: Implement `InteractiveSurface`**

Create `interactive-surface.tsx` with an exported component accepting `role`, `disabled`, `busy`, `selected`, `hitSlop`, `minHeight`, `minWidth`, `style`, and `children`, internally rendering React Native `Pressable` and applying `buildAccessibilityState` plus `theme.layout.tapMin` defaults.

- [ ] **Step 3: Implement `ResponsiveLabel`**

Create `responsive-label.tsx` exporting a `ResponsiveLabel` component that wraps `Text`, computes line height using `buildResponsiveLineHeight`, and accepts `children`, `fontSize`, `leading`, `style`, `numberOfLines`, `accessibilityLabel`.

- [ ] **Step 4: Implement `SurfaceFrame` and `ActionGroup`**

Create `surface-frame.tsx` exporting `SurfaceFrame` with `variant: 'content' | 'hero' | 'dark' | 'shelf' | 'graphite'`. Create `action-group.tsx` exporting `ActionGroup` with `direction?: 'row' | 'column'` and consistent tokenized gaps.

- [ ] **Step 5: Move component implementations into focused files**

Move current component logic into focused modules. Existing function signatures must remain. `PrimaryButton` adds optional `tone?: 'graphite' | 'lime'` defaulting to `'graphite'`; `SecondaryButton`, `IconButton`, `TextLink`, `InlineAction`, `ActionRow`, `FilterChip`, `ChoiceChip` should use `InteractiveSurface` where practical.

- [ ] **Step 6: Convert compatibility barrels**

Make `components.tsx` re-export from `components/*` and `patterns/*` as needed. Make `primitives.tsx` re-export `Badge`, `Pill`, `Chip`, `AmountText`, `PlacePin`, `PlaceTag`, `Avatar`, `AvatarGroup`, `ListRow`, `SegmentedControl` from focused modules.

- [ ] **Step 7: Run focused tests and verify GREEN for component exports**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/app-info/shared-design-primitives.test.mts
```

Expected: PASS for public export/foundation tests except Hero tests if Hero is not implemented until Task 3.

---

### Task 3: Add Hero pattern exports

**Files:**
- Create: `apps/mobile/lib/design/patterns/hero.tsx`
- Modify: `apps/mobile/lib/design/components.tsx`
- Modify: `apps/mobile/lib/design/index.ts`
- Modify: `apps/mobile/lib/app-info/shared-design-primitives.test.mts`

**Interfaces:**
- Consumes: `Card`, `PrimaryButton`, `SecondaryButton`, `ActionGroup`, `ResponsiveLabel`, `SurfaceFrame`, `theme`.
- Produces: `HeroCard`, `HeroHeader`, `HeroMetricPanel`, `HeroActions` and public types.

- [ ] **Step 1: Implement Hero components**

Create `patterns/hero.tsx` with:

```ts
export type HeroCardVariant = 'panel' | 'graphite' | 'split';
export type HeroMetricPanelTone = 'graphite' | 'neutral';
export type HeroAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: PressableProps['onPress'];
  tone?: 'graphite' | 'lime';
};
```

Export:
- `HeroCard({ children, footer, header, style, variant = 'panel' })`
- `HeroHeader({ eyebrow, title, body, meta })`
- `HeroMetricPanel({ label, value, helper, tone = 'graphite' })`
- `HeroActions({ primary, secondary })`

`HeroActions` renders `PrimaryButton` for primary and `SecondaryButton` for secondary, with explicit primary `tone` support.

- [ ] **Step 2: Export Hero from public surface**

Update barrels so this import works:

```ts
import { HeroActions, HeroCard, HeroHeader, HeroMetricPanel } from '../design';
```

- [ ] **Step 3: Run focused Hero tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/app-info/shared-design-primitives.test.mts
```

Expected: PASS.

---

### Task 4: Apply Hero/actions to representative surfaces

**Files:**
- Modify: `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`
- Modify: `apps/mobile/lib/trip-ui/TodaySpendCard.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/expenses.tsx`
- Modify: `apps/mobile/lib/trip-ui/TripMapScreenParts.tsx`
- Test: `apps/mobile/lib/app-info/chit-ui-foundation.test.mts`

**Interfaces:**
- Consumes: `HeroCard`, `HeroHeader`, `HeroMetricPanel`, `HeroActions`, `FilterChip`, `InlineAction`, `TextLink`, `PrimaryButton tone="lime"`.
- Produces: Representative adoption with preserved route/data behavior.

- [ ] **Step 1: Refactor `NextPlaceHeroCard`**

Replace local action `Pressable` controls with `HeroActions`, `InlineAction`, and shared `SegmentedControl`. Keep `place`, `travelMode`, `onNavigate`, `onArrive`, `onSkip`, `onLodging` props unchanged. Use `HeroCard variant="graphite"` and make the core arrival action `tone="lime"` only when it is the primary current action.

- [ ] **Step 2: Refactor `TodaySpendCard`**

Use `HeroCard variant="panel"`, `HeroHeader`, `HeroMetricPanel`, and `HeroActions`. Keep `TodaySpendCardProps` unchanged. Render add action as `tone="lime"`.

- [ ] **Step 3: Refactor Expense tab local chips/links**

Import `FilterChip`, `InlineAction`, and `TextLink` from `../../../../lib/design`. Delete local `function FilterChip`. Use shared `FilterChip` for day/category chips. Replace `linkButton` Pressables with `TextLink` or `InlineAction` while preserving labels and callbacks.

- [ ] **Step 4: Refactor Map schedule tray action cluster**

Use shared `FilterChip` for selected result chips with `accessibilityLabel="<placeName> 제거"` and `PrimaryButton tone="lime"` for submit. Keep map overlay tree and GooglePlaceMapSearch ownership unchanged.

- [ ] **Step 5: Run representative source tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/app-info/chit-ui-foundation.test.mts
```

Expected: PASS.

---

### Task 5: Full verification and documentation sync

**Files:**
- Modify: `.harness/runs/F395-primitive-components-redesign/artifacts/evaluation-report.md`
- Modify: `.harness/runs/F395-primitive-components-redesign/artifacts/verification.md` if using a lightweight verification summary too.

**Interfaces:**
- Consumes: all changed code and tests.
- Produces: verification evidence and final implementation state.

- [ ] **Step 1: Run mobile focused checks**

Run:

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/mobile format:check
```

Expected: all PASS.

- [ ] **Step 2: Run repo/harness checks**

Run:

```bash
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
pnpm lint
pnpm harness:validate
```

Expected: all PASS.

- [ ] **Step 3: Record manual smoke status**

If no simulator/device is available, record:

```md
- Android smoke: not run in this environment.
- iOS smoke: not run in this environment.
- Risk: visual regressions in changed screens require manual confirmation before release.
```

- [ ] **Step 4: Commit implementation**

Run:

```bash
git status --short
git add apps/mobile/lib/design apps/mobile/lib/app-info apps/mobile/lib/trip-ui apps/mobile/app/trips/[tripId]/\(tabs\)/expenses.tsx docs/features/0395-shared-interactive-primitives-application.md docs/superpowers/plans/2026-07-20-shared-interactive-primitives-redesign.md
git commit -m "feat: refactor shared interactive primitives"
```

Expected: commit succeeds with spec, plan, tests, and implementation on branch `feature/F-395-primitive-components-redesign`.

---

## Plan Self-Review

- Spec coverage: Tasks cover foundation layering, component rebuild, Hero exports, Lime CTA tone, representative Today/Expense/Map adoption, and verification.
- Red-flag scan: No unresolved marker text is used as implementation instructions.
- Type consistency: Hero names and button tone names match the spec and are repeated consistently.
- Known risk: Task 4 map tray adoption may need adjustment if shared `FilterChip` is not visually/semantically suitable for removable selected-result chips; if so, use `InlineAction` and keep the source test aligned with the final shared primitive used.
