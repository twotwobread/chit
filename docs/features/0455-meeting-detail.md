# Feature Slice: 모임 상세에서 일정과 멤버 조회

## Metadata

- GitHub Issue: #455
- Parent Epic: #449
- Status: Implemented
- Created: 2026-08-23
- Updated: 2026-08-23

## Source

- Issue: #455 — `[모임 전환] 모임 상세에서 일정과 멤버 조회`
- IA source: `docs/features/0450-meeting-centered-ia.md`
- Domain foundation: `docs/features/0451-meeting-event-domain.md`
- Trip/event linkage: `docs/features/0452-trip-event-link.md`
- Home dashboard: `docs/features/0453-home-events.md`
- Event-first trip creation: `docs/features/0454-event-first-trip-creation.md`
- API source of truth: `packages/api-contract/openapi.yaml`

## Summary

Saved meeting cards become navigable to a normal meeting detail page. The detail page shows meeting identity, upcoming/current trip-backed events, settlement-needed cues for those events, past event history, and member rows. Hidden one-off containers remain excluded from saved meeting lists and cannot be opened through the meeting detail endpoint.

## Scope

### In

- Extend `GET /meetings/{meetingId}` so the authenticated meeting member receives:
  - the saved `meeting`;
  - `members` for that meeting;
  - linked `events` for that meeting.
- Keep `GET /meetings/{meetingId}` limited to saved meetings where the current user is a member.
- Add Home navigation from saved meeting rows to `/meetings/{meetingId}`.
- Add mobile meeting detail route `apps/mobile/app/meetings/[meetingId].tsx`.
- Add mobile view-model helpers that group meeting events into upcoming/current and past sections using the local current date.
- Add settlement cue rows by filtering existing `/me/settlement-summary` to trip IDs present in the meeting detail events.
- Show member list with role labels.

### Out

- Meeting invite/member management actions (#456).
- Selecting a subset of meeting members for an event (#457).
- Converting one-off events to saved meetings (#458).
- Non-trip outing creation/detail (#459).
- Common event-level settlement model (#460).
- Renaming/retiring legacy trip routes (#461).
- Photos, memories, recaps, advanced stats.

## Decisions

- API response shape is additive: `GetMeetingResponse` keeps `meeting` and adds required `members` and `events` arrays. Existing clients reading only `meeting` remain compatible.
- `events` uses the existing `Event` schema. It includes `tripId`; mobile routes only trip-backed events to `/trips/{tripId}`.
- API returns all events in a saved meeting ordered by date proximity/recentness. Mobile handles upcoming/current/past grouping.
- Upcoming/current grouping rule: an event is visible in `다가오는 일정` if `endDate >= today`; otherwise it is `지난 일정`.
- Member ordering: owner rows first, then joined time, then id. Role labels: `owner` → `모임장`, `member` → `멤버`.
- Meeting detail settlement cues reuse `GET /me/settlement-summary`; no new meeting-specific settlement endpoint is added in this slice.
- Empty states use meeting/event language: no one-off containers, no trip-only list copy.

## Acceptance Criteria

- [x] Saved meeting cards on Home open meeting detail.
- [x] `GET /meetings/{meetingId}` returns saved meeting detail with members and linked events for current meeting members.
- [x] `GET /meetings/{meetingId}` rejects unauthenticated, invalid id, one-off, missing, or non-member access.
- [x] Meeting detail groups linked events into upcoming/current and past sections.
- [x] Meeting detail shows settlement-needed rows for matching trip-backed meeting events using existing settlement summary data.
- [x] Meeting detail shows member rows with display names and role labels.
- [x] One-off containers are not surfaced as Home meeting detail entry targets.
- [x] Trip-backed event rows keep canonical `/trips/*` navigation.
- [x] Generated OpenAPI Go/TS artifacts are up to date.

## API Changes

Update `GetMeetingResponse`:

```yaml
required:
  - meeting
  - members
  - events
properties:
  meeting: Meeting
  members: MeetingMember[]
  events: Event[]
```

No new path is needed.

## DB Changes

No schema migration expected. Existing `meetings`, `meeting_members`, and `events` tables are sufficient.

SQL query additions:

- list members for a saved meeting visible to the requester;
- list events for a saved meeting visible to the requester.

## Mobile Changes

- Add `getMeeting(meetingId)` wrapper to `apps/mobile/lib/trips/meeting-api.ts`.
- Add meeting detail view-model helpers under `apps/mobile/lib/trips/meeting-detail.ts` with tests.
- Add source guard for Home meeting navigation and detail route copy.
- Update Home saved meeting rows to `Pressable` and route to `/meetings/{id}`.
- Add `apps/mobile/app/meetings/[meetingId].tsx` using existing design primitives.

## Test Plan

- API contract/source guard:
  - `GetMeetingResponse` includes `members` and `events`.
- API service tests:
  - saved meeting detail returns meeting, members, events;
  - missing/invalid/unauthenticated access fails.
- API server tests:
  - Home/detail endpoint returns members/events for owner;
  - outsider cannot fetch the meeting detail;
  - one-off meeting id is not exposed through detail.
- Storage integration test:
  - saved meeting with linked trip event returns members/events;
  - one-off/missing remains hidden; skipped without `DATABASE_URL`.
- Mobile tests:
  - view-model grouping and role labels;
  - settlement cue filtering by meeting event trip IDs;
  - route/source guard for Home saved meeting row and meeting detail screen.
- Full generated/API/mobile verification.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/meeting-detail.test.mts lib/app-info/meeting-detail.test.mts` — passed.
- `CGO_ENABLED=0 pnpm verify:generated` — passed.
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` — passed.
- `CGO_ENABLED=0 pnpm --filter @i-um/api build` — passed.
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` — passed.
- `pnpm --filter @i-um/mobile typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` — passed.
- `pnpm harness:validate` — passed.
- `git diff --check` — passed.
- `DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run TestMeetingRepositoryGetsSavedMeetingDetailWithMembersAndEvents -count=1` from `apps/api` — passed.

## Manual Smoke

- Android: not run; no simulator/device session in this environment.
- iOS: not run; no simulator/device session in this environment.

## Open Questions

None blocking. Member management and event participant selection are owned by #456/#457.
