# 0390 Trip tab state preservation

## Summary

Trip tab state now follows a small durability policy: user-important sub-mode/filter selections are encoded in route params, while high-churn interaction state stays local to avoid noisy or privacy-sensitive URLs.

## Preserved route state

- Expenses `mode`
  - `main`: `/trips/:tripId/expenses`
  - `days`: `/trips/:tripId/expenses?mode=days&dayId=:dayId`
  - `categories`: `/trips/:tripId/expenses?mode=categories&category=:category`
- Itinerary selected day continues to use `dayId`.
- Map `routeDays` preserves route-layer day chips, e.g. `/trips/:tripId/map?routeDays=day-1,day-2`.
- The custom Trip tab bar preserves known tab params when switching away and back.

## Local-only state policy

The following remains local and is intentionally not deep-link state:

- Map/place search query / 검색어.
- Bottom-sheet drag height and selected sheet tab.
- Selected map marker/result details.
- Scroll offsets.

These states are high-churn, short-lived, or interaction-specific. They should be covered by manual smoke rather than persisted in URLs.

## Back and deep-link behavior

- Root Trip tabs and Trip Detail still use the app-level leading action to return Home.
- Hidden flows fall back to a stable parent route when the native stack cannot go back.
- Expenses route params restore sub-mode/filter state after deep links, tab switches, and refresh.
- Map route-layer params restore visible route chips after deep links, tab switches, and refresh.
- Notification/invite/share entries should recover core nav by landing on canonical Trip tab/detail paths with any supported state query intact.

## Manual smoke checklist

Not run locally in this change:

- Android back gesture from each Trip root tab and hidden flow.
- Android tab switch: Expenses days/category filters, Map routeDays, Itinerary dayId.
- iOS swipe-back/modal dismiss from hidden flows and bottom sheets.
- iOS tab switch: Expenses days/category filters, Map routeDays, Itinerary dayId.
- Deep link smoke for Expenses `mode`, Map `routeDays`, Itinerary `dayId`, notification target, invite, and share entry.
- Map search smoke to confirm search query, sheet drag, and selected marker remain local and do not conflict with system gestures.
