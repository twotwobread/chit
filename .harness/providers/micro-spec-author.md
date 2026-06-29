# Provider: micro-spec-author

## Phase

`spec.author`

## Use when

- Risk is low.
- Ambiguity is low.
- Architecture impact is local.
- Acceptance can be expressed with a focused test/smoke check.

## Behavior

Draft a concise canonical `feature.spec.yaml`. Keep it small, but include acceptance criteria, out-of-scope items, and a test plan.

For small testable work, this provider may use Superpowers-style TDD framing to express acceptance criteria and first tests, but it must still output the canonical spec artifact. Downstream implementation should read only `feature.spec.yaml`, not provider notes.

## Do not use when

- Product/domain/UX direction is unclear.
- API/DB/auth/privacy/billing/audit-log changes need decisions.
- Scope is larger than one focused PR.
