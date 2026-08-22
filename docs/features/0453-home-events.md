# Feature Slice: 홈을 다가오는 일정·정산·내 모임 중심으로 개편

## Metadata

- GitHub Issue: #453
- Parent Epic: #449
- Status: Implemented
- Created: 2026-08-23
- Updated: 2026-08-23

## Source

- Issue: #453 — `[모임 전환] 홈을 다가오는 일정·정산·내 모임 중심으로 개편`
- IA source: `docs/features/0450-meeting-centered-ia.md`
- Trip/event link source: `docs/features/0452-trip-event-link.md`
- Mobile brand/design source: `docs/features/0341-chit-brand-design-system.md`
- Mobile design tokens: `apps/mobile/lib/design/theme.ts`

## Summary

Home becomes an event-first dashboard instead of a travel-list landing page. It shows the next/ongoing schedules first, then settlement attention, saved meetings, and past schedules. This slice uses existing APIs only: trip list, saved meeting list, and my settlement summary. It does not introduce new routes or event-first creation choices.

## Scope

### In

- Restructure Home into four product sections:
  1. `다가오는 일정` — ongoing and upcoming trip-backed events.
  2. `정산할 일` — non-zero settlement summaries from the current user's settlement summary API.
  3. `내 모임` — saved meetings only.
  4. `지난 일정` — past trip-backed events.
- Keep one-off trip events visible in `다가오는 일정` / `지난 일정` through `TripListItem.eventContext`.
- Keep one-off containers hidden from `내 모임`; Home additionally filters meeting list items to `visibility === 'saved'` as a safety guard.
- Show each trip card's meeting context as either the saved meeting name or `이번만 함께하기`.
- Update Home loading/empty/error copy to schedule/meeting language.
- Add mobile view-model and source guard tests.

### Out

- New API or DB changes.
- Meeting detail screen/navigation implementation (#455).
- Event-first creation picker (#454).
- Non-trip outing/date events (#459).
- Generalized expense/settlement event model (#460).
- Retiring `/trips/*` routes (#461).

## Decisions

- Home v1 is mobile-only and contract-compatible. It uses:
  - `GET /trips` for trip-backed event sections.
  - `GET /meetings` for saved meetings.
  - `GET /me/settlement-summary` for settlement attention.
- `GET /meetings` is expected to exclude one-off meetings, but the mobile view-model filters again to protect the UI contract.
- Meeting rows do not require a working detail route in this slice. They can be rendered as non-destructive informational rows until #455 owns meeting detail navigation.
- The Home CTA remains truthful to the current implementation: it links to `/trips/new` and labels the action as `여행 일정 만들기` until #454 introduces the Event-first creation flow.
- Past schedules are shown on Home rather than hidden behind My, so one-off trips do not disappear after completion.

## Acceptance Criteria

- [x] Home shows ongoing/upcoming schedules before secondary sections.
- [x] Home shows settlement-needed trips from the current user's settlement summary.
- [x] `내 모임` shows saved meetings only and hides one-off containers.
- [x] One-off trip events remain visible in upcoming/ongoing or past schedule sections.
- [x] Trip rows/cards show meeting context: saved meeting name or `이번만 함께하기`.
- [x] Empty/loading/error states use schedule/meeting language, not travel-list-only language.
- [x] Existing `/trips/*` navigation remains canonical for trip-backed event rows.

## API Changes

None.

## DB Changes

None.

## Mobile Changes

- Add a meeting API wrapper for `MeetingsService.listMeetings`.
- Extend `apps/mobile/lib/trips/home.ts` to build Home dashboard sections from trips, saved meetings, and settlement summary.
- Update `apps/mobile/app/index.tsx` to load trips, meetings, and settlement summary after auth and render the new sections.
- Reuse existing design tokens/components and add small Home-specific rows/cards only when needed.

## Test Plan

- Mobile view-model tests for:
  - upcoming/ongoing/past schedule grouping;
  - one-off trip visibility in schedule/history;
  - saved-only meeting filtering;
  - settlement attention section;
  - updated empty/loading/error copy.
- Mobile source guard test for Home IA labels/API wrappers/route compatibility.
- Mobile test/typecheck/lint/format/context-bound UI verification.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/home.test.mts lib/app-info/home-events-dashboard.test.mts` — passed.
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

None blocking. Future navigation and creation choices are owned by #454/#455.
