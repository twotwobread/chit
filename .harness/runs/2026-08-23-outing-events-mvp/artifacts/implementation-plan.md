# Implementation Plan

## Scope

Implement #459 outing event MVP: API/DB metadata + participant subset, mobile outing create/detail, Home/meeting routing.

## Files likely to change

- `docs/features/0459-outing-events-mvp.md`
- `packages/api-contract/openapi.yaml`, generated TS/Go
- `apps/api/migrations/00035_add_outing_event_metadata.sql`, `apps/api/schema.sql`
- `apps/api/queries/meetings.sql`, generated sqlc
- `apps/api/internal/meeting/*`, `apps/api/internal/server/*`, `apps/api/internal/storage/*`
- `apps/mobile/app/events/new.tsx`, `apps/mobile/app/events/[eventId].tsx`
- `apps/mobile/app/index.tsx`, `apps/mobile/app/meetings/[meetingId].tsx`
- `apps/mobile/lib/trips/outing-event*`, `meeting-api.ts`, `meeting-detail.ts`

## Test-first plan

1. Add mobile app-info/source and helper tests for outing create/detail/routing.
2. Add API meeting service/server/storage tests for outing metadata + participant selection.
3. Run red tests, then implement.

## Steps

1. Update OpenAPI and DB migration/schema/queries.
2. Generate API contract/server/sqlc artifacts.
3. Implement meeting service/storage/server mapping.
4. Implement mobile helpers/API wrappers/screens and route updates.
5. Run focused tests, then full gates.

## Verification

- Focused mobile outing tests.
- Focused API meeting/server/storage tests.
- `pnpm verify:generated`
- full API/mobile tests/typecheck/lint/format/harness/diff gates.

## Risks / rollback

- New event columns are nullable and backward-compatible; rollback drops added columns.
- Outing detail intentionally excludes trip tabs/ledger in this MVP.
