# Decisions

This directory stores decision records for product, technical, data, and operations choices.

Decision records explain why a choice was made. They are history, not the current implementation source of truth.

Current source of truth:

- Feature behavior: `docs/features/<id>.md`
- API contract: `packages/api-contract/openapi.yaml`
- DB schema: `apps/api/migrations/`, `apps/api/schema.sql`
- Code: implementation files

Use decision records only when:

- drafting or changing feature scope
- revisiting a previous product/technical decision
- changing cross-feature product, domain, API, DB, or operations direction
- understanding why an existing design exists

Do not read decision records by default for normal implementation or PR lifecycle tasks.

Record format:

- Status: Proposed | Accepted | Superseded | Deprecated
- Context
- Decision
- Consequences
- Source of truth links
- Supersedes / Superseded by
