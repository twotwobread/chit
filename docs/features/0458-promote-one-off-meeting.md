# 0458 — Promote One-off Event to Saved Meeting

- Issue: #458
- Epic: #449
- Status: Implemented
- Date: 2026-08-23

## Goal

이번만 함께한 trip-backed event를 다시 초대하거나 기록을 옮기지 않고 정식 저장 모임으로 승격한다. 승격 후 같은 일정/지출/정산 기록은 그대로 남고, 컨테이너가 홈의 `내 모임`과 모임 상세에서 저장 모임으로 보인다.

## Product Policy

- one-off meeting은 이벤트를 만들 때 생긴 임시 컨테이너다.
- promotion은 기존 `meeting_id`를 유지하면서 `meetings.visibility`를 `one_off`에서 `saved`로 바꾸는 전환이다.
- 기존 trip, event, meeting members, event participants, expenses, expense splits, settlement snapshot rows는 새로 만들거나 이동하지 않는다.
- `created_by`와 owner/member roles는 유지된다. owner transfer는 후속 범위다.
- promotion은 trip owner만 실행할 수 있다. non-owner는 CTA를 보지 못하고 API는 403을 반환한다.
- 이미 saved meeting-backed event나 linked one-off meeting이 없는 trip은 promotion 대상이 아니며 409를 반환한다.
- 현재 domain에는 별도 meeting type 필드가 없으므로 이 slice의 타입 입력은 `정식 모임`(saved visibility)로 고정하고, 사용자는 모임 이름만 확인/수정한다.

## Scope

### In

- Add `POST /trips/{tripId}/meeting/promotion` with `PromoteTripMeetingRequest` and `PromoteTripMeetingResponse`.
- Add trip service/repository promotion flow with owner authorization and one-off-only conflict policy.
- Add SQL query to update the linked one-off meeting to saved without schema migration.
- Add mobile one-off trip detail CTA and compact promotion form.
- Add mobile API wrapper and helper logic for promotion form state/copy.
- Add source/contract tests, service/server tests, storage transaction tests, mobile state tests, and home refresh regression coverage.

### Out

- Merging multiple one-off events into one meeting.
- Automatic saved-meeting suggestions.
- Owner transfer or role changes during promotion.
- New meeting category/type persistence beyond existing `saved` visibility.
- Event-native non-trip promotion route after `/trips/*` retirement.

## Acceptance Criteria

- [ ] A trip owner can save a one-off trip-backed event as a saved meeting using the current members without reinviting them.
- [ ] Promotion preserves the existing event, trip, participants, expenses, splits, and settlement output.
- [ ] The promoted meeting keeps the same `meetingId`, returns `meetingVisibility: saved`, and appears in saved meeting lists/Home `내 모임`.
- [ ] The promoted event/trip is no longer labeled `이번만 함께하기` in home/trip-derived view models.
- [ ] Non-owner users cannot promote and do not see the promotion CTA.
- [ ] Saved meeting-backed trips and invalid/missing trip IDs are rejected with clear errors.
- [ ] Generated OpenAPI Go/TS artifacts are up to date.

## API Changes

Add:

```text
POST /trips/{tripId}/meeting/promotion
```

Request:

```json
{
  "meetingName": "성수 저녁 모임"
}
```

Response:

```json
{
  "trip": { "...": "Trip" },
  "meeting": { "...": "Meeting" }
}
```

Error policy:

- `400`: invalid trip ID or invalid meeting name.
- `401`: missing/invalid auth.
- `403`: authenticated user is not the trip owner.
- `404`: trip is not found.
- `409`: trip is not backed by a linked one-off meeting, or the linked meeting was already promoted.

## DB / Data

No schema migration expected. Existing `meetings.visibility` supports the state transition.

Add SQL query:

- lock/target the trip's linked meeting through `events.trip_id`;
- require current `meetings.visibility = 'one_off'`;
- update `meetings.name`, `meetings.visibility = 'saved'`, `meetings.updated_at = now()`;
- return the updated meeting row.

`events.meeting_id` remains unchanged, so promotion is a transaction-safe metadata transition instead of a data copy.

## Mobile UX

- On `apps/mobile/app/trips/[tripId]/detail.tsx`, one-off owner trips show a saved-meeting promotion card under the participant list and before destructive actions.
- Default meeting name is the current trip/event name; user can edit it before saving.
- CTA copy:
  - title: `이 멤버로 모임 저장`
  - helper: `초대 없이 지금 참여자를 그대로 모임 멤버로 남겨요.`
  - input label: `모임 이름`
  - primary: `모임으로 저장하기`
- Non-owner users and saved meeting-backed trips do not show the card.
- On success, the local detail state updates from the API response and shows a short success message. Returning Home or focusing Home reloads saved meeting lists, so the meeting appears in `내 모임`.

## Test Plan

- Contract/source tests:
  - OpenAPI exposes `promoteTripMeeting`, request/response schemas, 409 mapping.
  - Mobile source contains promotion CTA/copy.
- API service tests:
  - validates auth, trip ID, and trimmed meeting name.
  - requires trip owner.
  - calls repository with trimmed name.
  - maps repository no-row promotion to conflict.
- API server tests:
  - successful handler maps request/response with saved meeting context.
  - forbidden/conflict/validation mappings.
- Storage DB tests:
  - one-off trip with accepted member and expense data promotes to same meeting ID with `saved` visibility.
  - trip/event/participant/expense/split counts and settlement output are preserved.
  - promoted meeting appears in `ListSavedMeetingsByMemberUser`.
- Mobile helper/state tests:
  - one-off owner CTA visibility.
  - non-owner/saved hidden states.
  - name validation/defaulting.
  - home view-model label changes from `이번만 함께하기` to meeting name after saved visibility.
- Full generated/API/mobile verification before PR.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/promote-meeting.test.mts lib/trips/home.test.mts lib/app-info/promote-one-off-meeting.test.mts` — passed.
- `cd apps/api && CGO_ENABLED=0 go test ./internal/trip ./internal/server -run 'TestServicePromoteMeeting|TestPromoteTripMeetingHandler' -count=1` — passed.
- `cd apps/api && DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run 'TestTripRepositoryPromoteOneOffMeetingPreservesEventLedgerAndSavedList' -count=1` — passed.
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

- Android: not run yet; no simulator/device session in this environment.
- iOS: not run yet; no simulator/device session in this environment.

## Open Questions

None blocking. Future meeting category/type persistence is deferred.
