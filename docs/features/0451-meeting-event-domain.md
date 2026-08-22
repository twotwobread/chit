# Feature Slice: 모임과 일정 도메인 모델 도입

## Metadata

- GitHub Issue: #451
- Parent Epic: #449
- Status: Ready
- Created: 2026-08-22
- Updated: 2026-08-22

## Source

- Issue: #451 — `[모임 전환] 모임과 일정 도메인 모델 도입`
- Preceding IA source: `docs/features/0450-meeting-centered-ia.md`
- API source of truth: `packages/api-contract/openapi.yaml`
- DB source of truth: `apps/api/migrations/`, `apps/api/schema.sql`, `apps/api/queries/`

## Summary

Introduce the first production DB/API foundation for Chit's **Event-first + 모임-backed** direction.

This slice creates explicit `meeting` and `event` aggregates while preserving all existing `/trips/*` behavior. A meeting is the durable people/container layer; an event is the concrete dated execution unit that can later be backed by a trip or outing. One-off events are backed by hidden one-off meetings so they can appear in event history without appearing in `내 모임`.

## Scope

### In

- Add DB tables for meetings, meeting members, events, and event participants.
- Distinguish saved meetings from hidden one-off containers.
- Add OpenAPI contract for minimal create/read/list:
  - create/list/get saved meetings;
  - create a generic event by linking to an existing meeting, creating a saved meeting, or creating a one-off hidden meeting;
  - get an event detail for a participant.
- Add Go domain/service/repository/server implementation for those endpoints.
- Generate OpenAPI Go server/types, generated TS client, and sqlc DB code.
- Add automated tests for validation, authorization, one-off visibility, and generated drift.

### Out

- Home redesign or Home event sections (#453).
- Trip creation UX changes (#454).
- Backfilling/linking existing trips into events (#452).
- Meeting detail mobile UI (#455).
- Invites/member management beyond the creator/owner foundation (#456).
- Non-trip outing UI MVP (#459).
- Expense/settlement model generalization (#460).

## Domain Model

### Meeting

A meeting is a people/container aggregate.

Fields:

- `id`: UUID.
- `name`: 1–80 chars.
- `visibility`: `saved` or `one_off`.
- `created_by`: user id.
- `created_at`, `updated_at`.

Rules:

- `saved` meetings appear in `GET /meetings` for members.
- `one_off` meetings do **not** appear in `GET /meetings`.
- The authenticated creator is inserted as an owner meeting member.

### Meeting member

Fields:

- `id`: UUID.
- `meeting_id`: UUID.
- `user_id`: UUID.
- `role`: `owner` or `member`.
- `display_name`: current snapshot for display and future compatibility.
- `joined_at`.

Rules:

- `(meeting_id, user_id)` is unique.
- Current #451 endpoints create only the authenticated creator/owner. More member management belongs to #456.

### Event

An event is the dated execution unit.

Fields:

- `id`: UUID.
- `meeting_id`: UUID.
- `event_type`: `trip` or `outing`.
- `title`: 1–80 chars.
- `start_date`, `end_date`.
- `default_currency`: supported currency.
- `status`: `planned`, `completed`, or `cancelled`.
- `trip_id`: nullable unique FK for future trip-backed compatibility.
- `created_by`, `created_at`, `updated_at`.

Rules:

- `start_date <= end_date`.
- `trip_id` stays nullable in #451; #452 owns existing-trip linking/backfill.
- `outing` is allowed in the model/contract but no mobile outing UI is introduced in this slice.

### Event participant

Fields:

- `id`: UUID.
- `event_id`: UUID.
- `meeting_member_id`: nullable UUID.
- `user_id`: UUID.
- `role`: `owner` or `member`.
- `display_name`: snapshot.
- `joined_at`.

Rules:

- Current #451 endpoints create the creator as the owner event participant.
- Current user can read an event only if they are an event participant.

## API Contract

### `GET /meetings`

Returns saved meetings where the authenticated user is a meeting member. Hidden one-off containers are excluded.

### `POST /meetings`

Creates a saved meeting and owner member for the authenticated user.

Request:

```json
{
  "name": "동네 친구들"
}
```

Response: `201 Created` with `meeting`.

### `GET /meetings/{meetingId}`

Returns saved meeting detail for an authenticated meeting member. One-off meetings are not directly exposed through this saved-meeting endpoint.

### `POST /events`

Creates an event and the current user's owner event participant.

Supported meeting choices:

1. Existing saved meeting: `meeting.mode = "existing"`, `meeting.meetingId` required.
2. New saved meeting: `meeting.mode = "new"`, `meeting.name` required.
3. One-off hidden meeting: `meeting.mode = "one_off"`, `meeting.name` optional; if omitted, the event title can seed the container name.

The server rejects invalid dates, unsupported event types/currencies, missing required meeting fields, and existing meeting ids where the user is not a member.

### `GET /events/{eventId}`

Returns event detail for a current event participant. The response includes the meeting visibility so clients can tell whether the event is backed by a saved meeting or a one-off hidden container.

## Compatibility Strategy

- Existing `/trips/*` API behavior is unchanged in #451.
- New tables are additive; no existing trip rows are backfilled in this slice.
- `events.trip_id` is nullable and unique, enabling #452 to link trips to event rows without replacing current trip identifiers.
- Existing clients can ignore new generated client surfaces until mobile slices adopt them.
- `trip` remains a valid event type and internal code may still use trip-specific names where the implementation is still trip-only.

## Acceptance Criteria

- [x] Meeting and event identifiers, ownership/participation, statuses, and visibility are represented in DB and API.
- [x] Saved meetings and hidden one-off containers are distinguishable.
- [x] `GET /meetings` excludes one-off containers while `GET /events/{eventId}` can return one-off event details to participants.
- [x] Existing meeting event creation requires current-user meeting membership.
- [x] Migration/compatibility strategy for linking future trip-backed events is explicit and implemented with a nullable `events.trip_id` FK.
- [x] Generated Go OpenAPI, TS client, and sqlc DB code are up to date.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Event creation supports new saved meeting, existing meeting, and one-off policies | Service/API | `apps/api/internal/meeting/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| DB one-off visibility and FK/check constraints | Storage/sqlc | `apps/api/internal/storage/meeting_repository_test.go` | `DATABASE_URL=... pnpm --filter @i-um/api test` |
| Contract/generated artifacts are current | Generated | OpenAPI/sqlc generated code | `pnpm generate && pnpm verify:generated` |
| Existing trip behavior still compiles/tests | API regression | API package tests/build | `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build` |

## Regression Gaps

- Mobile UI smoke is not expected for this API/DB foundation slice; generated TS client compilation and mobile tests cover client compatibility.

## Verification Record

### Automated Regression

- `CGO_ENABLED=0 pnpm verify:generated` — passed.
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` — passed; DB integration tests skip without an available local DB.
- `CGO_ENABLED=0 pnpm --filter @i-um/api build` — passed.
- `CGO_ENABLED=0 pnpm --filter @i-um/api lint` — passed.
- `pnpm --filter @i-um/api format:check` — passed.
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` — passed.
- `pnpm --filter @i-um/mobile typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` — passed.
- `pnpm harness:validate` — passed.

### Manual Smoke

- DB migration apply/rollback/re-apply: not run locally; Docker daemon was unavailable.
- Android: not run; API/DB foundation slice and no simulator/device session available.
- iOS: not run; API/DB foundation slice and no simulator/device session available.

## Release Notes

- Adds additive meeting/event API and DB foundation for the meeting-centered transition.

## Follow-up Issues

- #452 link/backfill existing trips under events.
- #453 Home event/meeting sections.
- #454 Event-first trip creation.
- #455 Meeting detail screen.
- #456 Meeting invite/member management.
- #457 Event participant selection from meeting members.
