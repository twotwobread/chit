# 0457 — Event Participant Selection from Meeting Members

- Issue: #457
- Epic: #449
- Status: Implemented
- Date: 2026-08-23

## Goal

모임 멤버 전체와 특정 일정(현재는 trip-backed event) 참여자를 분리한다. 여행 생성/수정에서 저장 모임 멤버 중 이 일정에 함께할 사람을 고를 수 있게 하고, 장부/정산은 계속 일정 참여자 기준으로 계산한다.

## Product Policy

- 저장 모임은 장기 컨테이너다.
- trip-backed event의 참여자는 `trip_participants` + `event_participants`가 표현하는 일정 단위 참여자다.
- 기존 저장 모임으로 여행을 만들 때 기본값은 현재 모임 멤버 전체 선택이다.
- 일부 모임 멤버를 제외하면 그 멤버는 저장 모임에는 남지만 해당 여행/일정, 장부, 정산 참여자는 아니다.
- 기존 지출/정산 데이터가 있는 참여자를 나중에 제외하면 기존 지출/분할은 display-name snapshot으로 보존하고 정산에 historical row로 계속 반영한다.
- owner/current creator는 이 slice에서 제외할 수 없다. owner transfer는 후속으로 둔다.
- one-off trip은 저장 모임 멤버 선택 UI/API 대상이 아니다.

## Scope

### In

- `TripMeetingContextInput.participantMemberIds`로 existing saved meeting trip creation subset 선택.
- `PUT /trips/{tripId}/participants` owner-only replacement endpoint for saved meeting-backed trips.
- `TripParticipantListItem.userId` response field for mobile reconciliation.
- Mobile trip creation participant selection step for existing saved meetings.
- Mobile trip edit participant selection card for saved meeting-backed owner trips.
- Trip participants screen copy clarification.
- Tests for helper, contract, service/server, DB lifecycle, and settlement regression.

### Out

- RSVP/attendance states.
- Participant-specific notifications.
- Owner transfer.
- Event-native non-trip create/edit routes.
- Root nav changes or `/trips/*` retirement.

## Acceptance Criteria

- [x] A saved meeting with 6 members can create a trip-backed event with 4 selected event participants while all 6 remain meeting members.
- [x] Omitted `participantMemberIds` keeps backward-compatible all-current-members selection.
- [x] Empty/duplicate/non-current/non-same-meeting participant member IDs are rejected.
- [x] The owner/current creator must remain selected.
- [x] Owner can replace saved meeting-backed trip participants with a subset of current meeting members.
- [x] Non-owner replacement is forbidden.
- [x] One-off participant replacement by meeting member ID is unavailable/rejected.
- [x] Removing a participant with existing expense payer/split rows preserves ledger snapshots and settlement calculation.
- [x] Mobile creation/edit defaults all current saved meeting members selected and allows excluding some.
- [x] Trip detail/participant UI distinguishes event/trip participants from saved meeting members.

## API Changes

- Extend `TripMeetingContextInput`:
  - `participantMemberIds?: string[]`
  - Applies only when `mode = existing`.
  - `undefined`: all current saved meeting members.
  - `[]`: validation error.
- Add `PUT /trips/{tripId}/participants`:
  - Request: `{ participantMemberIds: string[] }`
  - Response: `ListTripParticipantsResponse`
  - Owner-only.
  - Saved meeting-backed trips only.
- Extend `TripParticipantListItem` with `userId`.

## DB / Data

No schema migration expected. Existing tables are sufficient:

- `meeting_members`: saved group membership.
- `event_participants`: event-level participants.
- `trip_participants`: canonical trip/event participant set while `/trips/*` remains canonical.

Existing participant deletion behavior snapshots expense payer/split display names and lets FKs become null. This is the conflict policy for participant replacement.

## Mobile UX

- Existing meeting selection remains in the trip creation flow.
- After selecting an existing saved meeting, show `이번 일정 참여자` rows from current meeting members.
- Default all selected; chips/rows can toggle members.
- Copy clarifies: `모임 멤버와 이 일정 참여자는 다를 수 있어요.`
- In trip edit, owners of saved meeting-backed trips see a participant selection card below basic trip info.
- Expense payer/split pickers continue reading trip participants only.

## Test Plan

- Mobile helper tests:
  - default all selected
  - toggle member selection
  - validation requires at least one and current owner
  - payload includes `participantMemberIds` only for existing mode
  - summary count copy
- API contract/source tests:
  - `participantMemberIds`
  - `replaceTripParticipants`
  - `TripParticipantListItem.userId`
- API service/server tests:
  - create normalization/validation
  - replace authorization and validation
  - request/response mapping
- Storage DB tests:
  - create 4-of-6 event participants
  - replace subset and preserve expense snapshots/settlement
- Full verification before PR.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/event-participants.test.mts lib/trips/create-trip-context.test.mts lib/app-info/event-participant-selection.test.mts` — passed.
- `CGO_ENABLED=0 go test ./internal/trip ./internal/server -run 'TestServiceCreate.*SelectedMeetingMember|TestServiceReplaceParticipants|TestCreateTripWithSelectedMeetingParticipants|TestReplaceTripParticipantsHandler|TestListTripParticipantsHandler' -count=1` from `apps/api` — passed.
- `DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run 'TestTripRepositoryEventParticipantSelectionCreatesSubset|TestTripRepositoryReplaceParticipantsPreservesExpenseSnapshots' -count=1` from `apps/api` — passed.
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` — passed.
- `CGO_ENABLED=0 pnpm --filter @i-um/api build` — passed.
- `CGO_ENABLED=0 pnpm verify:generated` — passed.
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` — passed.
- `pnpm --filter @i-um/mobile typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` — passed.
- `pnpm harness:validate` — passed.
- `git diff --check` — passed.

## Manual Smoke

- Android: not run; no simulator/device session in this environment.
- iOS: not run; no simulator/device session in this environment.

## Open Questions

None blocking. Owner transfer and RSVP are deferred.
