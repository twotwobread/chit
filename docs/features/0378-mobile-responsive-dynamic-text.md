# Feature Slice: Mobile responsive layout and dynamic text handling

## Metadata

- GitHub Issue: #378
- Status: Approved implementation source of truth
- Created: 2026-07-19
- Source: `.harness/runs/0378-responsive-text-layout/artifacts/feature.spec.md`
- Scope type: Mobile UI foundation

## Goal

Chit mobile screens should remain legible on small Android devices, narrow viewports, larger font scales, and dense Korean copy.

The goal is not pixel-identical rendering across every phone model. Different devices may choose different layout variants. The required behavior is that the same width, font-scale, and platform constraints choose the same adaptive rule, preserve the same information hierarchy, and never clip or hide critical values solely because the device is small.

## Global fallback order

When a surface runs out of space:

1. Wrap and grow safely first.
2. Switch to compact density with tokenized spacing or compact labels.
3. Stack secondary content below critical values.
4. Truncate only non-critical text, with full Korean meaning preserved through `accessibilityLabel`.
5. Never hide critical values due to viewport width.

Any exception must be documented as a compatibility-only exception with reason, affected surface, platform, and verification evidence.

## Critical text

Critical text includes:

- time and date values;
- money amounts, currency suffixes/signs, and settlement totals;
- settlement transfer direction values and payer/receiver names needed to understand who pays whom;
- decision/status labels such as selected, review needed, settlement complete, validation/error state;
- primary action labels on buttons and sticky footers;
- selected form values such as schedule time/date and travel mode.

Critical text must remain semantically visible as full or approved compact visual copy. It must not clip, overlap adjacent values, hide solely due to width, or be the only content ellipsized in a dense row. Rows and controls containing critical text must grow line height/min height as needed while preserving at least the 44pt touch target.

## Font rule

Chit mobile UI must not depend on a user device having Pretendard or any specific Korean font installed.

- Production UI uses app-bundled Pretendard through `theme.font.family` as the single React Native font-family source.
- Baseline bundled fonts are `apps/mobile/assets/fonts/Pretendard-Regular.otf`, `Pretendard-SemiBold.otf`, and `Pretendard-Bold.otf`, registered by the Expo font config.
- Components must not add arbitrary screen-local `fontFamily` values.
- Components must not rely on exact OEM/system font metrics, Android model quirks, or fixed height tweaks to avoid clipping.
- Layouts must remain safe under Korean-capable platform fallback metrics for font-load failure or tests.
- Font bundling reduces cross-device variance, but clipping prevention is guaranteed by explicit line height, min height, wrapping, stacking, and font-scale-aware layout rules.

## Validation profiles

Use shared constants or equivalent helper output for these scenarios:

| Profile | Width | Font scale | Purpose |
| --- | ---: | ---: | --- |
| `compact` | `<= 320dp` | `1.0` | Small Android-like baseline. |
| `compactLargerText` | `<= 320dp` | `1.3` | Larger-font realistic compact case. |
| `compactStress` | `<= 320dp` | `1.5` | Stress case for critical text. |
| `narrowLargerText` | `<= 360dp` | `1.3` | Common narrow-phone dynamic type case. |
| `regular` | `>= 390dp` | `1.0` | Control/default phone case. |

## Implementation notes

- Put reusable responsive text/layout helpers in `apps/mobile/lib/design/**`.
- Prefer `useWindowDimensions`, measured/container width, or injected profile inputs over hardcoded device model checks.
- Update shared primitives and high-risk schedule/time, itinerary/today, expense, and settlement surfaces to consume shared helpers/patterns.
- Keep Chit Paper Fintech brand rules: theme tokens only, no raw per-screen colors, clear hierarchy, and tabular numerals for monetary/time-like dense values where supported.

## Acceptance criteria

- [ ] Responsive/dynamic text strategy is documented for mobile primitives and high-risk dense rows.
- [ ] Shared helpers or component-level patterns define compact, narrow, regular, and larger-font behavior.
- [ ] Time/date labels no longer clip in representative small Android-like viewport and larger font-scale scenarios.
- [ ] Dense rows use the global fallback order.
- [ ] Critical values are never hidden solely because of viewport width.
- [ ] Abbreviated or truncated visual copy preserves full semantic Korean through `accessibilityLabel`.
- [ ] App UI uses bundled Pretendard via `theme.font.family`; no component relies on OEM Pretendard availability or exact font metrics.
- [ ] No one-off Android device model hacks are introduced without an explicit compatibility note.
- [ ] Focused tests/source checks cover compact width/font-scale behavior for the prior time-clipping surface and at least one shared primitive or dense row pattern.
- [ ] iOS and Android smoke status is recorded, including compact-device/font-scale evidence or an explicit device gap.

## Verification

- [ ] `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .`
- [ ] `pnpm --filter @i-um/mobile test`
- [ ] `pnpm --filter @i-um/mobile typecheck`
- [ ] `pnpm --filter @i-um/mobile lint`
- [ ] `pnpm --filter @i-um/mobile format:check`
- [ ] Manual iOS smoke recorded.
- [ ] Manual Android smoke recorded with compact-device/font-scale evidence.

## Open questions

- Which exact prior affected Android device/emulator profile is available for manual smoke? If unavailable, use the compact Android-like validation profile and record the gap.
- During implementation audit, any surface that cannot follow the global fallback order must be documented as a compatibility exception before merge.
