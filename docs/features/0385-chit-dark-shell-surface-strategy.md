# Feature Slice: Chit Pure Dark Graphite surface strategy

## Metadata

- GitHub Issue: #385, related #389
- Status: Superseded/revised by 2026-07-21 Pure Dark Graphite direction
- Created: 2026-07-19
- Revised: 2026-07-21
- Source: user-approved Pure Dark Graphite mockup review after `여비_어플_비교.MP4` comparison
- Scope type: broad mobile UI/design-system refactor

## Supersession note

This document originally approved **Dark Shell + Off-white Content**. That direction is no longer the current Chit app UI strategy.

The canonical current strategy is:

```text
Pure Dark Graphite default
  + compact premium dark density
  + sparse Acid Lime signals
  + limited Off-white Escape only when explicitly justified
```

Use `docs/features/0341-chit-brand-design-system.md` as the source of truth. This document remains as the surface-strategy feature slice and now records the revised direction.

## Goal

Refactor Chit mobile UI from a mixed dark-shell/off-white-card app into a cleaner **Pure Dark Graphite** product UI.

The app should feel like a cute + hip fintech travel settlement app: dark and eye-comfortable, precise like a finance app, but still memorable through the `칫` stamp, short Korean copy, and rare Acid Lime brand signals.

## Decision

Use **Pure Dark Graphite** as the default app-wide surface strategy.

- App shell/background: near-black charcoal / graphite.
- App bars, tab bars, cards, lists, forms, and sheets: dark graphite layer steps.
- Primary product CTA: Graphite Highest + off-white text.
- Acid Lime: small selected/brand/success signal, not repeated primary fill.
- BrandStamp: approved brand/header/empty/loading/completion/settlement moments only.
- Off-white: no longer the default dense content surface; use only as an explicit `Off-white Escape` for long-readability/legal/export-like contexts.
- Warm Paper (`#F5F1E8`): retired from core UI surfaces.
- Background treatment: matte graphite by default; avoid per-screen decorative glow/radial effects.

## Why

Video review showed that the reference app felt cleaner because it used clearer hierarchy, less repeated accent color, and calmer surface contrast.

The current Chit implementation felt cluttered for these reasons:

| Problem | Replacement rule |
|---|---|
| Large off-white cards floated on a dark shell and made screens look split into heavy blocks. | Default cards/sheets/forms become dark graphite surfaces. |
| Acid Lime appeared on tabs, FAB, buttons, chips, search actions, badges, and brand marks. | Use Lime only as a small selected/brand/success signal. |
| Large rounded pills repeated everywhere and made the app feel toy-like. | Reduce radius intensity; active state uses underline/dot/edge rather than full Lime pills. |
| Headings, buttons, chips, and labels all had similar weight/emphasis. | Use large hierarchy only for hero/numbers/core actions; keep repeated rows compact and precise. |
| Day chips, carousel peeking, appbar layout, and sheets had small alignment/overflow drift. | Fix grid/gutter/safe-area/width rhythm before adding visual decoration. |
| Map/place cards used placeholder-quality blocks. | Use real imagery where available or polished dark thumbnails/category icons. |

## Surface model

```text
Shell              #0F1114 / #101215  root background
Raised shell       #1A1E23            app bars, tab bars, sheet frame
Card               #20252B            default card/list/form surface
Card elevated      #262C33            selected/elevated card surface
Card highest       #303740            primary CTA/strong action surface
Input/sunken       #171B20            fields/internal panels
Line               rgba(255,255,255,0.08-0.15)
Primary text       #F7F7F2
Secondary text     #C5C9C1
Tertiary text      #8E958B
Acid Lime          #C8FF00            rare signal
Acid Lime Surface  #273218            selected/brand soft dark surface
```

Exact token values may be tuned during implementation, but the layer model must remain intact.

## Density model: Compact Premium Dark

Chit should not become uniformly tiny or uniformly huge.

### Large/high-emphasis

- Login/splash brand moment.
- Home current-trip hero.
- Today next action.
- Total spend and settlement result amounts.
- Trip creation step title.
- Empty/completion state title.
- One core CTA in a decision moment.

### Compact/precise

- Place rows.
- Expense rows.
- Participant rows.
- Flight rows.
- Notification rows.
- Settings rows.
- Day/category/filter chips.
- Metadata and helper copy.

### Non-negotiable

- Touch targets remain at least 44pt.
- Compactness comes from type hierarchy, spacing rhythm, and row alignment, not inaccessible controls.

## Component rules

### Cards and sheets

- Default card/sheet/form/list surfaces are dark graphite.
- Borders and subtle layer contrast are preferred over heavy shadows.
- Avoid nested rounded boxes unless they separate meaningful information.
- Off-white cards are exceptional escape surfaces, not routine content.

### Buttons

- Normal primary action: Graphite Highest fill + off-white text.
- Secondary action: dark neutral surface + border.
- Lime CTA: rare, one-per-hero only if the screen spec explicitly calls for it.
- Floating action button: dark floating surface + Lime plus/icon/signal, not a large Lime disk.
- Destructive action: Punch Red, never Lime.

### Tabs and chips

- Bottom tab/trip tab active state: dark selected surface + small Lime underline/dot/edge.
- Avoid large repeated Acid Lime capsules.
- Day chips must avoid awkward clipped right edges and maintain readable dates.

### Lists and data

- Amounts align consistently and use tabular numerals.
- Credit/받을 돈 uses info/credit blue with `+`; debit/보낼 돈 uses danger/debit red with `−`.
- Rows must include text/icon context and not rely on color alone.
- Metadata stays short and muted.

### Map/search

- Use dark map style where provider support allows.
- Search bar and bottom sheet use dark graphite surfaces.
- Result rows should use real images when available.
- If no image exists, use polished dark thumbnail/category treatment rather than text-only placeholder blocks.

## Scope

### In

- Update `docs/features/0341-chit-brand-design-system.md` and `.harness/rules/code/mobile-ui.md` so source-of-truth rules match Pure Dark Graphite.
- Update shared design tokens in `apps/mobile/lib/design/theme.ts` in a future implementation slice.
- Update shared primitives/patterns to support dark cards, dark inputs, dark sheets, compact rows, dark selected tabs, and limited Lime signals.
- Apply the new surface strategy to core mobile surfaces:
  - login;
  - home/mypage/notifications;
  - root bottom menu;
  - trip app bar and tabs;
  - Today;
  - map/search overlays;
  - itinerary/day editor;
  - expenses and expense forms;
  - settlement;
  - participants/invite;
  - flights;
  - new/edit trip wizard.
- Preserve existing behavior and routing.

### Out

- API/DB changes.
- Payment or transfer execution features.
- New user-facing theme toggle.
- Legal-site/public-site redesign.
- Full visual regression infrastructure.
- Deep navigation state preservation changes unrelated to surface styling.

## Acceptance Criteria

- [ ] Core app screens use Pure Graphite Shell as the default background.
- [ ] App bars, tab bars, cards, lists, forms, and sheets use dark graphite layer steps by default.
- [ ] Off-white is not used as the default content card/sheet/form surface.
- [ ] Any Off-white Escape surface has an explicit readability/accessibility reason.
- [ ] Warm Paper (`#F5F1E8`) is not used for core backgrounds/cards.
- [ ] Primary CTA uses Graphite Highest + off-white text.
- [ ] Acid Lime is limited to BrandStamp, app icon/splash/onboarding, selected/success signals, and rare hero moments.
- [ ] Bottom tabs and trip tabs avoid large repeated Acid Lime selected capsules.
- [ ] Dense rows follow Compact Premium Dark: compact, aligned, scannable, and 44pt+ touch-safe.
- [ ] Map/search place cards use real imagery or polished dark thumbnails instead of placeholder-quality text blocks.
- [ ] Existing behavior, navigation, API calls, and business logic are unchanged.
- [ ] Mobile tests, typecheck, lint, format, and context-bound UI checks pass or accepted risk is explicit.
- [ ] Android and iOS smoke status is reported for runtime UI implementation.

## Implementation Source Mapping

| Area | Source / target |
|---|---|
| Canonical spec | `.harness/runs/20260721-pure-dark-graphite-ui/artifacts/feature.spec.md` |
| Feature doc | `docs/features/0385-chit-dark-shell-surface-strategy.md` |
| Existing brand doc | `docs/features/0341-chit-brand-design-system.md` |
| Mobile UI rule | `.harness/rules/code/mobile-ui.md` |
| Tokens | `apps/mobile/lib/design/theme.ts` |
| Brand stamp primitive | `apps/mobile/lib/design/components/card.tsx` |
| Shared primitives | `apps/mobile/lib/design/components/*`, `apps/mobile/lib/design/foundation/*`, `apps/mobile/lib/design/patterns/*` |
| Navigation shell | `apps/mobile/lib/navigation/*`, `apps/mobile/lib/trip-ui/AppBar.tsx`, `apps/mobile/lib/trip-ui/TripScreenScaffold.tsx`, `apps/mobile/lib/trip-ui/TripTabBar.tsx` |

## Open Questions

- Exact token values and component radii should be tuned during implementation with screenshots/device smoke.
- If implementation diff grows too large, split into staged PRs while preserving a coherent first shipped state.
