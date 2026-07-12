# Trip Today Status Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home opens every trip in Today, and Today shows ongoing, upcoming, or past trip states.

**Architecture:** Route selection stays in `apps/mobile/lib/trips/home.ts`. Today date/status copy and route actions live in `apps/mobile/lib/trips/trip-tabs.ts` so `useTripTodayController` can branch before day-specific API calls. The Today screen renders a dedicated status card for upcoming/past states using existing design tokens.

**Tech Stack:** Expo Router, React Native, TypeScript, node:test helper tests, existing i-um design tokens.

## Global Constraints

- No API or DB changes.
- No new dependencies.
- Use existing route helpers from `apps/mobile/lib/trips/routes.ts`.
- Use existing design tokens from `apps/mobile/lib/design/theme.ts`; do not add raw hex colors.
- Preserve existing ongoing-trip Today behavior.
- Do not call day itinerary or expense APIs when no calendar-today Day exists.

---

### Task 1: Route all Home trip rows to Today

**Files:**
- Modify: `apps/mobile/lib/trips/home.ts`
- Modify: `apps/mobile/lib/trips/home.test.mts`

**Interfaces:**
- Consumes: `tripTodayPath(tripId: string)` from `apps/mobile/lib/trips/routes.ts`.
- Produces: `HomeTripCardViewModel.detailPath` now points at Today for tap behavior while keeping the existing property name for the current UI.

- [ ] **Step 1: Write the failing test**

Add assertions in `apps/mobile/lib/trips/home.test.mts` so grouped ongoing/upcoming/past rows expect `/trips/<id>/today`.

```ts
assert.deepEqual(
  viewModel.sections.map((section) => [section.status, section.trips.map((item) => [item.id, item.detailPath])]),
  [
    ['ongoing', [['other-ongoing', '/trips/other-ongoing/today']]],
    ['upcoming', [['upcoming', '/trips/upcoming/today']]],
    ['past', [['past', '/trips/past/today']]],
  ],
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @i-um/mobile test -- home.test.mts`
Expected: FAIL because rows still point at `/detail`.

- [ ] **Step 3: Implement minimal route change**

In `apps/mobile/lib/trips/home.ts`, import only `tripTodayPath` from `./routes` and return:

```ts
detailPath: tripTodayPath(trip.id),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @i-um/mobile test -- home.test.mts`
Expected: PASS.

---

### Task 2: Add Today status landing view models

**Files:**
- Modify: `apps/mobile/lib/trips/trip-tabs.ts`
- Modify: `apps/mobile/lib/trips/trip-tabs.test.mts`

**Interfaces:**
- Consumes: `tripStatus(trip, today)` from `apps/mobile/lib/trips/status.ts` and route helpers from `apps/mobile/lib/trips/routes.ts`.
- Produces: `buildTripTodayStatusLandingViewModel(detail, today)` returning upcoming/past/null.

- [ ] **Step 1: Write failing helper tests**

Add tests covering:

```ts
const upcoming = buildTripTodayStatusLandingViewModel(detail({ startDate: '2026-07-22', endDate: '2026-07-25' }), '2026-07-12');
assert.equal(upcoming?.status, 'upcoming');
assert.equal(upcoming?.eyebrow, '다가오는 여행');
assert.equal(upcoming?.heroLabel, 'D-10');
assert.equal(upcoming?.primaryAction.label, '일정 준비하기');
assert.equal(upcoming?.primaryAction.route, '/trips/trip-a/itinerary');

const past = buildTripTodayStatusLandingViewModel(detail({ startDate: '2026-07-01', endDate: '2026-07-05' }), '2026-07-12');
assert.equal(past?.status, 'past');
assert.equal(past?.eyebrow, '다녀온 여행');
assert.equal(past?.primaryAction.label, '지출·정산 확인하기');
assert.equal(past?.primaryAction.route, '/trips/trip-a/settle');
assert.equal(past?.secondaryAction?.label, '전체 일정 보기');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @i-um/mobile test -- trip-tabs.test.mts`
Expected: FAIL because the helper is not implemented.

- [ ] **Step 3: Implement helper/types**

Add a discriminated union with `status: 'upcoming' | 'past'`, copy fields, `tone`, and route actions. Return `null` for ongoing trips.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @i-um/mobile test -- trip-tabs.test.mts`
Expected: PASS.

---

### Task 3: Wire Today controller and screen

**Files:**
- Modify: `apps/mobile/lib/trip-ui/useTripTodayController.ts`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`

**Interfaces:**
- Consumes: `buildTripTodayStatusLandingViewModel(detail, today)`.
- Produces: `TripTodayState` branch `{ status: 'statusLanding'; viewModel: TripTodayStatusLandingViewModel }`.

- [ ] **Step 1: Controller branch**

In `load`, after fetching detail and before `findTripCalendarDay` unavailable state, build status landing. If present, set `statusLanding` and return.

- [ ] **Step 2: Screen rendering**

Render a `TodayStatusLandingCard` for `state.status === 'statusLanding'`. Upcoming card uses amber styles; past card uses muted styles.

- [ ] **Step 3: Route actions**

Primary/secondary buttons call `router.push(viewModel.primaryAction.route)` and `router.push(viewModel.secondaryAction.route)` when present.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @i-um/mobile test -- trip-tabs.test.mts home.test.mts`
Expected: PASS.

---

### Task 4: Final verification

**Files:**
- Modify: `.harness/runs/20260712-trip-today-status-dashboard/artifacts/evaluation-report.md`

- [ ] **Step 1: Run full mobile tests**

Run: `pnpm --filter @i-um/mobile test`
Expected: PASS.

- [ ] **Step 2: Run mobile typecheck**

Run: `pnpm --filter @i-um/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Record verification**

Record command results and any manual smoke gaps in the evaluation report.
