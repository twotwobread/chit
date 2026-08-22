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
- Short, confident, and kind for normal/product states.
- Brand sentence: `기록은 정확하게, 기억은 다정하게.`
- Keep money/settlement copy exact and explainable; do not sacrifice clarity for cuteness.
- Keep error/recovery copy clear and kind; do not make failure states sarcastic.
- Show the next action before long state descriptions.
- Do not use emoji or decorative unicode in product UI.
- Money uses comma separators and Korean suffix by default: `18,500원`, `3,200엔`.

## Visual rules

- Use Chit `Ledger × Memory` as the default app UI language: Receipt Cream app atmosphere, Paper White ledger surfaces, Ledger Ink text, Chit Coral brand/action signals, and explicit semantic state colors.
- Chit Coral is for logo, selection, brand moments, and core actions. Do not use Coral to mean financial success, unpaid, error, or completion.
- Action Coral is the default primary CTA fill. Use Paper White text on Action Coral for primary hierarchy.
- Paper White is the default surface for expense, settlement, forms, calculation, and other ledger-like areas.
- Receipt Cream is the default background/atmosphere for home, meeting, event memory, and warm group surfaces.
- Ledger Ink is the default title, amount, and high-emphasis text color.
- Clear Green means settlement/payment completion or positive receive state. Alert Red means error, unpaid, destructive, or risky actions. Info Blue means link, external, exchange-rate, or informational guidance.
- Receipt/ticket/stamp motifs are limited to completion, share/export, reports, invites, and memory cards. Do not use them for app icon defaults, dense lists, routine forms, or bottom tabs.
- App icon and logo direction is clean `chit.` wordmark/symbol, not a heavy stamp mark.
- Use theme tokens for color, spacing, radius, typography, and shadow.
- Do not add raw hex colors in screen code.
- External brand colors also need tokens before use.
- Use comfortable compact density: hero titles, total spend, settlement results, and next actions are large; repeated rows/chips/settings/forms are compact, aligned, and still 44pt+ touch-safe.
- Avoid visual issues: overusing Coral, making every card look like a receipt, emoji structural icons, weak number hierarchy, clipped day chips/carousels, appbar misalignment, unsafe sheet/safe-area spacing, and placeholder-quality place cards.
- Place/map result cards should use real imagery when available, or polished tokenized thumbnails/category icons when not; avoid text-only placeholder blocks.
- Credit/받을 돈 uses credit color and `+`; debit/보낼 돈 uses debit color and `−`.
- Reuse shared Button/Card/ListRow/Badge/Chip/ScreenBackground/BrandStamp patterns before duplicating styles.
- New shared interactive primitives should use `InteractiveSurface` with accessibility role/state, disabled/busy/selected semantics, pressed feedback, `theme.layout.tapMin` touch target, and `hitSlop` for small icon-only controls.

## IA rules

- Root navigation keeps the current 2-depth philosophy: root `홈/마이`; meeting is a normal detail page; event shell tabs appear only inside trip/date/outing events.
- A meeting detail page should not introduce its own bottom nav just because it is a meeting.
- Event shell tabs are for active work surfaces such as today, itinerary, map/place, ledger, and settlement.

## Common patterns

- Meeting list: separate logged-out/loading/empty/error/populated states; row tap opens meeting detail.
- Meeting detail: show group identity, next events, settlement summary, past records, and members without switching bottom nav.
- Event detail/shell: show event name/date/participants first, then event-specific work tabs.
- Day itinerary: rows show order, name, address/type, lodging status, and explicit actions.
- Today execution: prioritize next place and immediate actions.
- Participants/invite: rows focus on display name and role; invite actions are explicit.
- Forms/sheets: ask only for needed fields; validation copy says how to fix input.
- Expense/settlement: every row should make payer, total amount, split/participant context, and calculation evidence discoverable.

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
