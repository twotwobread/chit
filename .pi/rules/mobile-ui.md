
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

- Tokens: `apps/mobile/lib/design/theme.ts`
- Shared primitives: `apps/mobile/lib/design/components.tsx`
- Assets/fonts: `apps/mobile/assets/`

## Voice

- Korean first.
- Friendly polite tone.
- Short and action-oriented.
- Show the next action before long state descriptions.
- Do not use emoji or decorative unicode in product UI.
- Money uses comma separators and Korean suffix by default: `18,500원`, `3,200엔`.

## Visual rules

- Use warm, calm, high-readability mobile surfaces.
- Use theme tokens for color, spacing, radius, typography, and shadow.
- Do not add raw hex colors in screen code.
- External brand colors also need tokens before use.
- Credit/받을 돈 uses credit color and `+`; debit/보낼 돈 uses debit color and `−`.
- Reuse shared Button/Card/ListRow/Badge/Chip patterns before duplicating styles.

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

## Verification

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```
