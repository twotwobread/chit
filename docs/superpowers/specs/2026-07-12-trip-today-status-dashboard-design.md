# Trip Today Status Dashboard Design

## Goal

Route every trip selection from Home into the trip-scoped Today tab, then let Today explain the selected trip's state.

## Approved UX

- Ongoing trip: keep the current Today execution UI.
- Upcoming trip: show a warm amber/beige D-day landing state with anticipation-oriented copy and `일정 준비하기` as the main action.
- Past trip: show a muted gray completed-trip landing state with `지출·정산 확인하기` as the primary action and `전체 일정 보기` as the secondary action.

## Architecture

Home view models should expose a Today route for ordinary trip rows instead of the hidden detail route. Today status branching should live in mobile trip helper/view-model code, not inside ad-hoc JSX conditionals, so tests can cover date/status behavior without rendering the screen.

`useTripTodayController` should continue fetching trip detail first. If a calendar-today Day exists, it keeps the current itinerary and expense fetch flow. If no calendar-today Day exists, it builds a status landing view model from the trip date range and must not call day itinerary or day expense APIs.

## Visual Treatment

Upcoming uses existing amber/beige tokens (`accentSoft`, `amber`) as a travel anticipation accent, not a spend-card clone. Past uses existing muted/sunken surface and ink tokens; no new design tokens or raw colors.

## Testing

Add helper tests for Home route targets and Today status landing copy/actions. Run mobile tests and typecheck before completion.
