# Provider: product-direction-review

## Phase

`spec.author`

## Tool

No single tool is assumed. Use human clarification, PM/design/QA review, Ouroboros clarification, or another explicitly approved product-review tool as appropriate.

## Use when

- Product direction itself is unclear.
- The best framing is uncertain across PM, design, QA, and engineering concerns.
- The request needs option generation before a single implementation spec is safe.

## Behavior

Clarify product/design/QA options first, then convert the chosen direction into canonical `feature.spec.yaml`.

Do not let downstream phases depend on provider-private notes; record only stable decisions and evidence in the canonical spec and ledger.
