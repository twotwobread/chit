# 0388 Dynamic Type and long text patterns

## Metadata

- GitHub Issue: #388
- Status: Approved implementation source of truth
- Created: 2026-07-20
- Scope type: Mobile accessibility and responsive text foundation

## Pattern rules

- Body text floor: `theme.font.size.body` is 16pt so default readable text aligns with mobile accessibility expectations.
- Micro text is reserved for decorative badges, captions, and low-priority metadata. It must not be the only visual representation of a critical value such as amount, name, status, selected value, or primary action copy.
- Critical values prefer wrapping before truncation. Trip names, participant names, next-place labels, and dense summary metadata should allow at least two lines where space is constrained.
- When a critical value is visually constrained, the full semantic value must remain available through `accessibilityLabel`.
- Fixed `lineHeight` values should be token-derived or intentionally scoped to decorative/low-risk surfaces.

## Applied surfaces

- Home trip cards now allow critical trip names, next-place text, and upcoming trip metadata to wrap to two lines with full accessibility labels.
- Settlement transfer names now allow two-line wrapping and use token-derived line height.
- Account profile names now allow two-line wrapping with full accessibility labels.

## Verification

Automated checks:

- `pnpm --filter @i-um/mobile exec node --import tsx --test lib/app-info/dynamic-text-policy.test.mts`
- `pnpm --filter @i-um/mobile typecheck`
- `pnpm --filter @i-um/mobile format:check`

Manual smoke still required:

- Small phone around 375px width with long Korean/English trip and participant names.
- Android increased font size for Home, Account, Settlement transfer rows.
- iOS Dynamic Type near maximum for Home, Account, Settlement transfer rows.

## Remaining gaps

This slice establishes the token and critical-value wrapping policy for representative high-risk surfaces. Broader layout-by-layout tablet/landscape auditing can continue under future UI polish or QA smoke work if manual review finds issues.
