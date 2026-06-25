# Feature Slice: F-050 장소별 지출 연결

## Metadata

- GitHub Issue: #50
- Status: Implemented (pending manual smoke)
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #50 — [[Feature Slice] F-050 장소별 지출 연결](https://github.com/twotwobread/i-um/issues/50)
- Covered by: #47 / `docs/features/0047-quick-expense-create.md`
- Ouroboros/PM/Seed: Interview `interview_20260625_140833`, Seed `seed_2a8693507220` (MCP generated; file path not provided)
- Ambiguity Score: `0.068`
- Notes:
  - User clarified that F-050's functional scope is already implemented by F-047 quick expense.
  - F-050 must not introduce new product, API, DB, or mobile production behavior.
  - This document records the overlap, verification plan, and issue cleanup criteria for closing F-050 as covered by F-047 after verification.
  - Current implementation uses `itineraryItemId` / itinerary item occurrence as the primary context and derives `tripPlaceId` plus the place snapshot from that item.
  - #95 time-based active schedule item selection is future scope; F-050 verifies the current order/progress-based behavior only.

## Goal

지출이 특정 일정 항목의 장소와 연결되는 기능이 F-047 빠른 지출 등록 흐름에서 이미 제공됨을 명확히 기록한다.

F-050은 신규 구현 slice가 아니라, 기존 quick expense가 지출을 `itineraryItemId`에 연결하고 서버가 `tripPlaceId`와 장소 snapshot을 파생 저장하는 동작을 확인하고 검증 완료 후 이슈를 `covered by F-047`로 정리하기 위한 문서/검증 slice다.

## User Flow

### Today in-progress current item

1. 사용자가 로그인한 상태로 Today 화면(`/`)을 연다.
2. 앱은 오늘 일정에서 첫 번째 pending itinerary item을 현재/다음 장소로 표시한다.
3. 사용자가 `지출 등록`을 누른다.
4. 앱은 `/trips/{tripId}/days/{date}/expenses/quick?itemId={itineraryItemId}`로 이동한다.
5. 빠른 지출 화면은 route의 `itemId`가 오늘 itinerary에 존재하면 해당 항목을 지출 연결 대상 장소로 선택한다.
6. 사용자는 금액과 결제자를 입력/선택하고 저장한다.
7. 서버는 요청의 `itineraryItemId`를 검증한 뒤, 그 itinerary item에서 `tripPlaceId`, 장소명, 주소, 장소 타입을 파생해 expense에 저장한다.

### Current item unavailable / completed day fallback

1. 오늘 일정이 모두 완료되어 현재 pending item이 없거나 quick expense route에 유효한 `itemId`가 없으면, 빠른 지출 화면은 현재 장소를 확정하지 않는다.
2. 앱은 오늘 itinerary item 목록에서 지출을 연결할 장소를 직접 선택하도록 요구한다.
3. 사용자가 오늘 일정 항목 하나를 선택하고 금액/결제자를 입력하면 저장할 수 있다.
4. 서버는 클라이언트가 선택한 `itineraryItemId`가 요청 `tripId`/`date`에 속하는지 다시 검증한다.

### Repeated place / lodging return

1. 같은 `tripPlace`가 하루 일정에 여러 번 등장하거나, 사용자가 중간에 숙소로 돌아오는 일정이 있을 수 있다.
2. 지출 연결의 기준은 raw place가 아니라 itinerary item occurrence다.
3. 사용자가 선택하거나 Today가 전달한 특정 `itineraryItemId`가 expense의 primary source context로 저장된다.
4. 서버는 그 item에서 `tripPlaceId`를 파생하므로 장소 단위 조회/집계가 가능하면서도, 같은 장소의 여러 방문 중 어느 일정 항목에서 발생한 지출인지 구분할 수 있다.

## Scope

- App UI: No new UI
  - Existing covered Today entry: `apps/mobile/app/index.tsx`
  - Existing covered quick expense route: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Existing helper: `apps/mobile/lib/trips/quick-expense.ts`
  - Existing Today helper: `apps/mobile/lib/trips/today-execution.ts`
- API Contract: No API changes
  - Existing covered endpoint: `POST /trips/{tripId}/days/{date}/expenses/quick`
  - Existing request field: `itineraryItemId`
  - Existing response fields: `expense.itineraryItemId`, `expense.tripPlaceId`, `expense.place`
- API Server: No server changes
  - Existing covered handler/service/repository validate the submitted itinerary item and create the expense in the quick expense transaction.
- DB: No DB changes
  - Existing `expenses.itinerary_item_id`, `expenses.trip_place_id`, and `expenses.place_*` snapshot columns are owned by F-047.
- Tests: Verification only
  - Existing F-047 coverage was confirmed for route item selection, fallback chooser, request payload, handler response, and linked place snapshot.
  - Added test-only regression hardening for repeated same-place itinerary occurrences in API handler and mobile helper tests.
  - No F-050 production behavior is added.
- Deploy/Smoke: Needed before closing #50
  - Close #50 only after automated checks and manual smoke for the linked-place flows are confirmed.

## Out of Scope

- New quick expense API endpoint or request/response schema changes.
- New DB tables, migrations, constraints, generated sqlc code, or generated OpenAPI code.
- Server-side inference of the current itinerary item when `itineraryItemId` is omitted.
- Saving a quick expense without an itinerary item/place link.
- Expense list, expense detail, edit, delete, receipt/image attachment, memo/category input.
- Place-level expense list/summary UI such as “이 장소에서 쓴 지출”.
- Settlement summary, custom split ratios, excluding participants, or payment transfer.
- #95 optional schedule time/timeline implementation or time-window-based active schedule item selection.
- Mobile UI/E2E test harness expansion unless handled as a separate follow-up.

## Requirements

### UI / UX

No new UI requirements are added by F-050.

Existing F-047 behavior to verify:

- Today screen: `apps/mobile/app/index.tsx`
  - In-progress state exposes `지출 등록` for the current/next itinerary item.
  - The route includes `?itemId={itemId}` when a current item exists.
  - Completed state may expose `지출 등록` without `itemId`; this intentionally opens the explicit chooser fallback.
- Quick expense screen: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Route params: `tripId`, `date`, optional `itemId`.
  - If `itemId` is present and belongs to the loaded day itinerary, it becomes the selected linked item.
  - If `itemId` is absent or invalid, the screen requires selection from today's itinerary items.
  - Saving is blocked with `지출을 연결할 장소를 선택해주세요.` when no item is selected.
  - The chooser is limited to items returned by `GET /trips/{tripId}/days/{date}/itinerary` for the route date.

### API Contract

No API changes.

Existing covered endpoint:

```text
POST /trips/{tripId}/days/{date}/expenses/quick
```

Existing `CreateQuickExpenseRequest` fields:

- `itineraryItemId` — required. The selected itinerary item for the requested `tripId`/`date`.
- `amountMinor` — required positive integer minor-unit amount.
- `payerParticipantId` — required trip participant who paid.

Existing `Expense` response fields relevant to F-050:

- `itineraryItemId` — nullable in schema for historical preservation after deletes, present at creation.
- `tripPlaceId` — nullable in schema for historical preservation after deletes, present at creation.
- `place.name`
- `place.address`
- `place.placeType`

The request must not accept `tripPlaceId` or place snapshot fields directly. The server derives them from `itineraryItemId`.

### DB Changes

No DB changes.

Existing F-047 migration: `apps/api/migrations/00011_create_expenses.sql`

Existing `expenses` fields relevant to F-050:

- `itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL`
- `trip_place_id uuid REFERENCES trip_places(id) ON DELETE SET NULL`
- `place_name text NOT NULL`
- `place_address text NOT NULL`
- `place_type text NOT NULL`

Existing indexes relevant to F-050:

- `expenses_trip_itinerary_item_idx` on `(trip_id, itinerary_item_id)` where `itinerary_item_id IS NOT NULL`
- `expenses_trip_place_idx` on `(trip_id, trip_place_id)` where `trip_place_id IS NOT NULL`

### Business Rules

- The primary link for a quick expense is the submitted itinerary item occurrence, not only the raw place.
- `itineraryItemId` must belong to the requested `tripId` and `date`.
- The server derives `tripPlaceId`, `place_name`, `place_address`, and `place_type` by joining the itinerary item to `trip_places`.
- The server must reject a missing, invalid, out-of-trip, or out-of-day itinerary item instead of creating an unlinked expense.
- The mobile app may infer and preselect the current item, but the server still validates the submitted id.
- If no current item is confidently available, the user must explicitly choose from today's itinerary items.
- Same-place repeat visits and lodging returns are distinguished by `itineraryItemId`; `tripPlaceId` remains available for future place-level grouping.
- Future #95 behavior may prefer an active timed schedule item, then fall back to order/progress or explicit selection. That future behavior is not implemented or specified by F-050.

## Acceptance Criteria

- [ ] AC-01: This feature spec and verification plan exist at `docs/features/0050-link-expense-to-place.md`.
- [ ] AC-02: The spec states that F-050 has no new implementation scope and is functionally covered by F-047 quick expense.
- [ ] AC-03: Existing OpenAPI contract requires `itineraryItemId` in `CreateQuickExpenseRequest` and returns `itineraryItemId`, `tripPlaceId`, and `place` snapshot fields in `Expense`.
- [ ] AC-04: Existing DB schema stores `expenses.itinerary_item_id`, `expenses.trip_place_id`, and denormalized `place_name`/`place_address`/`place_type` snapshot fields.
- [ ] AC-05: Existing server flow validates the submitted itinerary item for `tripId`/`date` and derives `tripPlaceId` plus place snapshot from that item.
- [ ] AC-06: Existing Today in-progress flow opens quick expense with `?itemId={currentItemId}` when a current/next itinerary item is available.
- [ ] AC-07: Existing completed/no-current-item flow can open quick expense without `itemId` and requires explicit selection from today's itinerary items before saving.
- [ ] AC-08: Existing mobile request builder blocks save without a selected item and sends `itineraryItemId` when valid.
- [ ] AC-09: Verification includes the repeated-place/lodging-return scenario: the expense is linked to the exact itinerary item occurrence, while `tripPlaceId` remains derived for place-level grouping.
- [ ] AC-10: #95 time-window active schedule item selection and place-level expense list/summary are explicitly out of scope or follow-up.
- [ ] AC-11: #50 is not closed until AC-03 through AC-09 are confirmed by automated checks, manual smoke, or documented regression gaps/follow-ups.
- [ ] AC-12: After verification, #50 is commented/closed as covered by #47 with no new product/API/DB/mobile behavior.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI requires `itineraryItemId` and returns linked expense fields | Contract/generated | `packages/api-contract/openapi.yaml`, generated outputs | `pnpm verify:generated` |
| Handler response returns matching `itineraryItemId`, derived `tripPlaceId`, and place snapshot | API handler | `apps/api/internal/server/server_test.go` (`TestCreateQuickExpenseHandler`) | `pnpm --filter @i-um/api test` |
| Service validates auth, date range, item id format, and delegates the selected `itineraryItemId` to the repository | API service | `apps/api/internal/trip/service_test.go` (`TestServiceCreateQuickExpense*`) | `pnpm --filter @i-um/api test` |
| Repository SQL derives item/place from `itinerary_items` joined to `trip_places` and inserts expense link/snapshot | DB/query review + generated check | `apps/api/queries/expenses.sql`, generated sqlc outputs | `pnpm verify:generated` |
| Today in-progress action opens quick expense with `?itemId={nextItem.id}` | Mobile helper | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Completed day action opens quick expense without `itemId`, intentionally triggering chooser fallback | Mobile helper | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Quick expense fallback requires item selection and limits options to today's itinerary items | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Quick expense request builder sends `itineraryItemId` and blocks missing item with Korean validation copy | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Same `tripPlaceId` represented by multiple itinerary item occurrences links expense to the selected occurrence | API handler + mobile helper | `apps/api/internal/server/server_test.go` (`TestCreateQuickExpenseLinksRepeatedPlaceByItineraryItemOccurrence`), `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/mobile test` |
| Quick expense route compiles with optional `itemId`, chooser state, and request payload types | Mobile typecheck | `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx` | `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- React Native route-level interaction for tapping the linked-place chooser is not covered by an automated UI/E2E test in F-050.
  - Risk: helper/API tests could pass while a future UI refactor breaks visible item selection.
  - Follow-up: if this risk becomes unacceptable, create a separate mobile UI/E2E hardening issue instead of expanding F-050.
- Repository transaction behavior is verified through SQL review/generated checks, handler/service tests, and the new repeated-place handler regression, but not a dedicated DB integration test named for repeated-place linking.
  - Risk: lower-level SQL drift might be caught later than a focused repository regression would catch it.
  - Follow-up: add a targeted repository/integration regression if the project adds a standard DB test harness for expense flows.

## TDD Implementation Plan

F-050 has no new production implementation. The implementation phase is verification-centered and adds test-only regression hardening for the repeated-place occurrence that motivated the issue.

1. Red: Add or confirm linked-place regression tests.
   - Confirm existing OpenAPI and generated types expose the required request/response fields.
   - Confirm existing API tests cover response `itineraryItemId`, derived `tripPlaceId`, and place snapshot.
   - Confirm existing mobile helper tests cover Today `itemId` routing and explicit chooser fallback.
   - Add a failing API handler regression for two itinerary item occurrences sharing one `tripPlaceId`, then saving an expense for the second occurrence.
   - Add a failing mobile helper regression that keeps repeated same-place occurrences selectable by distinct itinerary item ids.
   - Verify: `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/mobile test`
2. Green: Keep existing production behavior and satisfy the new regressions.
   - No OpenAPI, migration, generated code, server production code, or mobile production UI changes.
   - Existing implementation already stores the submitted `itineraryItemId` and derives `tripPlaceId`/place snapshot.
   - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/mobile typecheck`
3. Refactor: Documentation and issue cleanup only.
   - Keep F-047 as the source of truth for quick expense creation behavior.
   - Keep this F-050 spec as the source of truth for why the place-linking issue is covered.
   - Comment on #50 that “장소별 지출 연결” is covered by #47 and link to this spec plus verification evidence.
   - Close #50 only after automated checks and manual smoke/gap decisions are recorded.
4. Gate: Final verification before #50 closure.
   - `pnpm install --frozen-lockfile`
   - `pnpm verify:generated`
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - Manual smoke checklist below

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: Pass (prepared worktree dependencies after first mobile test attempt found missing `node_modules`).
- `pnpm verify:generated`: Pass.
- `pnpm --filter @i-um/api test`: Pass.
- `pnpm --filter @i-um/api build`: Pass.
- `pnpm --filter @i-um/mobile test`: Pass.
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm --filter @i-um/api format:check`: Pass.
- `pnpm --filter @i-um/mobile format:check`: Pass.

### Manual Smoke

Before closing #50:

- Today in-progress linked-place save:
  - Open Today with a trip/day that has a pending itinerary item.
  - Tap `지출 등록` from the current/next place state.
  - Confirm quick expense opens with the current place already selected and no required item chooser blocking save.
  - Enter amount and payer, save successfully.
  - Expected: saved expense response includes the selected `itineraryItemId`, its derived `tripPlaceId`, and place snapshot.
- Completed day fallback chooser:
  - Mark all today itinerary items arrived, or use a completed day state.
  - Tap `지출 등록`.
  - Confirm quick expense opens without route `itemId` and requires selecting from today's itinerary items.
  - Select an item, enter amount/payer, save successfully.
  - Expected: saved expense links to the explicitly selected item.
- Repeated same-place or lodging return:
  - Prepare a day where the same place/lodging is represented by two itinerary item occurrences.
  - Save one quick expense from or for the second occurrence.
  - Expected: expense `itineraryItemId` is the second occurrence; `tripPlaceId` is the shared/derived place; place snapshot matches the selected occurrence's place.
- Invalid/outdated item:
  - Attempt save with an item id that no longer belongs to the requested day, or remove the item before submit.
  - Expected: server rejects the request and mobile shows the existing reload/error copy.

Current status: Not run for this implementation pass.

## Issue / Document Cleanup Plan

1. Keep `docs/features/0047-quick-expense-create.md` as the implementation source of truth for quick expense creation.
2. Use this F-050 spec to document the issue overlap, exact linking semantics, and closure criteria.
3. After automated checks and manual smoke pass, add a GitHub comment to #50:
   - state that “지출이 현재 일정 장소와 자동 연결된다” is covered by F-047 quick expense;
   - link #47 and `docs/features/0047-quick-expense-create.md`;
   - summarize verification evidence for `itineraryItemId`, `tripPlaceId`, place snapshot, Today auto item route, fallback chooser, and repeated-place occurrence;
   - state that no new F-050 production implementation was needed.
4. Close #50 as `covered by #47` / duplicate after verification evidence is available.
5. If verification fails because existing behavior is missing, do not close #50; record the failing behavior and create a concrete follow-up issue instead of expanding this covered-by spec.

## Release Notes

- No user-facing release note for F-050 itself.
- User-facing behavior is already described by F-047: 빠른 지출 등록에서 현재/선택한 일정 장소에 지출을 연결해 저장할 수 있다.

## Open Questions

- None for the current no-new-implementation decision.

## Follow-up Issues

- #95: optional schedule item time/timeline; future quick expense may prefer active timed schedule item before order/progress fallback.
- Future place-level expense list/summary if users need to view all expenses for a specific place.
- Optional mobile UI/E2E hardening for quick expense item chooser interaction if manual smoke is not considered sufficient long-term regression coverage.
- Optional dedicated DB repository/integration regression for repeated same-place itinerary occurrences if handler-level coverage is not considered sufficient long-term.
