# 0459 — Outing Event MVP

- Issue: #459
- Epic: #449
- Status: Implemented
- Date: 2026-08-23

## Goal

여행이 아닌 가벼운 약속/모임 일정을 만들고 열 수 있게 한다. outing은 저장 모임 또는 이번만 컨텍스트에 연결되며, 여행 전용 Day/숙소/항공편 UI 없이 일정 정보, 장소, 참여자만 보여준다.

## Scope

### In

- Expose `eventType = outing` in mobile creation.
- Add outing metadata to events: single date, optional local start time, optional place name/address, and category preset.
- Add saved-meeting participant subset selection to `CreateEventRequest.participantMemberIds` for existing saved meetings.
- Create `apps/mobile/app/events/new.tsx` and `apps/mobile/app/events/[eventId].tsx` for lightweight outing create/detail.
- Update Home empty/secondary actions and meeting detail event rows to open outing detail.
- Add tests for API contract/service/server/storage, mobile helpers/source, and route/typecheck gates.

### Out

- Recurring events.
- Calendar sync.
- Travel Day/숙소/항공편 planning for outings.
- Expense ledger/settlement UI for outing events.
- Full invite/member management inside outing detail.

## Product Policy

- `event_type = outing` represents a lightweight event shell, not a trip.
- `/trips/*` remains canonical for trip-specific behavior; outings use `/events/*`.
- Outings never show trip tabs (`오늘/일정/지도/장부/정산`) in this MVP.
- Existing saved meeting outing defaults to all meeting members if `participantMemberIds` is omitted; explicit array selects a subset and must include the current user.
- One-off and new saved outing creation includes only the creator/owner in this MVP.
- Category presets are `date`, `friends`, `meal`, `cafe`, `activity`, `custom`; category is optional and defaults to `custom` for new outings.

## Acceptance Criteria

- [ ] User can create an outing from Home without using the trip creation flow.
- [ ] Outing can be one-off, new saved meeting, or existing saved meeting-backed.
- [ ] Existing saved meeting outing can select participating meeting members.
- [ ] Outing detail shows title/date/time/category/place/meeting/participants without trip-only UI.
- [ ] Meeting detail rows for non-trip outings open `/events/{eventId}` instead of `준비 중`.
- [ ] Generated API artifacts, DB migration/schema/sqlc, and mobile typecheck/tests are up to date.

## API / DB

Add event fields:

- `startTime?: string | null` (`HH:mm`, local display time)
- `placeName?: string | null`
- `placeAddress?: string | null`
- `category?: EventCategory | null`

Extend `CreateEventRequest` with the same outing metadata and optional `participantMemberIds?: string[]`.

DB migration `00035_add_outing_event_metadata.sql` adds nullable event columns with checks:

- `start_time` nullable `HH:mm` text.
- `place_name`, `place_address` nullable length-limited text.
- `category` nullable preset text.

## Mobile UX

- Home empty and secondary create areas show `약속 만들기` alongside `여행 일정 만들기`.
- `/events/new` asks for title/date/time/category/place and meeting context.
- Existing saved meeting context exposes participant selection using current meeting members.
- `/events/{eventId}` shows a compact card with meeting, date/time, category, optional place, and participants.

## Test Plan

- API source/contract tests for outing metadata and routes.
- Meeting service/server tests for outing metadata and participant subset.
- Storage integration test for outing metadata, selected participants, and saved meeting detail visibility.
- Mobile helper tests for form payload/validation/category labels/detail view model.
- Mobile app-info source tests for Home/meeting/detail routing and no trip tabs in event detail.
- Full generated/API/mobile gates before PR.

## Verification Record

To be completed during implementation.

## Manual Smoke

- Android: not run yet; no simulator/device session in this environment.
- iOS: not run yet; no simulator/device session in this environment.
