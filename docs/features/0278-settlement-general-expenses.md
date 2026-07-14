# Feature Slice: F-278 정산 탭 일반 지출 등록과 간결한 지출 내역

## Metadata

- GitHub Issue: not yet assigned
- Status: Approved for implementation
- Created: 2026-07-15
- Updated: 2026-07-15

## Goal

정산 탭에서 항공권, 숙소 예약금, 렌트비처럼 특정 장소에서 바로 발생하지 않았거나 여행 전에 결제한 지출을 자연스럽게 등록할 수 있게 한다.

사용자는 `결제일자`와 `관련 일정/여행일`을 별도로 입력한다. 결제일자는 실제 돈이 결제된 날짜이고, 관련 일정은 이 지출을 여행 안에서 어디에 보여줄지 정하는 선택 정보다.

정산 탭 지출 내역은 상용 비용/정산 앱처럼 row를 간결하게 보여주고, 자세한 메타데이터는 상세/편집 화면으로 보낸다.

## Product Decisions

- 사용자는 `여행 전체`, `Day`, `일정` 같은 anchor 타입을 직접 고르지 않는다.
- 정산 탭 등록 화면에서 관련 일정은 기본 선택 없음이다.
- 결제일자가 여행 기간 안이어도 자동으로 Day에 연결하지 않는다.
- 관련 일정/Day 선택이 저장 anchor를 결정한다.
- Today 지출 등록은 현장 빠른 등록이므로 결제일자 필드를 노출하지 않고 해당 TripDay 날짜를 결제일자로 저장한다.
- Today 지출 등록의 관련 일정 기본값은 “다음 장소”보다 “현재 도착한 장소”를 우선한다.
- 정산 탭 목록은 row별 긴 문장을 피하고, 섹션/칩/상세 화면으로 정보를 분산한다.

## Scope

### In

- Settlement-tab expense registration for trip-level, trip-day, and schedule-item expenses.
- Payment date calendar selection in settlement entry.
- Optional related Day/schedule selection in settlement entry.
- General expense title for no-place/no-schedule expenses.
- Today quick expense date fixed to the current route TripDay.
- Today quick expense default related schedule: latest arrived place, then current pending item, then no selection.
- Trip-level expense visibility in settlement expense history.
- Compact settlement expense rows.
- Copy change: `오늘로 돌아가기` -> `돌아가기`.

### Out

- User-selected expense category taxonomy.
- Receipt images/OCR.
- Multi-Day allocation for one lodging/rental expense.
- Payment confirmation or money transfer execution.
- Budget analytics.
- Full redesign of Day expense rows outside settlement.

## UX Requirements

### Settlement expense entry

Fields:

1. `지출명`
   - Required when no schedule item is selected.
   - Optional when a schedule item is selected; if blank, the selected schedule/place title can be used as display fallback.
2. `결제일자`
   - Required.
   - Calendar-based selection.
   - Can be outside the trip date range.
   - Does not auto-select related Day.
3. `관련 일정`
   - Optional.
   - Default: no selection.
   - Day dropdown/filter on the left.
   - Schedule dropdown/list on the right.
   - If no Day is selected, the schedule list shows all trip schedule items with Day/date/time context.
   - If a Day is selected, the schedule list shows only that Day's items.
   - Selecting a Day without selecting a schedule item is valid.
4. Existing fields:
   - amount
   - payer
   - split policy
   - split participants/manual split
   - memo

Save mapping:

| User input | Stored anchor |
|---|---|
| Related schedule selected | `schedule_item` |
| Related Day selected, no schedule | `trip_day` |
| No related context selected | `trip` |

`expenseDate` always stores the selected payment date and is independent from anchor.

### Today quick expense

- Hide payment date.
- Store `expenseDate` as the route/current TripDay date.
- Related schedule selector shows only today's schedule items.
- Initial related schedule:
  1. latest arrived place-backed schedule item in today's items;
  2. otherwise current pending schedule item;
  3. otherwise no selection.
- User can still change the related schedule within today's schedule list.

### Settlement expense history

Use commercial-app style compact rows:

- Section/chip level carries context:
  - `여행 전체`
  - `Day 1`
  - `Day 2`
  - ...
- Section header carries count/total where practical.
- Row shows only:
  - icon/category marker derived from place type or fallback;
  - title;
  - amount;
  - one short meta line: payer + split count + conditional payment date.
- Do not render full split amounts, memo, or full related schedule metadata inside the row.
- Row tap opens the existing edit/detail flow where full detail can be shown.

## API Changes

### Add general create endpoint

```text
POST /trips/{tripId}/expenses
```

Request fields:

- `title: string | null`
- `expenseDate: date`
- `tripDayId: string | null`
- `scheduleItemId: string | null`
- `amountMinor: integer`
- `payerParticipantId: string`
- `splitPolicy: equal | manual`
- `participantIds?: string[]`
- `splits?: ManualExpenseSplitInput[]`
- `memo: string | null`

Rules:

- If `scheduleItemId` is present, validate it belongs to the trip. Derive `tripDayId` from the schedule item if needed.
- If `scheduleItemId` is absent and `tripDayId` is present, validate the Day belongs to the trip and require non-empty title.
- If both are absent, create a trip-level expense and require non-empty title.
- `expenseDate` can be outside the trip range.
- Currency remains the trip default at creation time.

### Extend existing schemas

- Add nullable `title` to `Expense`.
- Add nullable `title` to `UpdateExpenseRequest` so edit screens can preserve/edit general expense titles.
- Extend `ListTripExpensesResponse` with `tripExpenses` for trip-level expenses while keeping `days` for Day/schedule expenses.

## DB Changes

Add migration:

```text
expenses.title text null
```

Constraint:

- `title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 120`

Existing fields remain authoritative:

- `anchor_type`
- `trip_day_id`
- `schedule_item_id`
- `expense_date`
- split rows

## Acceptance Criteria

- [ ] AC-01: Settlement entry separates payment date from related Day/schedule context.
- [ ] AC-02: Settlement entry does not default-select a related Day or schedule.
- [ ] AC-03: Settlement entry can create trip-level expenses when no related context is selected.
- [ ] AC-04: Settlement entry can create Day-level expenses when only a Day is selected.
- [ ] AC-05: Settlement entry can create schedule-item expenses when a schedule is selected.
- [ ] AC-06: Payment date can be outside the trip range.
- [ ] AC-07: Today quick expense stores the current TripDay date without showing a payment-date field.
- [ ] AC-08: Today quick expense defaults to latest arrived place, then pending item, then no selection.
- [ ] AC-09: Today quick expense selector is limited to today's schedule items.
- [ ] AC-10: `오늘로 돌아가기` copy is replaced with `돌아가기`.
- [ ] AC-11: Trip-level expenses appear in settlement history under `여행 전체`.
- [ ] AC-12: Settlement history rows are compact and avoid dense inline metadata.
- [ ] AC-13: Settlement calculations include trip-level, Day-level, and schedule-item expenses.
- [ ] AC-14: API/mobile tests cover the new creation and display behavior.

## Regression Test Plan

| Behavior | Layer | Command |
|---|---|---|
| OpenAPI create/list/update schemas generate correctly | Contract | `pnpm verify:generated` |
| Create trip/day/schedule general expense and validate anchors | API service/handler | `pnpm --filter @i-um/api test` |
| `expenses.title` migration and storage mapping | API DB/storage | `pnpm --filter @i-um/api test` |
| Trip-level expenses appear in trip expense list but settlement still includes all anchors | API storage/service | `pnpm --filter @i-um/api test` |
| Settlement entry request builder maps no context/Day/schedule correctly | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Today default related schedule picks latest arrived item before pending item | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Settlement rows use compact metadata and trip-level section | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Route/controller/screens compile | Mobile typecheck | `pnpm --filter @i-um/mobile typecheck` |

## Open Questions

None for this slice.

## Follow-up Issues

- User-selected expense categories/icons.
- Multi-Day allocation for lodging/rental expenses.
- Receipt/attachment support for expenses.
- Rich filters/sorting for settlement expense history.
