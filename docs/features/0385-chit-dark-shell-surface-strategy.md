# Feature Slice: Chit Dark Shell + Off-white Content surface strategy

## Metadata

- GitHub Issue: #385, related #389
- Status: Approved for implementation planning
- Created: 2026-07-19
- Source: user-approved B option from HTML background comparison mockup
- Scope type: broad mobile UI/design-system refactor

## Goal

Refactor Chit mobile UI from a Paper-first background to the approved **Dark Shell + Off-white Content** visual strategy.

The app should feel like a hip fintech settlement product: Matte Charcoal creates the brand atmosphere, Acid Lime becomes the obvious brand/CTA anchor, and clean off-white/white surfaces remain as readable content cards for dense travel, expense, settlement, and form information.

## Decision

Use **B안: Dark Shell + Off-white Content**.

- App shell/background: Matte Charcoal / Charcoal.
- Hero/brand/settlement moments: Charcoal Elevated / Charcoal + Acid Lime.
- Dense content surfaces: clean off-white or white cards/shelves.
- Forms/lists: clean off-white/white for readability, inside the dark shell.
- Navigation: dark shell aligned, selected state uses Acid Lime or high-contrast capsule.
- Warm Paper (`#F5F1E8`) is retired from core UI surfaces because it weakens the sharper Chit fintech mood.

## Why

The previous Paper-first approach made black hero/cards feel like isolated objects on top of a warm beige background. Acid Lime also failed as small text on light surfaces and did not consistently read as the main brand color.

Dark Shell + Off-white Content makes the brand color visible, reduces visual fragmentation, and keeps long information readable without the beige/warm Paper cast.

## Scope

### In

- Update `docs/features/0341-chit-brand-design-system.md` and `.harness/rules/code/mobile-ui.md` so source-of-truth rules match the approved B direction.
- Update `apps/mobile/lib/design/theme.ts` with dark shell, content surface, and high-contrast semantic tokens.
- Upgrade shared primitives in `apps/mobile/lib/design/components.tsx` and `apps/mobile/lib/design/primitives.tsx`.
- Apply the new surface strategy to core mobile surfaces:
  - root shell;
  - login;
  - home/mypage;
  - trip app bar and tabs;
  - Today hero;
  - expense dashboard/list surfaces;
  - settlement summary;
  - new trip wizard;
  - map/search overlays where safe.
- Preserve existing behavior and routing.

### Out

- API/DB changes.
- Payment or transfer execution features.
- New theme toggle.
- Full visual regression infrastructure.
- Deep navigation state preservation changes unrelated to surface styling.

## Design Rules

### Color

- Retire warm Paper (`#F5F1E8`) from app backgrounds and core content cards.
- Use a cleaner off-white family instead: target base `#F7F7F2`, elevated `#FCFCF8`, subtle/sunken `#F0F0EA`, border `#E4E3DA`.
- Acid Lime is a fill/accent on dark shell, not small text on Off-white/White.
- Primary CTA remains Acid Lime with Charcoal text.
- Off-white becomes a clean content surface, not the whole-app default background.
- Use high-contrast semantic text tokens for labels, links, warnings, success, and danger on light surfaces.
- Do not add raw hex colors in screen code.

### Components

- Cards need surface variants:
  - content card: clean off-white/white surface inside dark shell;
  - dark/hero card: Charcoal surface with Acid Lime accents;
  - shelf/group surface: subtle container for stacked content cards.
- Buttons need polished pressed/disabled states without layout shift.
- Tabs and app bars should feel attached to the dark shell.
- Lists and rows remain scannable; amounts use tabular numerals.

### Accessibility

- Normal text contrast must meet WCAG AA where applicable.
- Minimum touch target remains 44pt.
- Do not communicate state by color alone.
- Dynamic Type should not become worse than current behavior.

## Acceptance Criteria

- [ ] Core app screens use Matte Charcoal/Charcoal as the default shell background.
- [ ] Warm Paper (`#F5F1E8`) is not used for core backgrounds/cards; clean off-white/white is used for readable content surfaces.
- [ ] Shared `Card` and button primitives visually match the approved B direction.
- [ ] Login, Home, Today, Expenses, Settlement, New Trip, and Map/Search feel visually coherent under one Chit surface strategy.
- [ ] Bright-surface Acid Lime text usage is removed or replaced with high-contrast semantic tokens.
- [ ] Existing behavior, navigation, API calls, and business logic are unchanged.
- [ ] Mobile tests, typecheck, lint, and context-bound UI check pass or any accepted risk is explicit.
- [ ] Android and iOS smoke status is reported.

## Implementation Source Mapping

| Area | Source / target |
|---|---|
| Canonical spec | `.harness/runs/20260719-chit-dark-shell-surface/artifacts/feature.spec.md` |
| Feature doc | `docs/features/0385-chit-dark-shell-surface-strategy.md` |
| Existing brand doc | `docs/features/0341-chit-brand-design-system.md` |
| Mobile UI rule | `.harness/rules/code/mobile-ui.md` |
| Tokens | `apps/mobile/lib/design/theme.ts` |
| Shared primitives | `apps/mobile/lib/design/components.tsx`, `apps/mobile/lib/design/primitives.tsx` |
| Navigation shell | `apps/mobile/lib/navigation/*`, `apps/mobile/lib/trip-ui/AppBar.tsx`, `apps/mobile/lib/trip-ui/TripScreenScaffold.tsx` |

## Open Questions

None blocking. If implementation diff grows too large, split into staged PRs while preserving a coherent first shipped state.
