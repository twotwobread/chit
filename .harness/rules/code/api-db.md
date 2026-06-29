# API and DB Rule

Use when changing API contract, Go API behavior, SQL, migrations, or core domain schema.

## Source of truth

- Current API: `packages/api-contract/openapi.yaml`
- Current DB: `apps/api/migrations/`, `apps/api/schema.sql`
- Current code: implementation files
- Historical decisions: `docs/decisions/` only when changing/revisiting cross-feature direction

Do not infer current schema from old docs or historical decisions.

## API contract

- OpenAPI is the source of truth.
- Update OpenAPI before server/mobile implementation.
- Regenerate Go server interface and TS client/types after contract changes.
- Mobile code must use generated client/types instead of duplicate hand-written DTOs.

## Go layers

- Handler: auth context, request/response conversion, HTTP status/error mapping.
- Service: validation, authorization, business rules, transaction decision.
- Repository: sqlc query calls, DB row mapping, transaction execution.

Do not put business rules in handlers.

## DB

- Use goose migrations for schema changes.
- Add needed foreign keys, unique constraints, checks, and indexes with the migration.
- Update sqlc queries/generated DB code when needed.
- Do not store money as floating point.
- Keep date/timestamp semantics aligned with OpenAPI.
- Adding/changing a core domain model requires explicit feature spec scope.

## Verification

```bash
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
```

For DB schema changes, also verify migration apply/status/rollback/re-apply with a test database.
