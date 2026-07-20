
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/code/mobile-ui.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Mobile UI Rule

Use when changing Expo screens, mobile UI state, styling, copy, or navigation.

## Sources

- Brand/design: `docs/features/0341-chit-brand-design-system.md`
- Shared design-system guard/guidance: `docs/features/0403-shared-design-system-guard-guidance.md`
- Tokens: `apps/mobile/lib/design/theme.ts`
- Shared primitives: `apps/mobile/lib/design/components.tsx` and `apps/mobile/lib/design/index.ts`
- Assets/fonts: `apps/mobile/assets/`

## Voice

- Korean first.
- Short, confident, and slightly 시크 for normal/product states.
- Keep error/recovery copy clear and kind; do not make failure states sarcastic.
- Show the next action before long state descriptions.
- Do not use emoji or decorative unicode in product UI.
- Money uses comma separators and Korean suffix by default: `18,500원`, `3,200엔`.

## Visual rules

- Use Chit `Dark Shell + Off-white Content` as the default app UI language: Matte Charcoal shell, clean Off-white content surfaces, Charcoal text on light surfaces, Acid Lime primary accents.
- Do not use retired Warm Paper `#F5F1E8` for core app backgrounds/cards.
- Keep shell glow centralized through design tokens/shared components (`theme.color.shellGlow`, `ScreenBackground`); do not add ad-hoc rgba/radial values per screen.
- Reserve `Dark Acid` hero treatment for app icon, splash, login/home brand moments, settlement summary/complete hero moments, and other high-emphasis surfaces.
- Use `Stamp Pop`/`BrandStamp` only for approved brand/header, onboarding, empty/loading/completion, mypage accent, or settlement moments; avoid repeated dense rows, bottom tabs, and routine forms.
- Use theme tokens for color, spacing, radius, typography, and shadow.
- Do not add raw hex colors in screen code.
- External brand colors also need tokens before use.
- Graphite is the default primary CTA / 기본 주요 액션 fill for normal product UI; use Off-white text on Graphite for primary hierarchy.
- Acid Lime is sparse and explicit: use it for one high-emphasis CTA in a Hero/action moment, large/key amounts, selected state, BrandStamp accent/glow, and success/complete emphasis; do not use it for long body text, small text on light/off-white surfaces, dense repeated routine actions, or danger/error states.
- Credit/받을 돈 uses credit color and `+`; debit/보낼 돈 uses debit color and `−`.
- Reuse shared Button/Card/ListRow/Badge/Chip/ScreenBackground/BrandStamp patterns before duplicating styles.
- New shared interactive primitives should use `InteractiveSurface` with accessibility role/state, disabled/busy/selected semantics, pressed feedback, `theme.layout.tapMin` touch target, and `hitSlop` for small icon-only controls.

## Common patterns

- Trip list: separate logged-out/loading/empty/error/populated states; row tap opens detail.
- Trip detail: show name/date first; Day rows show `Day N`, date, lodging summary, and clear navigation.
- Day itinerary: rows show order, name, address/type, lodging status, and explicit actions.
- Today execution: prioritize next place and immediate actions.
- Participants/invite: rows focus on display name and role; invite actions are explicit.
- Forms/sheets: ask only for needed fields; validation copy says how to fix input.

## State and logic

- Screen files orchestrate route params, API calls, navigation, and composition.
- Move formatting, sorting, grouping, URL building, and API-response-to-view-state logic to `apps/mobile/lib/**` helpers.
- Use generated API types/client when available.

## Native/context-bound UI primitives

- Treat bottom sheets, modals, portals, gesture-handler/reanimated wrappers, map overlays, keyboard-aware inputs, and safe-area/inset helpers as potentially provider- or context-bound.
- When moving UI between a provider-owned tree and an external overlay/sibling tree, re-check whether reused primitives depend on provider context; type compatibility is not enough.
- Use plain React Native primitives for external overlays unless the wrapper is documented as safe outside its provider.
- If a context-bound native UI primitive must be used, keep it inside its provider tree and add/keep a source guard or render/smoke check for that boundary.

## Platform parity

- Treat Android and iOS as simultaneous development targets for mobile work. Do not design, implement, or verify a mobile change for only one platform unless the task is explicitly platform-specific.
- Keep route, UI, and helper behavior platform-neutral by default; when platform branching is necessary, document both Android and iOS behavior and verification status.
- Completion reports for mobile work must record Android and iOS smoke/verification status, or an explicit gap when device/simulator checks were not run.

## Verification

```bash
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```
