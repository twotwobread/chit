# 0392 Map search and bottom sheet UX stabilization

## Metadata

- GitHub Issue: #392
- Status: Implemented via #402; closure audit source of truth
- Created: 2026-07-20
- Scope type: Mobile map/search UX stabilization

## Outcome

The map and place-search surfaces now use shared Chit primitives for the high-frequency controls around search, candidate tabs, destination chips, selected-place trays, and map result actions. The runtime behavior remains provider-compatible while the UI exposes clearer loading, no-result, selected, and permission-recovery states.

## Implemented evidence

- Search input and top overlay remain visible when the bottom sheet is minimized.
- Search submit/clear/current-location/result actions use shared `PrimaryButton`, `IconButton`, `FilterChip`, `InlineAction`, or `SecondaryButton` primitives where practical.
- Candidate tabs expose selected state via tab semantics and shared chip selected styling.
- Destination/filter chips expose selected state and accessible labels.
- No-result/not-found surfaces provide recovery actions back to itinerary context.
- Current-location permission denial/failure shows user-visible recovery copy instead of failing silently.
- Selected markers/list rows use non-color cues: marker scale/border treatment, selected action label/state, and focused row expansion.
- Icon-only map search actions keep at least the shared 44pt touch target floor.

## Verification

Automated/source checks:

- `pnpm --filter @i-um/mobile exec node --import tsx --test lib/places/google-search.test.mts lib/app-info/google-place-search-entry.test.mts`
  - Result: 58 passed, 0 failed.

Manual smoke still required before release:

- Android and iOS map search query entry.
- No-result and not-found recovery action.
- Result select from list and marker.
- Location permission allowed/denied.
- Bottom sheet expand/minimize gesture and screen-reader handle affordance.

## Remaining ownership

No further #392-specific runtime implementation is required unless manual device smoke finds a regression. Future map/search polish should be tracked as a new issue or under state preservation (#390) if it changes route/back-stack behavior.
