# 0387 Loading, empty, and error recovery patterns

## Summary

This slice defines the reusable state-recovery foundation for mobile screens before the broader #397 screen adoption pass.

## Added pattern

- `SkeletonCard`: shared structural placeholder for loading states expected to last more than a brief tap response.
- The skeleton is token-only, non-decorative, and exposes `accessibilityState={{ busy: true }}` with progressbar semantics.
- Existing `EmptyState`, `ErrorState`, and `LoadingState` remain the recovery primitives for empty/error/short loading states.

## First adoption

- `TripStateCard` now maps `loading` to `SkeletonCard`, so trip tab surfaces that already use `TripStateCard loading` get a structural placeholder instead of a raw Acid Lime spinner.
- `TripStateCard` action metadata now accepts `disabled`, `loading`, `loadingLabel`, and `accessibilityLabel` for consistent retry/loading button behavior.

## Follow-up boundary

Issue #397 should use these primitives to replace local loading/empty/error cards in representative screens:

- Home/trip list empty and retry states.
- Trip detail/today/itinerary/expense/map loading and failure states.
- Settlement/history empty/error/loading cards.
- Notifications loading/empty/error states.

## Smoke checklist

Manual slow-network/failure smoke is still required on Android and iOS for Home, Today, Expense, Settlement, Map/Search, and Notifications.
