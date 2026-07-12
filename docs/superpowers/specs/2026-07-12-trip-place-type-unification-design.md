# TripPlaceType category unification design

## Summary

Unify schedule/place categories around `TripPlaceType`. Schedule creation becomes place-backed only for now. The previous place-less schedule flow (`transport`, `rest`, `memo`, `reminder`) is removed until a future UX can handle reservation, boarding, and document-style itinerary information properly.

## Category model

`TripPlaceType` becomes the single user-facing category model:

- `sights` — 관광지
- `food` — 식당
- `lodging` — 숙소
- `cafe` — 카페
- `shopping` — 쇼핑
- `transport` — 교통
- `etc` — 기타

The non-place schedule category model is removed from the product surface and from the API/DB model.

## Provider type mapping

Google raw place types are mapped to internal `TripPlaceType` through a code-owned static map. The mapper is provider-aware so future providers can add their own maps without changing schedule/place business logic.

Mapping order:

1. Map provider `primaryType`.
2. If unmapped, scan provider `types[]` in order.
3. If still unmapped, fall back to `etc`.

Transport examples include `airport`, `train_station`, `subway_station`, `transit_station`, `bus_station`, `bus_stop`, `ferry_terminal`, `light_rail_station`, `taxi_stand`, `parking`, and `car_rental`.

## Creation and edit behavior

When a user creates a schedule item, they must select a Google place. The server stores the mapped `TripPlaceType` on the `trip_place`. If the same Google place already exists in the trip, the stored `placeType` is reused and not remapped, so user edits are preserved.

Users do not choose a category during schedule creation. If the automatic category is wrong, they can correct it from the existing place edit flow, which will include `교통`.

## Removed scope

Remove the place-less schedule creation/editing path, including non-place categories and fields such as link, transport mode, origin/destination, reference number, booking reference, terminal, and gate. Reservation/boarding details will be designed later as a separate feature.

No production non-place schedule data needs to be preserved.

## Implementation surfaces

- OpenAPI: add `transport` to `TripPlaceType`; remove non-place schedule schemas/endpoints/fields.
- API: add provider-aware static mapping; remove non-place handler/service/storage branches.
- DB: add `transport` to place-type constraints; remove non-place schedule columns/checks.
- Mobile: make schedule creation require place selection; remove non-place UI and helpers; add `교통` theme/option support.
- Tests: cover provider mapping, transport category, place-only schedule creation, schema generation, and mobile helper behavior.
