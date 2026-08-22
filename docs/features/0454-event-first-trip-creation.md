# Feature Slice: Event-first 여행 생성 플로우 도입

## Metadata

- GitHub Issue: #454
- Parent Epic: #449
- Status: Implemented
- Created: 2026-08-23
- Updated: 2026-08-23

## Source

- Issue: #454 — `[모임 전환] Event-first 여행 생성 플로우 도입`
- IA source: `docs/features/0450-meeting-centered-ia.md`
- Domain foundation: `docs/features/0451-meeting-event-domain.md`
- Trip/event linkage: `docs/features/0452-trip-event-link.md`
- Home entry: `docs/features/0453-home-events.md`
- API source of truth: `packages/api-contract/openapi.yaml`

## Summary

Travel creation becomes event-first and meeting-backed. Users start from the current `/trips/new` entry, choose `여행`, then choose who this travel schedule belongs with: an existing saved meeting, a new saved meeting, or `이번만 함께하기`. Existing trip form fields for destination/date/settings/review remain the travel details step.

## Scope

### In

- Extend `CreateTripRequest` with an optional meeting context input while preserving old clients as one-off by default.
- Support three trip creation modes:
  - `one_off`: hidden one-off meeting, current default.
  - `existing`: link the trip event to a saved meeting where the creator is already a member.
  - `new_saved`: create a saved meeting and link the trip event to it.
- In `existing` mode, seed trip participants and event participants from current meeting members. Creator remains trip owner; other meeting members become trip members.
- In `new_saved` and `one_off` mode, create the creator as the initial owner participant.
- Add mobile create-flow steps before the current trip detail wizard:
  1. `무엇을 할까요?` with travel selected/available in this slice.
  2. `누구와 함께하나요?` with existing meeting, new saved meeting, or one-off.
- Reuse the current trip detail form after context selection.
- Show chosen context in the final review and submit it to the API.

### Out

- Non-trip outing creation (#459).
- Meeting detail navigation (#455).
- Meeting invitation/member management (#456).
- Event participant subset selection from meeting members (#457).
- One-off to saved meeting conversion (#458).
- Generalized expense/settlement event model (#460).

## Decisions

- `CreateTripRequest.meetingContext` is optional for backward compatibility. Omitted means `{ mode: 'one_off' }`.
- Existing meeting selection uses `GET /meetings`; one-off meetings are not selectable.
- New saved meeting name defaults to the resolved trip name unless the user enters a separate meeting name in the context step.
- Existing meeting mode uses all current meeting members as initial trip participants. This satisfies #454's "멤버를 기본 참여자로 사용할 수 있다" without implementing the subset picker owned by #457.
- Creator's trip role is always `owner`, regardless of meeting member role. Other meeting members are trip/event `member` participants.
- Trip-specific screens continue to route through `/trips/*`.

## Acceptance Criteria

- [x] Users can create a travel schedule without first creating a meeting.
- [x] Create trip request supports one-off, existing saved meeting, and new saved meeting contexts.
- [x] Existing saved meeting context seeds initial trip/event participants from meeting members.
- [x] One-off context returns `eventContext.meetingVisibility = 'one_off'` so Home/detail can show `이번만`.
- [x] New saved meeting context returns `eventContext.meetingVisibility = 'saved'` and the selected/new meeting name.
- [x] Existing `/trips/new` destination/date/settings/review behavior remains available after context selection.
- [x] Generated OpenAPI Go/TS artifacts are up to date.

## API Changes

Add `TripMeetingContextInput` to the OpenAPI contract and optional `meetingContext` to `CreateTripRequest`.

Proposed shape:

```json
{
  "meetingContext": {
    "mode": "existing",
    "meetingId": "..."
  }
}
```

Modes:

- `one_off`: no additional fields.
- `existing`: requires `meetingId`.
- `new_saved`: optional `meetingName`; server falls back to trip name.

## DB Changes

No schema migration expected. Existing `meetings`, `meeting_members`, `events`, `event_participants`, and `trip_participants` tables are sufficient.

SQL query additions may be needed for listing meeting members inside the create-trip transaction.

## Mobile Changes

- Add create-flow helper/view-model tests for meeting context choices and request payloads.
- Update `/trips/new` to load saved meetings, ask context first, then reuse the existing trip details wizard.
- Add a compact review context card before submit.
- Keep CTA truthful: only travel creation is available in this slice; outing option can be shown disabled or omitted.

## Test Plan

- API/server tests:
  - old request without `meetingContext` still creates a one-off event context;
  - `existing` meeting context creates saved event context and seeds meeting members;
  - `new_saved` context creates saved meeting/event context;
  - forbidden/nonexistent existing meeting is rejected.
- Storage tests for transaction behavior, skipped when `DATABASE_URL` is unavailable.
- Mobile helper tests for context selection, payload building, and review labels.
- Mobile source guard for event-first creation labels and route compatibility.
- Full generated/mobile/API verification.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/create-trip-context.test.mts lib/app-info/event-first-trip-creation.test.mts` — passed.
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
- `DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run TestTripRepositoryCreatesTripInExistingSavedMeetingWithMembers -count=1` from `apps/api` — passed.

## Manual Smoke

- Android: not run; no simulator/device session in this environment.
- iOS: not run; no simulator/device session in this environment.

## Open Questions

None blocking. Event participant subset selection and outing creation are explicitly follow-up issues.
