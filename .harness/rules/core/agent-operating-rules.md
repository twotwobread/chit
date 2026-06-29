# Agent Operating Rules

## Context discipline

- Do not read broad docs by default.
- Classify the task phase before expanding context.
- Prefer the target file, target feature spec, relevant code, and one small rule file over umbrella documents.
- Expand context progressively with `rg`/`find` first, then narrow reads.
- If ambiguity is product/domain-level, stop and ask instead of inferring intent from unrelated docs.
- Read `docs/decisions/` only when changing or revisiting product, technical, domain, API, DB, or ops direction.

## Working principles

- Keep changes minimal and tied to the user request.
- State assumptions when they affect implementation.
- Do not implement future options or adjacent improvements.
- Do not overwrite unrelated user changes.
- Match existing style unless the task explicitly changes it.

## Source-of-truth precedence

1. User request for the current task.
2. `.harness` workflows/contracts/rules/providers for agent process.
3. Feature behavior: target `docs/features/<id>.md` when present.
4. API contract: `packages/api-contract/openapi.yaml`.
5. DB schema: `apps/api/migrations/` and generated `apps/api/schema.sql`.
6. SQL queries: `apps/api/queries/` and generated `apps/api/internal/db/`.
7. Mobile design tokens/primitives: `apps/mobile/lib/design/theme.ts` and `apps/mobile/lib/design/components.tsx`.
