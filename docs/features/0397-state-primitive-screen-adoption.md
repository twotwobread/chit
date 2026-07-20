# 0397 State primitive screen adoption

## Summary

Representative mobile loading, empty, and error states now compose shared `SkeletonCard`, `EmptyState`, and `ErrorState` primitives instead of local cards with raw primary spinners and bespoke retry copy.

## Applied surfaces

- Home root loading, login-required, retry, empty trip list, and history-only states.
- Notifications loading, auth, error, and empty states.
- Trip detail loading, auth, not-found, and retry states.
- My Page top-level loading/login/error states.
- My Page settlement summary and trip list loading/empty/error subsections.

## Shared primitive updates

- `StateAction` now supports `variant: 'primary' | 'secondary'`, `loading`, and `loadingLabel`.
- Primary recovery actions can stay visually primary while still being declared through the state primitive action slot.
- Secondary actions can show loading copy and are disabled while loading.

## Behavior notes

- Fetch, retry, navigation, stale-refresh, and pagination behavior is unchanged.
- Existing `TripStateCard loading` skeleton behavior from #387 remains the loading default for trip tabs.
- Load-more pagination buttons in Notifications remain inline row actions, not full-screen state cards.

## Smoke checklist

Manual Android + iOS smoke is still required for Home, Trip Detail, My Page, and Notifications loading/empty/error states, especially under slow network and failed requests.
