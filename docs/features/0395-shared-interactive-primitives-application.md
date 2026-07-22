# Feature 0395: 공유 interactive primitive 구조 개편 및 화면 적용

## Metadata

- GitHub Issue: #395
- Parent: #389
- Related epic: #383
- Status: Draft
- Scope type: Mobile UI foundation refactor + representative adoption
- Approved direction: C안 — design-system 내부 계층 개편, Graphite Hero + single Lime CTA pattern 추가, 대표 화면 적용

## Summary

공유 mobile design layer를 기존 `components.tsx` 중심의 개별 구현 묶음에서 foundation/component/pattern 계층으로 재정리한다. 기존 public import surface는 유지하면서, 반복되는 `Pressable`, accessibility state, hitSlop, pressed/disabled state, responsive label, surface/card/action group 패턴을 shared foundation primitive로 모은다.

새 Hero pattern은 Chit brand/design source의 `Pure Dark Graphite`, Graphite primary hierarchy, sparse Acid Lime 규칙을 따른다. Hero의 구조와 요약은 dark graphite layers로 잡고, `지출 추가`처럼 화면의 최상위 핵심 실행 CTA 하나만 명시적으로 허용된 경우에만 Acid Lime으로 강조한다.

## Goals

- 공용 컴포넌트 내부 반복 패턴을 primitive/base layer로 정리한다.
- 기존 `../design` public exports와 주요 props 호환성을 유지한다.
- Pure Dark Graphite 중심 Hero pattern과 명시적으로 허용된 rare Lime CTA 사용 규칙을 추가한다.
- 대표 화면에 새 구조를 적용해 실제 화면 품질과 API 사용성을 검증한다.
- 기존 화면의 정보 구조, copy 의미, route/navigation behavior는 유지한다.

## Non-goals

- 앱 전체 화면 redesign.
- 모든 local `Pressable`의 일괄 제거.
- 신규 visual language 도입.
- API contract, DB, auth/permission, navigation route 변경.
- 모든 itinerary dense row 또는 map/search overlay를 한 PR에서 대수술.
- BrandStamp를 dense row나 routine form에 반복 노출.

## Design direction

### Visual decision

- Hero default direction: **Pure Dark Graphite Hero + rare Lime signal**.
- Default reusable variant: dark graphite hero body + darker/lighter graphite metric panel + Graphite primary CTA.
- Supported variants:
  - `panel`: Graphite Card with Graphite Elevated metric/summary panel. Default for expense/settlement/spend summary.
  - `graphite`: Full Graphite hero surface. Use for high-emphasis Today/Home execution moments.
  - `split`: Graphite header + Graphite Card body. Use for map/itinerary/action-heavy contexts.
- Acid Lime is allowed for BrandStamp, selected dot/underline/edge, rare success emphasis, or one explicitly approved primary CTA in a Hero/action moment. It must not become repeated small foreground text or repeated routine fill.

### Layering decision

```text
theme tokens
  ↓
foundation primitives
  ↓
components
  ↓
patterns
  ↓
trip-ui / screens
```

Target design structure:

```text
apps/mobile/lib/design/
├── theme.ts
├── responsive-text.ts
├── foundation/
│   ├── accessibility.ts
│   ├── interactive-surface.tsx
│   ├── responsive-label.tsx
│   ├── surface-frame.tsx
│   └── action-group.tsx
├── components/
│   ├── button.tsx
│   ├── icon-button.tsx
│   ├── link.tsx
│   ├── chip.tsx
│   ├── row.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── amount-text.tsx
│   └── segmented-control.tsx
├── patterns/
│   ├── hero.tsx
│   ├── form-field.tsx
│   └── state-card.tsx
├── components.tsx      # compatibility barrel / public legacy surface
├── primitives.tsx      # compatibility barrel / public legacy surface
└── index.ts            # public export surface
```

The exact file split may be adjusted during implementation if TypeScript or Expo module boundaries make a smaller split safer, but the conceptual layering must remain.

## Scope

### In

- Add foundation primitives for shared interaction/accessibility patterns:
  - `buildAccessibilityState` / accessibility helper.
  - `InteractiveSurface` for `Pressable` role/state/disabled/busy/selected/pressed/hitSlop/min target behavior.
  - `ResponsiveLabel` for tokenized text + dynamic line-height behavior.
  - `SurfaceFrame` for tokenized card/surface variants.
  - `ActionGroup` or equivalent layout helper for consistent button/action spacing.
- Rebuild shared components on top of foundation where practical:
  - `Card`, `PrimaryButton`, `SecondaryButton`, `IconButton`.
  - `TextLink`, `InlineAction`, `ActionRow`.
  - `FilterChip`, `ChoiceChip`, existing `Chip` compatibility.
  - `FormField`, `EmptyState`, `ErrorState`, `LoadingState`.
- Add button tone support:
  - default primary action remains Graphite.
  - `tone="lime"` is available only for explicitly approved high-emphasis primary CTAs.
  - `PrimaryButton` remains backward-compatible and defaults to Graphite.
- Add Hero pattern exports:
  - `HeroCard`.
  - `HeroHeader`.
  - `HeroMetricPanel`.
  - `HeroActions`.
  - Public types for Hero variants/action props.
- Apply the new shared structure to representative surfaces:
  - `NextPlaceHeroCard`: adopt Hero pattern and replace local action `Pressable` controls with shared actions where behavior fits.
  - `TodaySpendCard`: adopt Hero/metric/action primitives and keep the add action Graphite by default unless the current screen spec explicitly approves a Lime hero CTA.
  - Expense tab: replace local filter chip and link-button patterns with shared `FilterChip`, `TextLink` or `InlineAction` while preserving current mode/filter behavior.
  - Map schedule add tray: replace selected-result chip/remove and primary schedule add affordances with shared chip/action primitives where this does not break overlay/context-bound behavior.
- Update or add tests/source guards for public exports, token-only styling, foundation usage, Hero token policy, accessibility/touch behavior, and representative adoption.

### Out

- Removing every local `Pressable` in `apps/mobile/app` or `apps/mobile/lib/trip-ui`.
- Rewriting GooglePlaceMapSearch internals unless a very small shared primitive replacement is necessary for the selected tray adoption.
- Changing trip tab structure, FAB behavior, route paths, API calls, loading semantics, or business copy meaning.
- Introducing raw colors, decorative emoji, non-token motion, or new icon families.

## Public API requirements

- Existing imports from `apps/mobile/lib/design/index.ts` must keep compiling.
- Existing components stay exported:
  - `Card`, `BrandStamp`, `ScreenBackground`.
  - `PrimaryButton`, `SecondaryButton`, `IconButton`.
  - `TextLink`, `InlineAction`, `ActionRow`.
  - `FormField`, `EmptyState`, `ErrorState`, `LoadingState`.
  - `FilterChip`, `ChoiceChip`.
  - Existing primitive exports such as `Badge`, `Pill`, `Chip`, `AmountText`, `PlacePin`, `PlaceTag`, `Avatar`, `AvatarGroup`, `ListRow`, `SegmentedControl`.
- New Hero exports must be available from `../design`.
- `PrimaryButton` and `HeroActions` may support an explicit Lime primary CTA tone; existing call sites without tone must remain Graphite.
- Icon-only controls must continue to require explicit `accessibilityLabel` and support `accessibilityHint`/hitSlop.

## Accessibility and UX requirements

- Interactive controls keep `accessibilityRole` and `accessibilityState` defaults.
- Disabled and loading controls expose disabled/busy states and block duplicate submit actions.
- Touch targets remain at least `theme.layout.tapMin` (44pt floor).
- Adjacent action controls keep at least tokenized 8pt-ish spacing through shared layout.
- Pressed/disabled visual states must not cause layout shift.
- Hero CTA defaults to Graphite; any Lime CTA must be explicit, rare, and covered by the current screen spec.
- Lime must not be used as repeated small text or repeated routine fill.
- Representative screen adoption must preserve existing Korean copy meaning and route behavior.
- Context-bound mobile UI rule applies to map/search overlays: if a shared wrapper is unsafe outside a provider tree, keep a local plain RN fallback and document the gap.

## Acceptance criteria

- [ ] `apps/mobile/lib/design` has a clear foundation/component/pattern layering, with compatibility barrels preserving existing public exports.
- [ ] Shared interactive components are rebuilt on top of foundation primitives where practical instead of duplicating `Pressable` role/state/pressed/disabled/touch logic in each component.
- [ ] `PrimaryButton` remains backward-compatible and supports an explicit Lime high-emphasis CTA tone without changing default Graphite behavior.
- [ ] New Hero pattern exports exist and implement Pure Dark Graphite-centered variants with a rare Lime signal/CTA option.
- [ ] `NextPlaceHeroCard` and `TodaySpendCard` use the Hero/action primitives while preserving existing behavior and copy meaning.
- [ ] Expense tab no longer owns a duplicate local FilterChip implementation for day/category browser chips.
- [ ] At least one map or itinerary action cluster adopts shared chip/action primitives, or the spec records a concrete context-bound reason for retaining a local plain RN implementation.
- [ ] All changed shared UI uses theme tokens only; no raw hex colors or decorative emoji are introduced.
- [ ] Interactive primitives keep default accessibility role/state and 44pt touch target behavior.
- [ ] Existing visual hierarchy remains Chit-compliant: Pure Dark Graphite, Graphite primary hierarchy, sparse Acid Lime, Compact Premium Dark density.

## Implementation notes

- Prefer moving common code before changing screens: foundation first, then public components, then Hero pattern, then representative adoption.
- Keep `components.tsx` and `primitives.tsx` as compatibility entry points if that reduces import churn.
- Avoid circular imports between `foundation`, `components`, and `patterns`; lower layers must not import higher layers.
- If TypeScript file splitting causes excessive churn, keep a temporary barrel but maintain the conceptual layer boundaries.
- Do not move context-bound map/bottom-sheet/modal primitives outside their provider-owned tree unless verified safe.
- If `HeroActions` cannot safely enforce one Lime CTA at runtime, document the rule in prop design and cover intended usage with source checks/tests.

## API changes

None.

## DB changes

None.

## Mobile changes

- Shared mobile design files under `apps/mobile/lib/design/**`.
- Representative mobile UI files likely include:
  - `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`.
  - `apps/mobile/lib/trip-ui/TodaySpendCard.tsx`.
  - `apps/mobile/app/trips/[tripId]/(tabs)/expenses.tsx`.
  - `apps/mobile/lib/trip-ui/TripMapScreenParts.tsx` or a similarly scoped itinerary/map action cluster.
- Tests/source guards under `apps/mobile/lib/app-info/*.test.mts` and/or focused design tests.

## Test plan

- Add or update mobile source tests to cover:
  - public design exports remain available;
  - Hero exports exist and use Pure Dark Graphite/Lime semantic tokens;
  - shared interactive components use foundation primitives;
  - default primary button remains Graphite and Lime tone is explicit/rare;
  - representative surfaces import/use Hero/FilterChip/Action primitives.
- Run:
  - `pnpm --filter @i-um/mobile test`
  - `pnpm --filter @i-um/mobile typecheck`
  - `pnpm --filter @i-um/mobile format:check`
  - `pnpm lint`
  - `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .`
  - `pnpm harness:validate`
- Manual smoke target:
  - iOS and Android smoke for Today, Expense tab day/category filtering, and changed map/itinerary action cluster.

## Open questions

None for implementation. If implementation reveals that map overlay adoption is unsafe because of provider/context boundaries, keep that sub-surface local, document the reason in the evaluation report, and prefer an itinerary action cluster for the representative adoption criterion.

## Provider

- name: micro-spec-author
- evidence:
  - User request for issue #395 implementation.
  - GitHub issue #395, parent #389, epic #383.
  - User-approved visual brainstorming direction: Graphite Hero + one Lime core CTA.
  - Existing source facts from `apps/mobile/lib/design/components.tsx`, `apps/mobile/lib/design/primitives.tsx`, `shared-design-primitives.test.mts`, and Chit brand source `docs/features/0341-chit-brand-design-system.md`.
