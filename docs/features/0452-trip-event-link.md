# Feature Slice: 여행을 모임 하위 일정으로 연결

## Metadata

- GitHub Issue: #452
- Parent Epic: #449
- Status: Implemented
- Created: 2026-08-22
- Updated: 2026-08-22

## Source

- Issue: #452 — `[모임 전환] 여행을 모임 하위 일정으로 연결`
- IA source: `docs/features/0450-meeting-centered-ia.md`
- Domain foundation: `docs/features/0451-meeting-event-domain.md`
- API source of truth: `packages/api-contract/openapi.yaml`
- DB source of truth: `apps/api/migrations/`, `apps/api/schema.sql`, `apps/api/queries/`

## Summary

Connect existing and newly created trips to the new meeting/event domain without changing public trip routes or trip feature behavior.

In this slice, every trip is represented as a `trip` event backed by a hidden one-off meeting container unless a later creation flow explicitly chooses a saved meeting. Existing `/trips/*` endpoints remain canonical for trip detail, schedule, map, expense, and settlement behavior. The new event context is exposed on trip list/detail responses so follow-up Home/creation/meeting-detail slices can navigate through event/meeting context safely.

## Scope

### In

- Backfill existing trips into `meetings`, `meeting_members`, `events`, and `event_participants`.
- Link new trip creation to a one-off meeting and `trip` event in the same transaction.
- Add a nullable `eventContext` object to `Trip` and `TripListItem` API schemas and generated clients.
- Populate event context on `GET /trips`, `POST /trips`, and `GET /trips/{tripId}`.
- Preserve existing `/trips/{tripId}` route and all trip tab/detail behavior.
- Keep trip invite accept/remove flows in sync with linked event participant snapshots for one-off trip meetings.
- Add tests for create/list/detail compatibility and backfill/linkage behavior.
- Document route/API responsibility boundaries.

### Out

- Event-first trip creation UX choice between existing/new/one-off meeting (#454).
- Meeting detail mobile UI (#455).
- Meeting invite/member management (#456).
- Event participant selection from meeting members (#457).
- Non-trip outing UI (#459).
- General expense/settlement `event_id` migration (#460).
- Retiring `/trips/*` routes or deep links (#461).

## Behavior

### Existing trips

Migration creates one hidden one-off meeting and one `trip` event per existing trip that does not already have an event row.

For each trip:

- meeting name = trip name;
- meeting visibility = `one_off`;
- meeting members mirror current `trip_participants` roles/display names/join order;
- event type = `trip`;
- event title/date/default currency mirror the trip;
- event status starts as `planned` for compatibility;
- `events.trip_id` points to the trip;
- event participants mirror current trip participants and link to the corresponding meeting members.

### New trips

`POST /trips` continues to accept the existing trip request body. The server creates:

1. the trip and owner trip participant;
2. a hidden one-off meeting named after the trip;
3. an owner meeting member snapshot;
4. a `trip` event linked through `events.trip_id`;
5. an owner event participant snapshot.

### API responses

`Trip` and `TripListItem` expose:

```json
"eventContext": {
  "eventId": "...",
  "meetingId": "...",
  "meetingName": "오사카 3박 4일",
  "meetingVisibility": "one_off"
}
```

The field is nullable for compatibility while migrations roll forward, but newly created and backfilled trips should return a non-null context.

## Compatibility Boundary

- `/trips/*` remains the route/API owner for trip-specific behavior: detail, dates/destinations, schedule, map, expenses, settlement, flights, invites.
- `/events/*` is the generalized event identity/read surface introduced in #451.
- #452 does not add mobile event routes or change current Expo Router paths.
- Future route helpers may use `eventContext.eventId` to enter event-aware Home/meeting surfaces while continuing to deep-link old trip screens through `/trips/{tripId}`.
- Existing trip participant, invite, expense, schedule, map, and settlement tables remain trip_id-based in this slice. Invite accept/remove flows mirror event participant snapshots so later meeting/event surfaces do not drift from the trip roster.

## Acceptance Criteria

- [x] New trips receive a linked hidden one-off meeting and `trip` event.
- [x] Existing trips are backfilled/linkable into meeting/event context without changing trip IDs.
- [x] `GET /trips`, `POST /trips`, and `GET /trips/{tripId}` expose non-null event context for linked trips.
- [x] Existing trip APIs/routes remain accessible and do not require clients to switch to `/events/*`.
- [x] Contract/generated artifacts are up to date.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| New trip creation returns one-off event context and preserves trip response | Server/API | `apps/api/internal/server/server_test.go` | `CGO_ENABLED=0 go test ./internal/server -run TestCreateTripHandler` |
| Repository list/detail model carries event context | Go/API | `apps/api/internal/storage/trip_event_link_repository_test.go` | `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` |
| Trip invite accept/remove syncs linked event participant snapshots | DB integration/storage | `apps/api/internal/storage/trip_event_link_repository_test.go` | `DATABASE_URL=... pnpm --filter @i-um/api test` |
| Existing trip backfill creates one event context per trip | DB migration/static guard | `apps/api/internal/storage/trip_event_link_migration_test.go` | `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` |
| Linked event/one-off meeting create and delete works with a real DB | DB integration/storage | `apps/api/internal/storage/trip_event_link_repository_test.go` | `DATABASE_URL=... pnpm --filter @i-um/api test` |
| Trip routes remain route-compatible | Mobile route guard | `apps/mobile/lib/app-info/trip-event-link-compat.test.mts` | `cd apps/mobile && node --import tsx --test lib/app-info/trip-event-link-compat.test.mts` |
| Generated drift | Generated | OpenAPI/sqlc/TS client | `CGO_ENABLED=0 pnpm verify:generated` |

## Regression Gaps

- Local DB migration apply/rollback/re-apply requires Docker/Postgres availability.

## Verification Record

### Automated Regression

- `CGO_ENABLED=0 pnpm verify:generated` — passed.
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` — passed.
- `CGO_ENABLED=0 pnpm --filter @i-um/api build` — passed.
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` — passed.
- `pnpm --filter @i-um/mobile typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` — passed.
- `pnpm harness:validate` — passed.

### Manual Smoke

- DB migration apply/rollback/re-apply: not run locally; Docker daemon unavailable (`Cannot connect to the Docker daemon at unix:///Users/sylee/.docker/run/docker.sock`).
- Android: not run; no simulator/device session in this environment.
- iOS: not run; no simulator/device session in this environment.

## Release Notes

- Trips now carry meeting/event context while keeping `/trips/*` behavior stable.

## Follow-up Issues

- #453 Home v1 can consume `eventContext` for upcoming/past event sections.
- #454 can replace the one-off default with an explicit event-first creation choice.
- #455 can open meeting detail from linked trip/event context.
