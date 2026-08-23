# 0460 — Event Ledger & Settlement Generalization

- Issue: #460
- Epic: #449
- Status: Implemented
- Date: 2026-08-23

## Goal

여행 전용 `trip_id` 장부/정산 모델을 일정(Event) 기준으로 일반화해 여행은 기존 Day/장소/일정표 anchor를 유지하고, outing은 단순 이벤트 지출/정산을 지원한다.

## MVP Scope

### In

- Add event-scoped expense storage using `expenses.event_id` and `event_participants`.
- Keep existing trip expense APIs and trip Day/place/schedule anchor behavior compatible.
- Add event-scoped APIs:
  - `GET /events/{eventId}/expenses`
  - `POST /events/{eventId}/expenses`
  - `GET /events/{eventId}/expenses/{expenseId}`
  - `PUT /events/{eventId}/expenses/{expenseId}`
  - `DELETE /events/{eventId}/expenses/{expenseId}`
  - `GET /events/{eventId}/settlement`
- Outing expenses use `anchorType = event`, optional title/memo/category/kind, and event participant payer/split IDs.
- Trip expenses are backfilled with their linked event ID where available, but `/trips/*` remains canonical for trip-specific UI.
- Mobile outing detail links to a lightweight event ledger screen with list/create/settlement summary.

### Out

- Receipt OCR/upload for outing expenses.
- Day/place/schedule anchors for outings.
- Group-wide cross-event settlement.
- Settlement completion/request history.

## Domain Policy

- `expenses.trip_id` remains required for trip-anchored rows and nullable for event-only outing rows.
- `expenses.event_id` identifies the canonical event ledger scope.
- Trip rows may have both `trip_id` and `event_id`; outing rows have `event_id` only.
- Trip payer/splits use `trip_participants`; outing payer/splits use `event_participants`.
- Snapshot display names remain authoritative when participant rows are removed.
- Event settlement uses the same currency math and split policy as trip settlement, scoped to one event.

## Acceptance Criteria

- [x] Existing trip expense CRUD and settlement tests pass unchanged.
- [x] Outing event expenses can be listed, created, read, updated, and deleted through event APIs.
- [x] Outing event settlement calculates balances/transfers from event participants and event expenses.
- [x] Event expense rows preserve payer/split display names when participants disappear.
- [x] Mobile outing detail can open event ledger/settlement without trip tabs.
- [x] Generated API/server/sqlc/TS artifacts are up to date.

## Migration Strategy

- Add nullable `event_id`, `payer_event_participant_id` to `expenses` and nullable `event_participant_id` to `expense_splits`.
- Backfill `expenses.event_id` from linked trip events where `events.trip_id = expenses.trip_id`.
- Relax `expenses.trip_id` to nullable and replace anchor constraints with event-aware checks.
- Add indexes for event list, event settlement, and event client mutation idempotency.

## Test Plan

- API service/server tests for event expense CRUD and event settlement.
- Storage integration test for outing expense lifecycle, settlement, and trip regression.
- Mobile helper/source tests for event ledger route and no trip tabs.
- Full generated/API/mobile/lint/format/harness gates.

## Manual Smoke

- Android: not run in this environment.
- iOS: not run in this environment.
