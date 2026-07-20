# 0396 FormField adoption in mobile forms

## Summary

Representative mobile forms now render visible labels, helper/error copy, required markers, and disabled/submitting state through shared `FormField` and `TextInputField` primitives instead of per-screen label/error fragments.

## Applied surfaces

- Trip create review: trip name uses `TextInputField`; destination search error copy is attached to `FormField` live error text.
- Trip edit: trip name uses `TextInputField`; start/end date controls are wrapped by required `FormField`.
- Quick expense sheet: receipt, schedule selector, amount, summary rows, and memo use `FormField` for consistent visible copy.
- Quick expense entry: settlement title and memo use `TextInputField`; payment date, amount, receipt, schedule, and option rows use `FormField`.
- Expense edit: title and memo use `TextInputField`; amount and shared schedule selectors use `FormField` error slots.
- Itinerary place edit sheet: read-only place context, place-type chips, and memo use shared field primitives.
- Account display-name edit: profile name input uses `TextInputField` with required/error/disabled state.

## UX guardrails

- Errors stay next to the affected field through `FormField.errorText`, preserving `accessibilityLiveRegion="polite"` from the primitive.
- Custom controls remain in existing keyboard-aware scroll and sticky footer containers; only field wrappers changed.
- Amount inputs with currency suffixes keep their existing custom input row but move label/error/required structure to `FormField`.
- Memo textareas use `TextInputField` multiline styling while preserving existing memo-height keyboard layout measurement wrappers.

## Smoke checklist

Manual device smoke is still required for:

- Trip create/edit with keyboard open on trip name.
- Expense create/edit/quick expense with amount and memo focused near the sticky footer.
- Bottom-sheet split/settlement flows and itinerary place edit sheet while saving/disabled.
