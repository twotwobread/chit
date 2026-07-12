# TripPlaceType Category Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `TripPlaceType` the single place-backed schedule category model, add `transport`, remove non-place schedule items, and centralize provider raw-type mapping in API static maps.

**Architecture:** The API owns provider raw type mapping and persists only internal `TripPlaceType` values. Schedule items become place-backed only; mobile creation requires a selected Google place and place editing remains the only category correction path. Generated OpenAPI/sqlc artifacts are refreshed after contract, DB, and query changes.

**Tech Stack:** Go API, PostgreSQL/goose/sqlc, OpenAPI/oapi-codegen/openapi-typescript-codegen, Expo/React Native TypeScript, pnpm.

## Global Constraints

- Use a code-owned static map, not DB/config-driven runtime mapping.
- Map provider `primaryType` first, then `types[]`, then fallback to `etc`.
- Add `transport` to `TripPlaceType` with Korean label `교통`.
- Schedule creation requires a selected Google place.
- Category edits happen only in the existing place edit flow.
- Existing Google trip places keep their stored `placeType`; do not remap when re-adding.
- Remove non-place schedule creation/editing/API/DB support; no production non-place data preservation is required.

---

## File Structure

- `packages/api-contract/openapi.yaml`: source-of-truth API schema. Add `transport`, remove non-place schemas/endpoints/fields, optionally expose mapped search result `placeType`.
- `apps/api/migrations/00022_unify_schedule_place_types.sql`: DB migration adding `transport` and dropping non-place schedule columns/checks.
- `apps/api/schema.sql`: generated/applied schema snapshot after migration.
- `apps/api/internal/place/provider_place_type_mapping.go`: new provider-aware static raw type mapper.
- `apps/api/internal/place/service.go`: call the mapper instead of direct Google switch logic.
- `apps/api/internal/place/service_test.go`: mapper and creation behavior tests.
- `apps/api/internal/trip/types.go`, `apps/api/internal/trip/service.go`: remove non-place domain types/service branches and allow `transport` place type.
- `apps/api/internal/server/trip_handlers.go`, `apps/api/internal/server/mappers.go`: remove non-place handler/mapping paths.
- `apps/api/internal/storage/trip_repository.go`: remove non-place persistence and row mapping branches.
- `apps/api/queries/trips.sql`: remove non-place selected columns and mutations.
- `packages/api-contract/gen/ts/**`, `apps/api/internal/openapi/server.gen.go`, `apps/api/internal/db/**`: regenerated artifacts.
- `apps/mobile/lib/design/theme.ts`: add `transport` label/color.
- `apps/mobile/lib/trips/manual-place.ts`: include `transport` in edit options.
- `apps/mobile/lib/places/place-schedule-detail.ts`: remove non-place form state/validation and require selected place.
- `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx`: remove non-place UI and API call.
- `apps/mobile/lib/trips/day-itinerary.ts`, `apps/mobile/lib/trip-ui/*`, `apps/mobile/lib/trips/quick-expense.ts`, `apps/mobile/lib/trips/today-execution.ts`: remove non-place branches and simplify to place-backed schedule items.
- Relevant `*.test.mts` and Go tests: update expectations.

---

### Task 1: Contract and DB shape

**Files:**
- Modify: `packages/api-contract/openapi.yaml`
- Create: `apps/api/migrations/00022_unify_schedule_place_types.sql`
- Modify: `apps/api/schema.sql`
- Generated after implementation: `apps/api/internal/openapi/server.gen.go`, `packages/api-contract/gen/ts/**`

**Interfaces:**
- Produces: `TripPlaceType` enum with `transport`.
- Produces: place-only `ScheduleItem` contract without `nonPlace` details.
- Produces: no `CreateNonPlaceScheduleItem` endpoint or request/response types.

- [ ] **Step 1: Update OpenAPI enum and remove non-place schemas**

Edit `packages/api-contract/openapi.yaml` so `TripPlaceType` is:

```yaml
    TripPlaceType:
      type: string
      enum:
        - sights
        - food
        - lodging
        - cafe
        - shopping
        - transport
        - etc
```

Remove these component schemas and all `$ref` usages:

```text
ScheduleItemType value non_place
NonPlaceScheduleItemCategory
NonPlaceTransportMode
NonPlaceScheduleItemDetails
CreateNonPlaceScheduleItemRequest
CreateNonPlaceScheduleItemResponse
```

Remove the `POST /trips/{tripId}/days/{tripDayId}/schedule-items/non-place` path. Remove non-place fields from `UpdateScheduleItemRequest`: `category`, `title`, `link`, `transportMode`, `referenceNumber`, `bookingReference`, `originText`, `destinationText`, `terminalText`, `gateText`. Keep place schedule `memo` if it is still used for place-backed schedule details.

- [ ] **Step 2: Add mapped placeType to Google search response if missing**

In `GooglePlaceSearchResult`, add required field:

```yaml
        placeType:
          $ref: '#/components/schemas/TripPlaceType'
```

This lets mobile use server-owned mapping instead of a divergent local raw-type map.

- [ ] **Step 3: Write DB migration**

Create `apps/api/migrations/00022_unify_schedule_place_types.sql`:

```sql
-- +goose Up
ALTER TABLE trip_places DROP CONSTRAINT IF EXISTS trip_places_place_type_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_place_type_check;

DELETE FROM schedule_items WHERE item_kind = 'non_place';

ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_fields_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_non_place_category_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_mode_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_item_kind_check;

ALTER TABLE schedule_items
  DROP COLUMN IF EXISTS transport_gate_text,
  DROP COLUMN IF EXISTS transport_terminal_text,
  DROP COLUMN IF EXISTS transport_destination_text,
  DROP COLUMN IF EXISTS transport_origin_text,
  DROP COLUMN IF EXISTS transport_booking_reference,
  DROP COLUMN IF EXISTS transport_reference_number,
  DROP COLUMN IF EXISTS transport_mode,
  DROP COLUMN IF EXISTS non_place_link,
  DROP COLUMN IF EXISTS non_place_memo,
  DROP COLUMN IF EXISTS non_place_title,
  DROP COLUMN IF EXISTS non_place_category,
  DROP COLUMN IF EXISTS item_kind;

ALTER TABLE schedule_items
  ALTER COLUMN trip_place_id SET NOT NULL;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_backing_check CHECK (
    trip_place_id IS NOT NULL
    AND place_title IS NOT NULL
    AND char_length(btrim(place_title)) BETWEEN 1 AND 120
  );

ALTER TABLE trip_places
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'));

ALTER TABLE expenses
  ADD CONSTRAINT expenses_place_type_check CHECK (place_type IS NULL OR place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'));

-- +goose Down
ALTER TABLE trip_places DROP CONSTRAINT IF EXISTS trip_places_place_type_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_place_type_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;

ALTER TABLE schedule_items
  ADD COLUMN item_kind text NOT NULL DEFAULT 'place',
  ADD COLUMN non_place_category text,
  ADD COLUMN non_place_title text,
  ADD COLUMN non_place_memo text,
  ADD COLUMN non_place_link text,
  ADD COLUMN transport_mode text,
  ADD COLUMN transport_reference_number text,
  ADD COLUMN transport_booking_reference text,
  ADD COLUMN transport_origin_text text,
  ADD COLUMN transport_destination_text text,
  ADD COLUMN transport_terminal_text text,
  ADD COLUMN transport_gate_text text;

ALTER TABLE schedule_items
  ALTER COLUMN trip_place_id DROP NOT NULL;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_item_kind_check CHECK (item_kind IN ('place', 'non_place')),
  ADD CONSTRAINT schedule_items_non_place_category_check CHECK (non_place_category IS NULL OR non_place_category IN ('transport', 'rest', 'memo', 'reminder')),
  ADD CONSTRAINT schedule_items_transport_mode_check CHECK (transport_mode IS NULL OR transport_mode IN ('flight', 'train', 'bus', 'ferry', 'other')),
  ADD CONSTRAINT schedule_items_backing_check CHECK (
    (
      item_kind = 'place'
      AND trip_place_id IS NOT NULL
      AND place_title IS NOT NULL
      AND non_place_category IS NULL
      AND non_place_title IS NULL
      AND non_place_memo IS NULL
      AND non_place_link IS NULL
      AND transport_mode IS NULL
      AND transport_reference_number IS NULL
      AND transport_booking_reference IS NULL
      AND transport_origin_text IS NULL
      AND transport_destination_text IS NULL
      AND transport_terminal_text IS NULL
      AND transport_gate_text IS NULL
    ) OR (
      item_kind = 'non_place'
      AND trip_place_id IS NULL
      AND place_title IS NULL
      AND place_memo IS NULL
      AND non_place_category IS NOT NULL
      AND non_place_title IS NOT NULL
    )
  ),
  ADD CONSTRAINT schedule_items_transport_fields_check CHECK (
    item_kind = 'place'
    OR (non_place_category = 'transport' AND transport_mode IS NOT NULL)
    OR (non_place_category IN ('rest', 'memo', 'reminder') AND transport_mode IS NULL AND transport_reference_number IS NULL AND transport_booking_reference IS NULL AND transport_origin_text IS NULL AND transport_destination_text IS NULL AND transport_terminal_text IS NULL AND transport_gate_text IS NULL)
  );

ALTER TABLE trip_places
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'));

ALTER TABLE expenses
  ADD CONSTRAINT expenses_place_type_check CHECK (place_type IS NULL OR place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'));
```

- [ ] **Step 4: Update schema snapshot**

Run the migration against the local schema generation flow used by this repo, or manually update `apps/api/schema.sql` to match the migration exactly if no local DB is available. The final snapshot must show `schedule_items.trip_place_id uuid NOT NULL`, no non-place columns, and `transport` in place type checks.

- [ ] **Step 5: Generate OpenAPI artifacts**

Run:

```bash
pnpm --filter @i-um/api-contract generate
```

Expected: generated Go and TS contract files update without errors.

- [ ] **Step 6: Verify contract generation is stable**

Run:

```bash
pnpm --filter @i-um/api-contract generate
```

Expected: second run produces no additional diff.

---

### Task 2: Provider-aware static place type mapping

**Files:**
- Create: `apps/api/internal/place/provider_place_type_mapping.go`
- Modify: `apps/api/internal/place/service.go`
- Modify: `apps/api/internal/place/types.go`
- Modify: `apps/api/internal/place/service_test.go`
- Modify: `apps/api/internal/server/mappers.go`

**Interfaces:**
- Produces: `MapProviderPlaceType(provider string, primaryType string, rawTypes []string) string`.
- Produces: `SearchResult.PlaceType string`.
- Consumes: `DestinationProviderGoogle` constant.

- [ ] **Step 1: Write failing mapper tests**

Add tests to `apps/api/internal/place/service_test.go`:

```go
func TestMapProviderPlaceType(t *testing.T) {
	tests := []struct {
		name        string
		provider    string
		primaryType string
		types       []string
		want        string
	}{
		{name: "google primary cafe", provider: DestinationProviderGoogle, primaryType: "coffee_shop", want: "cafe"},
		{name: "google fallback food", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"restaurant"}, want: "food"},
		{name: "google airport transport", provider: DestinationProviderGoogle, primaryType: "airport", want: "transport"},
		{name: "google station fallback transport", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"point_of_interest", "train_station"}, want: "transport"},
		{name: "google unknown etc", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"point_of_interest"}, want: "etc"},
		{name: "unknown provider etc", provider: "naver", primaryType: "restaurant", want: "etc"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MapProviderPlaceType(tt.provider, tt.primaryType, tt.types); got != tt.want {
				t.Fatalf("MapProviderPlaceType() = %q, want %q", got, tt.want)
			}
		})
	}
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @i-um/api test -- ./internal/place -run TestMapProviderPlaceType
```

Expected: FAIL because `MapProviderPlaceType` does not exist.

- [ ] **Step 3: Implement mapper**

Create `apps/api/internal/place/provider_place_type_mapping.go`:

```go
package place

import "strings"

const (
	TripPlaceTypeSights    = "sights"
	TripPlaceTypeFood      = "food"
	TripPlaceTypeLodging   = "lodging"
	TripPlaceTypeCafe      = "cafe"
	TripPlaceTypeShopping  = "shopping"
	TripPlaceTypeTransport = "transport"
	TripPlaceTypeEtc       = "etc"
)

var googlePlaceTypeMap = map[string]string{
	"tourist_attraction": TripPlaceTypeSights,
	"museum":             TripPlaceTypeSights,
	"park":               TripPlaceTypeSights,
	"art_gallery":        TripPlaceTypeSights,
	"amusement_park":     TripPlaceTypeSights,
	"zoo":                TripPlaceTypeSights,
	"aquarium":           TripPlaceTypeSights,
	"landmark":           TripPlaceTypeSights,
	"historical_landmark": TripPlaceTypeSights,
	"place_of_worship":   TripPlaceTypeSights,

	"restaurant":    TripPlaceTypeFood,
	"meal_takeaway": TripPlaceTypeFood,
	"meal_delivery": TripPlaceTypeFood,
	"bakery":        TripPlaceTypeFood,
	"bar":           TripPlaceTypeFood,
	"food":          TripPlaceTypeFood,

	"lodging":           TripPlaceTypeLodging,
	"hotel":             TripPlaceTypeLodging,
	"motel":             TripPlaceTypeLodging,
	"resort_hotel":      TripPlaceTypeLodging,
	"guest_house":       TripPlaceTypeLodging,
	"hostel":            TripPlaceTypeLodging,
	"bed_and_breakfast": TripPlaceTypeLodging,

	"cafe":        TripPlaceTypeCafe,
	"coffee_shop": TripPlaceTypeCafe,

	"shopping_mall":     TripPlaceTypeShopping,
	"store":             TripPlaceTypeShopping,
	"department_store":  TripPlaceTypeShopping,
	"clothing_store":    TripPlaceTypeShopping,
	"supermarket":       TripPlaceTypeShopping,
	"convenience_store": TripPlaceTypeShopping,

	"airport":            TripPlaceTypeTransport,
	"train_station":      TripPlaceTypeTransport,
	"subway_station":     TripPlaceTypeTransport,
	"transit_station":    TripPlaceTypeTransport,
	"bus_station":        TripPlaceTypeTransport,
	"bus_stop":           TripPlaceTypeTransport,
	"ferry_terminal":     TripPlaceTypeTransport,
	"light_rail_station": TripPlaceTypeTransport,
	"taxi_stand":         TripPlaceTypeTransport,
	"parking":            TripPlaceTypeTransport,
	"car_rental":         TripPlaceTypeTransport,
}

func MapProviderPlaceType(provider string, primaryType string, rawTypes []string) string {
	mapping := providerTypeMap(strings.TrimSpace(provider))
	if len(mapping) == 0 {
		return TripPlaceTypeEtc
	}
	if mapped, ok := mapping[normalizeProviderType(primaryType)]; ok {
		return mapped
	}
	for _, value := range rawTypes {
		if mapped, ok := mapping[normalizeProviderType(value)]; ok {
			return mapped
		}
	}
	return TripPlaceTypeEtc
}

func providerTypeMap(provider string) map[string]string {
	switch provider {
	case DestinationProviderGoogle:
		return googlePlaceTypeMap
	default:
		return nil
	}
}

func normalizeProviderType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
```

- [ ] **Step 4: Replace old mapper calls**

In `apps/api/internal/place/service.go`, replace `mapGooglePlaceType(snapshot.PrimaryType, snapshot.Types)` with:

```go
MapProviderPlaceType(DestinationProviderGoogle, snapshot.PrimaryType, snapshot.Types)
```

Delete old functions `mapGooglePlaceType` and `internalPlaceTypeForGoogleType`.

- [ ] **Step 5: Add mapped placeType to search results**

In `apps/api/internal/place/types.go`, add to `SearchResult`:

```go
PlaceType string
```

In `normalizeSearchResults` inside `apps/api/internal/place/service.go`, set:

```go
result.PlaceType = MapProviderPlaceType(DestinationProviderGoogle, result.PrimaryType, []string{result.PrimaryType})
```

If search results do not include `types[]`, use `primaryType` only for search display and rely on Details for persistence.

In `apps/api/internal/server/mappers.go`, map to OpenAPI:

```go
PlaceType: openapi.TripPlaceType(result.PlaceType),
```

- [ ] **Step 6: Run mapper tests**

Run:

```bash
pnpm --filter @i-um/api test -- ./internal/place -run TestMapProviderPlaceType
```

Expected: PASS.

---

### Task 3: Remove backend non-place domain and persistence branches

**Files:**
- Modify: `apps/api/internal/trip/types.go`
- Modify: `apps/api/internal/trip/service.go`
- Modify: `apps/api/internal/server/trip_handlers.go`
- Modify: `apps/api/internal/server/mappers.go`
- Modify: `apps/api/internal/storage/trip_repository.go`
- Modify: `apps/api/queries/trips.sql`
- Generated: `apps/api/internal/db/**`
- Tests: relevant Go tests under `apps/api/internal/**/*_test.go`

**Interfaces:**
- Removes: `CreateNonPlaceScheduleItem`, `UpdateNonPlaceScheduleItem`, `NonPlaceScheduleItemDetails`.
- Produces: place-only `ScheduleItem` mapping with `Place` and optional `PlaceSchedule`.

- [ ] **Step 1: Search all non-place references**

Run:

```bash
rg -n "NonPlace|non_place|nonPlace|CreateNonPlace|TransportMode|non_place_category|item_kind" apps/api/internal apps/api/queries apps/api/migrations packages/api-contract/openapi.yaml
```

Expected: list all references to remove or consciously keep only in older migrations.

- [ ] **Step 2: Remove handler and server interface implementation**

Delete `CreateNonPlaceScheduleItem` handler from `apps/api/internal/server/trip_handlers.go`. Remove references to `createNonPlaceScheduleItemResponseToOpenAPI` from `apps/api/internal/server/mappers.go`.

- [ ] **Step 3: Remove trip service/domain non-place types**

In `apps/api/internal/trip/types.go`, remove constants and structs used only for non-place schedule items:

```go
ScheduleItemTypeNonPlace
NonPlaceCategoryTransport
NonPlaceCategoryRest
NonPlaceCategoryMemo
NonPlaceCategoryReminder
TransportModeFlight
TransportModeTrain
TransportModeBus
TransportModeFerry
TransportModeOther
CreateNonPlaceScheduleItemInput
CreateNonPlaceScheduleItemRecord
UpdateNonPlaceScheduleItemRecord
NonPlaceScheduleItemDetails
CreateNonPlaceScheduleItemResult
```

Keep `ScheduleItemTypePlace` only if the API still exposes `itemType: place`; otherwise remove schedule item type entirely.

- [ ] **Step 4: Simplify update validation**

In `apps/api/internal/trip/service.go`, remove non-place creation/update normalization helpers:

```go
CreateNonPlaceScheduleItem
normalizeCreateNonPlaceScheduleItemInput
mergeUpdateNonPlaceScheduleItemInput
normalizeNonPlaceDetails
isSupportedNonPlaceCategory
isSupportedTransportMode
```

Ensure `UpdateScheduleItem` only supports place-backed fields:

```go
name
address
placeType
startTime
endTime
memo
```

- [ ] **Step 5: Update supported place type validation**

Update `isSupportedPlaceType` in `apps/api/internal/trip/service.go` to include `transport`:

```go
case "sights", "food", "lodging", "cafe", "shopping", "transport", "etc":
	return true
```

- [ ] **Step 6: Simplify storage row mapping**

In `apps/api/internal/storage/trip_repository.go`, remove `nonPlaceScheduleItemDetails` and any branches that create a `ScheduleItem` without `Place`. Schedule items loaded from queries should map `Place` and `PlaceSchedule` only.

- [ ] **Step 7: Update SQL queries**

In `apps/api/queries/trips.sql`, remove selected non-place columns from schedule item list/detail queries. Delete insert/update queries dedicated to non-place schedule items. Ensure place-backed schedule item insert/update queries still select `place_title` and `place_memo`.

- [ ] **Step 8: Regenerate sqlc artifacts**

Run:

```bash
pnpm --filter @i-um/api generate
```

Expected: `apps/api/internal/db/*.go` regenerate without non-place query params or row fields.

- [ ] **Step 9: Update Go tests**

Remove tests whose only purpose is non-place behavior. Update remaining tests to expect place-only schedule items and `transport` validation. Add one test that saves/updates `placeType: transport` through the existing place update path.

- [ ] **Step 10: Run API tests**

Run:

```bash
pnpm --filter @i-um/api test
```

Expected: PASS.

---

### Task 4: Mobile place-only schedule creation and transport category

**Files:**
- Modify: `apps/mobile/lib/design/theme.ts`
- Modify: `apps/mobile/lib/trips/manual-place.ts`
- Modify: `apps/mobile/lib/places/place-schedule-detail.ts`
- Modify: `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx`
- Remove or stop importing: `apps/mobile/lib/trips/non-place-schedule-item.ts`
- Tests: `apps/mobile/lib/places/place-schedule-detail.test.mts`, `apps/mobile/lib/trips/manual-place.test.mts`

**Interfaces:**
- Produces: `hasRequiredPlaceScheduleDetailFields(values)` requiring title and selected place.
- Produces: `validatePlaceScheduleDetailForm(values)` only returning `CreateGooglePlaceScheduleItemRequest`.
- Removes: `validateUnifiedScheduleDetailForm` and non-place form fields.

- [ ] **Step 1: Add transport theme and edit option test**

Update `apps/mobile/lib/trips/manual-place.test.mts` expected options:

```ts
assert.deepEqual(manualPlaceTypeOptions, [
  { value: 'sights', label: '관광지' },
  { value: 'food', label: '식당' },
  { value: 'lodging', label: '숙소' },
  { value: 'cafe', label: '카페' },
  { value: 'shopping', label: '쇼핑' },
  { value: 'transport', label: '교통' },
  { value: 'etc', label: '기타' },
]);
```

- [ ] **Step 2: Run mobile manual place test to verify failure**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/trips/manual-place.test.mts
```

Expected: FAIL because `transport` is missing.

- [ ] **Step 3: Implement transport theme and options**

In `apps/mobile/lib/design/theme.ts`, add:

```ts
transport: { label: '교통', color: blue[500] },
```

Use an existing palette token present in the file. In `apps/mobile/lib/trips/manual-place.ts`, update:

```ts
export const manualPlaceTypeValues: TripPlaceType[] = ['sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'];
```

- [ ] **Step 4: Update schedule detail tests to require place**

In `apps/mobile/lib/places/place-schedule-detail.test.mts`, remove unified non-place assertions and assert empty form cannot submit without place:

```ts
const empty = emptyPlaceScheduleDetailForm();
assert.equal(hasRequiredPlaceScheduleDetailFields(empty), false);
assert.deepEqual(validatePlaceScheduleDetailForm(empty), {
  ok: false,
  errors: {
    title: '일정 제목을 입력해주세요.',
    place: '장소를 선택해주세요.',
  },
});
```

- [ ] **Step 5: Simplify place schedule detail helper**

In `apps/mobile/lib/places/place-schedule-detail.ts`, remove imports and fields related to:

```ts
CreateNonPlaceScheduleItemRequest
NonPlaceScheduleItemCategory
NonPlaceTransportMode
emptyNonPlaceScheduleItemForm
nonPlaceCategoryOptions
nonPlaceTransportModeOptions
validateCreateNonPlaceScheduleItemForm
```

Make `PlaceScheduleDetailFormValues` contain only:

```ts
title: string;
startTime: string;
endTime: string;
memo: string;
titleTouched: boolean;
selectedPlace: PlaceScheduleSelectedPlace | null;
```

Delete `validateUnifiedScheduleDetailForm` and keep `validatePlaceScheduleDetailForm` as the only submit validator.

- [ ] **Step 6: Simplify schedule creation screen**

In `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx`:

- Remove `createNonPlaceScheduleItem` import.
- Remove `nonPlaceCategoryOptions` and `nonPlaceTransportModeOptions` imports.
- Remove all `nonPlace*` route params and form controls.
- Replace submit validation with `validatePlaceScheduleDetailForm(values, duplicateConfirmed)`.
- Always call `createGooglePlaceScheduleItem` on successful validation.
- Change helper copy to: `장소를 검색해 일정에 추가해 주세요.`
- Keep `장소 지우기`, but when cleared, save becomes disabled until another place is selected.

- [ ] **Step 7: Run mobile focused tests**

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/places/place-schedule-detail.test.mts lib/trips/manual-place.test.mts
```

Expected: PASS.

---

### Task 5: Remove mobile non-place display/edit branches

**Files:**
- Modify: `apps/mobile/lib/trips/day-itinerary.ts`
- Modify: `apps/mobile/lib/trip-ui/DayItineraryContent.tsx`
- Modify: `apps/mobile/lib/trip-ui/useDayItineraryEditorController.ts`
- Modify/remove: `apps/mobile/lib/trip-ui/NonPlaceScheduleItemPanel.tsx`
- Modify/remove: `apps/mobile/lib/trip-ui/day-itinerary-editor-edit-actions.ts`
- Modify: `apps/mobile/lib/trips/quick-expense.ts`
- Modify: `apps/mobile/lib/trips/today-execution.ts`
- Update tests under `apps/mobile/lib/trips/*.test.mts`

**Interfaces:**
- Produces: itinerary rows assume `item.place` exists.
- Removes: `getNonPlaceCategoryLabel`, non-place panel state, non-place edit actions, non-place quick-expense labels.

- [ ] **Step 1: Search mobile non-place references**

Run:

```bash
rg -n "nonPlace|NonPlace|non_place|장소 없는|transportMode|referenceNumber|bookingReference|originText|destinationText|terminalText|gateText|getNonPlaceCategoryLabel" apps/mobile
```

Expected: identifies all branches to remove or update.

- [ ] **Step 2: Simplify itinerary helper tests first**

In `apps/mobile/lib/trips/day-itinerary.test.mts`, remove tests that expect non-place rows. Add a regression test that a `transport` place displays label `교통`:

```ts
assert.equal(getPlaceTypeLabel('transport'), '교통');
```

- [ ] **Step 3: Simplify `day-itinerary.ts`**

Remove `NonPlaceScheduleItemCategory`, `NonPlaceTransportMode`, `getNonPlaceCategoryLabel`, `getTransportModeLabel`, and `buildNonPlaceDetailLabel`. In `scheduleItemToDayItineraryRow`, treat missing `item.place` as invalid fallback only if TypeScript requires defensive handling:

```ts
if (!item.place) {
  return {
    id: item.id,
    version: item.version,
    orderLabel: String(item.itemOrder),
    itemType: 'place',
    isLodging: false,
    startTime: item.startTime,
    endTime: item.endTime,
    timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime),
    placeName: '알 수 없는 장소',
    placeType: 'etc',
    placeTypeLabel: getPlaceTypeLabel('etc'),
    address: '',
  };
}
```

Prefer removing `itemType` from mobile view models if all consumers can be updated in the same task.

- [ ] **Step 4: Remove non-place editor state and panel**

Remove imports/usages of `NonPlaceScheduleItemPanel`, `NonPlaceScheduleItemPanelState`, `emptyNonPlaceScheduleItemForm`, `validateCreateNonPlaceScheduleItemForm`, and `validateUpdateNonPlaceScheduleItemForm` from editor controller/content files. Delete `apps/mobile/lib/trip-ui/NonPlaceScheduleItemPanel.tsx` only after no imports remain.

- [ ] **Step 5: Update quick expense/today helpers**

Replace branches like:

```ts
item.nonPlace ? getNonPlaceCategoryLabel(item.nonPlace.category) : getPlaceTypeLabel(item.place.placeType)
```

with place-only logic:

```ts
getPlaceTypeLabel(item.place.placeType)
```

If defensive fallback is necessary for generated nullable types, skip items without `place` or label them as `기타` without exposing non-place copy.

- [ ] **Step 6: Update mobile tests**

Remove non-place-specific assertions from quick expense, today execution, detail panel, and itinerary tests. Add/keep tests that place-backed `transport` rows use `교통`.

- [ ] **Step 7: Run mobile tests**

Run:

```bash
pnpm --filter @i-um/mobile test
```

Expected: PASS.

---

### Task 6: Full generation, lint, and verification

**Files:**
- Modify generated files from prior tasks.
- Modify: `.harness/runs/trip-place-type-unification/artifacts/evaluation-report.md`

**Interfaces:**
- Produces: complete generated contract/db state.
- Produces: verification evidence.

- [ ] **Step 1: Run full generation**

Run:

```bash
pnpm generate
```

Expected: OpenAPI and sqlc generation pass.

- [ ] **Step 2: Run generated verification**

Run:

```bash
pnpm verify:generated
```

Expected: PASS with no diff after regeneration.

- [ ] **Step 3: Run lint and format check**

Run:

```bash
pnpm lint
pnpm format:check
```

Expected: both PASS. If format check fails only due formatting, run `pnpm format`, inspect diff, then rerun `pnpm format:check`.

- [ ] **Step 4: Run API and mobile tests/typecheck**

Run:

```bash
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

Expected: all PASS.

- [ ] **Step 5: Run harness checks**

Run:

```bash
pnpm harness:validate
pnpm harness:check-worktree-isolation
pnpm harness:check-bugfix-scenario -- --run-id trip-place-type-unification
```

Expected: all PASS or documented non-applicability for bugfix scenario coverage because this is a feature cleanup.

- [ ] **Step 6: Record evaluation report**

Write `.harness/runs/trip-place-type-unification/artifacts/evaluation-report.md` with command, result, and any residual risks.

- [ ] **Step 7: Inspect final diff and commit**

Run:

```bash
git status --short
git diff --stat
git diff --cached --stat
```

Then commit logical changes:

```bash
git add packages/api-contract apps/api apps/mobile docs/superpowers/plans/2026-07-12-trip-place-type-unification.md

git commit -m "feat: unify schedule place categories"
```

Expected: commit succeeds and `git status --short` is clean except ignored run artifacts.
