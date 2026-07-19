# 0340 Default travel mode prerequisite

## Summary

This is the prerequisite PR for #340. It adds a trip-scoped default travel mode so later itinerary leg summaries can compute one automatic mode per trip instead of calling route providers for every mode.

## Scope

### In

- Persist `defaultTravelMode` on trips.
- Supported trip default modes are `transit` and `driving`.
- New and existing trips default to `transit`.
- OpenAPI create/update/detail/list trip schemas include `defaultTravelMode`.
- Trip creation becomes a four-step wizard:
  1. destination city selection
  2. date range
  3. default settings: currency and travel mode
  4. review/create with editable auto-generated trip name
- Trip edit can change default travel mode.
- Today and itinerary contexts expose a quick way to change the trip setting.
- Today navigation/route preview uses the trip default mode and requests only the selected default mode.

### Out

- #340 schedule-item leg summary rows.
- Route summary batch endpoint, provider cache, rate limiting, or cost controls.
- Walking as a trip default.
- Destination-based automatic travel mode recommendation.
- Route optimization or navigation changes.

## Behavior

- `defaultTravelMode` is a trip property, not a device/user preference.
- If the user does not change the value during creation, the trip is created with `transit`; the create API also defaults an omitted value to `transit`.
- Walking remains available as a route/leg mode for later per-leg checks, but not as a trip default.
- Quick-change UI must make it clear that changing the mode updates the trip setting.
- Failed quick changes must not block itinerary display.

## Acceptance criteria

- [ ] CreateTrip accepts and returns `defaultTravelMode`.
- [ ] Existing trips read as `transit` after migration.
- [ ] Trip detail/list responses include `defaultTravelMode`.
- [ ] UpdateTrip can change `defaultTravelMode` independently.
- [ ] Unsupported default travel modes are rejected.
- [ ] Trip creation wizard preserves state across steps and submits only from review.
- [ ] Wizard review step shows an editable suggested trip name.
- [ ] Trip edit includes default travel mode.
- [ ] Today uses trip default mode rather than SecureStore/device-local mode.
- [ ] Today/itinerary quick-change updates the trip setting with safe error handling.

## Test plan

- API service/server/storage tests for create/update/read/list behavior and unsupported-mode rejection.
- OpenAPI/generated verification.
- Mobile helper tests for trip default travel mode options and trip-name suggestions.
- Mobile tests for create wizard state, update-form diffs, and Today mode plumbing.
- Mobile typecheck/lint and targeted manual smoke on device/simulator when available.
