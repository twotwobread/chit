# Feature Slice: F-096 숙소 장소 별도 등록/선택

## Metadata

- GitHub Issue: #96
- Status: Implemented
- Created: 2026-06-30
- Updated: 2026-06-30

## Source

- Issue: #96 — [[Feature Slice] F-096 숙소 장소 별도 등록/선택](https://github.com/twotwobread/i-um/issues/96)
- Related implemented spec: `docs/features/0030-set-lodging-place.md`
- Notes:
  - F-030 already stores Day lodging as a `TripPlace` reference.
  - This slice lets users select/register a lodging `TripPlace` without adding a Day schedule row.
  - Google Places-based lodging search is intentionally out of this PR unless separately prioritized.

## Goal

사용자는 Day 방문 일정 row에 숙소를 억지로 추가하지 않아도, Day 숙소 지정 흐름에서 기존 여행 장소를 선택하거나 숙소 장소를 직접 등록해 해당 Day lodging target으로 지정할 수 있다.

## Product Model

```text
TripPlace = 장소 스냅샷. 숙소도 TripPlace로 저장된다.
ScheduleItem = 특정 Day 방문 일정 row. 숙소 등록/선택 시 자동 생성하지 않는다.
DayLodging = 특정 Day의 숙박/복귀 target. TripPlace를 참조한다.
```

## User Flow

### Existing trip place selection

1. 사용자가 Day 상세 화면을 연다.
2. 앱은 Day lodging panel을 보여준다.
3. 사용자가 `기존 장소에서 선택`을 누른다.
4. 앱은 여행에 저장된 `trip_places` 목록을 불러온다.
5. 사용자가 장소 하나를 선택한다.
6. 앱은 기존 `PUT /trips/{tripId}/days/{tripDayId}/lodging-place`에 `tripPlaceId`를 보내 Day lodging target을 지정한다.
7. 성공 후 Day 상세를 다시 불러와 현재 숙소와 row badge/action을 최신화한다.

### Manual lodging registration

1. 사용자가 Day lodging panel에서 `숙소 직접 등록`을 누른다.
2. 사용자는 숙소명과 주소를 입력한다.
3. 앱은 `POST /trips/{tripId}/days/{tripDayId}/lodging-place/manual`을 호출한다.
4. 서버는 `trip_places`에 `placeType=lodging`, `provider=manual` 장소를 생성하고 해당 Day lodging target으로 저장한다.
5. 서버는 schedule item을 생성하지 않는다.
6. 성공 후 Day 상세를 다시 불러와 현재 숙소를 표시한다.

### Clear lodging

- 기존 F-030 `DELETE /trips/{tripId}/days/{tripDayId}/lodging-place`를 Day lodging panel에서도 사용할 수 있다.
- 기존 row 기반 `숙소 해제` action은 호환성 유지 범위로 남긴다.

## Scope

- App UI: Yes
  - Day 상세 화면에 current lodging panel, existing-place selection list, manual lodging registration form, clear action.
- API Contract: Yes
  - Existing trip place list endpoint.
  - Manual lodging create-and-set endpoint.
- API Server: Yes
  - Auth/participant/date validation, same-trip place listing, manual lodging place create+set.
- DB: No migration planned.
  - Reuse `trip_places` and `trip_days.lodging_trip_place_id`.
- Generated Code: Yes.
- Tests: API service/storage/server and mobile helper/typecheck/regression tests.
- Deploy/Smoke: Internal/staging smoke should be done before release when available.

## Out of Scope

- Google Places lodging search/register flow.
- Lodging navigation, route preview, or current-location origin logic.
- Creating, deleting, or reordering schedule items while selecting/registering lodging.
- Global trip place management screen.
- Booking/check-in/check-out metadata, phone, reservation number, price, settlement linkage.
- Fuzzy duplicate detection or manual-vs-Google merge.

## Requirements

### UI / UX

- Day lodging panel appears on Day detail even when there are no schedule rows.
- Current lodging state:
  - Shows `숙소` label, place name, and address when `day.lodgingPlace` exists.
  - Shows empty helper `이 Day에 지정된 숙소가 없어요.` when absent.
- Actions:
  - `기존 장소에서 선택`
  - `숙소 직접 등록`
  - `숙소 해제` when current lodging exists.
- Existing place selection:
  - Lists trip-level places returned by API.
  - Includes places not shown in the current Day itinerary.
  - Selecting one calls existing set lodging endpoint.
  - Empty list copy: `선택할 수 있는 장소가 없어요. 숙소를 직접 등록해 주세요.`
- Manual registration:
  - Fields: `숙소명`, `주소`.
  - Server/client stores `placeType=lodging`.
  - Validation:
    - name required, max 120 characters.
    - address required, max 300 characters.
  - Save copy: `숙소 등록`
  - Saving copy: `숙소 등록 중...`
- Loading/error states:
  - Existing place list loading: `장소를 불러오는 중...`
  - Mutation generic error: `숙소 정보를 저장할 수 없어요.` / `잠시 후 다시 시도해주세요.`
  - Existing Day not-found/auth behavior remains unchanged.
- Compatibility:
  - Existing row-level `숙소로 지정` / `숙소 해제` actions from F-030 remain usable.
  - Existing Day lodging summary and row badges update after refetch.

### API Contract

#### List existing trip places

```text
GET /trips/{tripId}/places
```

Response schema: `ListTripPlacesResponse`

```json
{
  "places": [
    {
      "id": "...",
      "name": "호텔 니코 오사카",
      "placeType": "lodging",
      "address": "Nishi-Shinsaibashi",
      "routablePlace": null
    }
  ]
}
```

Rules:

- Requires authenticated current trip participant.
- Missing trip: `404`.
- Non-current participant: `403`.
- Order: server stable order by `created_at ASC, id ASC`.
- Includes manual and Google-backed trip places.
- Does not create or modify schedule items.

#### Create manual lodging place and set Day lodging

```text
POST /trips/{tripId}/days/{tripDayId}/lodging-place/manual
```

Request schema: `CreateManualDayLodgingPlaceRequest`

```json
{
  "name": "호텔 니코 오사카",
  "address": "Nishi-Shinsaibashi"
}
```

Response: `SetDayLodgingPlaceResponse`.

Rules:

- Requires authenticated current trip participant.
- `tripDayId` follows existing Day lodging path semantics.
- `name`: trim, 1..120 chars.
- `address`: trim, 1..300 chars.
- Server creates `trip_places` row with:
  - `provider=manual`
  - `place_type=lodging`
  - `name/address` from normalized request
- Server sets `trip_days.lodging_trip_place_id` for the target Day.
- Server must not create a `schedule_items` row.
- Duplicate manual lodging places are allowed in v1; no fuzzy merge.

### DB

No migration planned.

- Reuse existing `trip_places` columns and constraints.
- Reuse existing `trip_days.lodging_trip_place_id` same-trip FK.

### Business Rules

- A lodging place can exist only as a trip place and not appear in Day schedule rows.
- Day lodging target is one place at a time; setting another place replaces the previous one.
- Existing places can be any `TripPlaceType`; the user may choose a non-lodging historical place as lodging if desired.
- Manual lodging registration always creates `placeType=lodging`.
- No Google Places lodging flow in this PR.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0096-lodging-place-register-select.md`.
- [x] AC-02: Spec is reviewed and approved before implementation starts.
- [x] AC-03: Day lodging UI can choose from existing trip places not necessarily present in the Day schedule list.
- [x] AC-04: Manual lodging registration creates a `trip_places` row and sets Day lodging.
- [x] AC-05: Manual lodging registration does not create a `schedule_items` row.
- [x] AC-06: Selecting an existing trip place sets that Day lodging target using F-030 persistence.
- [x] AC-07: Clearing lodging remains available and existing row-based lodging actions keep working.
- [x] AC-08: API contract/server/generated code/mobile UI/regression tests are updated as a vertical slice.
- [x] AC-09: No Google Places lodging search, lodging navigation, route preview, or schedule-item auto creation is introduced.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Contract/generated clients | Contract | OpenAPI generation | `pnpm generate && pnpm verify:generated` |
| Trip place list and manual create+set | API storage/service/server | `apps/api/internal/{trip,storage,server}` tests | `pnpm --filter @i-um/api test` |
| No schedule item auto-create | API storage/server | repository/handler tests | `pnpm --filter @i-um/api test` |
| Lodging panel view model/form validation | Mobile helper | `apps/mobile/lib/trips/lodging-place.test.mts` | `pnpm --filter @i-um/mobile test` |
| Day UI type integration | Mobile | typecheck | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full device/internal build smoke may be unavailable in this implementation session.
- If not run, release should smoke Day lodging panel selection/manual registration on device/internal build before rollout.

## TDD Implementation Plan

1. Red API tests:
   - List trip places for authenticated participant.
   - Manual lodging create+set returns lodging response and creates no schedule item.
   - Validation/auth/forbidden/not-found cases.
2. Green API implementation:
   - OpenAPI endpoints/schemas + generation.
   - Service/repository/handler methods and mapping.
3. Red mobile tests:
   - Lodging panel VM/form validation/request building.
   - Existing-place list states.
4. Green mobile implementation:
   - Day view model includes current lodging.
   - Day detail lodging panel with selection/manual forms and refetch-on-success.
5. Final gates and docs.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run in this session; device/internal build smoke remains recommended before rollout.

## Release Notes

- Day lodging can now be selected from existing trip places or registered manually without adding a schedule row.
