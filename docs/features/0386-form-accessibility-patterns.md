# 0386 Form accessibility and focus patterns

## Metadata

- GitHub Issue: #386
- Status: Approved implementation source of truth
- Created: 2026-07-20
- Scope type: Mobile form accessibility foundation

## Shared pattern

- Visible labels are required for form inputs. Placeholder-only labeling is not acceptable for primary data entry.
- `TextInputField` combines `FormField`, `TextInput`, helper/error copy, disabled/invalid accessibility state, and the 44pt minimum input height.
- Field errors remain visible near the input and are announced through the `FormField` polite live region.
- `buildFieldAccessibilityHint` prefers recovery-first error hints, then helper text, while preserving required/disabled context.
- `firstInvalidFieldKey` returns the first visible error in field order so screens can scroll/focus the same field users see first.
- Screens that hold field refs should combine `firstInvalidFieldKey` with `focusAccessibilityNode` or `focusAccessibilityHandle` after submit validation fails.
- Amount/date/search fields must keep appropriate `keyboardType`, `returnKeyType`, `textContentType`, and submit behavior when migrating to shared fields.

## Application guidance

- Use `TextInputField` for ordinary labeled text inputs.
- Use `FormField` directly when the control is a non-text primitive such as date pickers, chips, segmented controls, or custom bottom-sheet selectors.
- Keep keyboard-aware scroll/sticky footer clearance unchanged when replacing local labels or inputs.
- Do not move validation logic into the visual component. The screen/controller still owns validation and submit behavior.

## Verification

Automated checks:

- `pnpm --filter @i-um/mobile exec node --import tsx --test lib/design/form-accessibility.test.mts lib/app-info/form-accessibility-pattern.test.mts`
- `pnpm --filter @i-um/mobile typecheck`
- `pnpm --filter @i-um/mobile format:check`

Manual smoke still required:

- Submit a form with missing/invalid required data and confirm the first invalid field or error summary receives focus/announcement.
- Confirm amount/date/search fields keep the expected keyboard and return-key behavior.
- Confirm small phone + keyboard open does not hide focused inputs behind sticky footers.

## Related follow-up

#396 applies these field primitives across representative mobile forms and sheets.
