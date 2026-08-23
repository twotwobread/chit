import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRIP_COMPATIBILITY_ROUTE_POLICY,
  isTripRootTab,
  isTripCompatibilityRoute,
  isTripRootTabPath,
  tripDetailPath,
  tripFallbackPath,
  tripFallbackPathForPathname,
  tripItineraryDayPath,
  parseTripMapRouteDayIdsParam,
  resolveTripExpensesRouteState,
  tripExpensesPath,
  tripExpensesStatePath,
  tripItineraryPath,
  tripMapPath,
  tripMapStatePath,
  tripParticipantsPath,
  tripRootPath,
  tripSettlePath,
  tripSettlementDetailDeepLink,
  tripSettlementDetailPath,
  tripTabPath,
  tripTabPathWithState,
  tripTodayPath,
} from './routes.ts';

test('documents retained trip compatibility routes', () => {
  assert.equal(TRIP_COMPATIBILITY_ROUTE_POLICY.basePattern, '/trips/*');
  assert.equal(TRIP_COMPATIBILITY_ROUTE_POLICY.canonicalFor, 'trip_planning');
  assert.match(TRIP_COMPATIBILITY_ROUTE_POLICY.retirementCondition, /event route parity/i);
  assert.equal(isTripCompatibilityRoute('/trips/trip-a/today'), true);
  assert.equal(isTripCompatibilityRoute('/events/event-a'), false);
});

test('builds canonical trip tab and hidden detail paths', () => {
  assert.equal(tripRootPath('trip-a'), '/trips/trip-a');
  assert.equal(tripTodayPath('trip-a'), '/trips/trip-a/today');
  assert.equal(tripMapPath('trip-a'), '/trips/trip-a/map');
  assert.equal(tripItineraryPath('trip-a'), '/trips/trip-a/itinerary');
  assert.equal(tripItineraryDayPath('trip-a', 'day-1'), '/trips/trip-a/itinerary?dayId=day-1');
  assert.equal(tripExpensesPath('trip-a'), '/trips/trip-a/expenses');
  assert.equal(tripSettlePath('trip-a'), '/trips/trip-a/settle');
  assert.equal(tripSettlementDetailPath('trip-a'), '/trips/trip-a/settlement-detail');
  assert.equal(tripSettlementDetailDeepLink('trip a'), 'ium:///trips/trip%20a/settlement-detail');
  assert.equal(tripDetailPath('trip-a'), '/trips/trip-a/detail');
  assert.equal(tripParticipantsPath('trip-a'), '/trips/trip-a/participants');
});

test('maps tab names to canonical tab roots', () => {
  assert.equal(tripTabPath('trip-a', 'today'), '/trips/trip-a/today');
  assert.equal(tripTabPath('trip-a', 'map'), '/trips/trip-a/map');
  assert.equal(tripTabPath('trip-a', 'itinerary'), '/trips/trip-a/itinerary');
  assert.equal(tripTabPath('trip-a', 'expenses'), '/trips/trip-a/expenses');
  assert.equal(tripTabPath('trip-a', 'settle'), '/trips/trip-a/settle');
});

test('recognizes concrete trip root tab route names for custom tab navigation', () => {
  assert.equal(isTripRootTab('today'), true);
  assert.equal(isTripRootTab('map'), true);
  assert.equal(isTripRootTab('itinerary'), true);
  assert.equal(isTripRootTab('expenses'), true);
  assert.equal(isTripRootTab('settle'), true);
  assert.equal(isTripRootTab('detail'), false);
  assert.equal(isTripRootTab('(tabs)'), false);
});

test('encodes no-history fallback matrix for trip shell routes', () => {
  assert.equal(tripFallbackPath({ kind: 'rootTab', tripId: 'trip-a' }), '/');
  assert.equal(tripFallbackPath({ kind: 'detail', tripId: 'trip-a' }), '/');
  assert.equal(tripFallbackPath({ kind: 'edit', tripId: 'trip-a' }), '/trips/trip-a/detail');
  assert.equal(tripFallbackPath({ kind: 'participants', tripId: 'trip-a' }), '/trips/trip-a/detail');
  assert.equal(tripFallbackPath({ kind: 'settlementDetail', tripId: 'trip-a' }), '/trips/trip-a/settle');
  assert.equal(tripFallbackPath({ kind: 'day', tripId: 'trip-a' }), '/trips/trip-a/itinerary');
  assert.equal(
    tripFallbackPath({ kind: 'dayPlaceSearch', tripId: 'trip-a', tripDayId: 'day-1' }),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
  assert.equal(
    tripFallbackPath({ kind: 'dayPlaceNew', tripId: 'trip-a', tripDayId: 'day-1' }),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
  assert.equal(
    tripFallbackPath({ kind: 'dayQuickExpense', tripId: 'trip-a', tripDayId: 'day-1' }),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
});

test('derives fallback from concrete trip pathnames', () => {
  assert.equal(tripFallbackPathForPathname('/trips/trip-a/today', 'trip-a'), '/');
  assert.equal(tripFallbackPathForPathname('/trips/trip-a/detail', 'trip-a'), '/');
  assert.equal(tripFallbackPathForPathname('/trips/trip-a/edit', 'trip-a'), '/trips/trip-a/detail');
  assert.equal(tripFallbackPathForPathname('/trips/trip-a/participants', 'trip-a'), '/trips/trip-a/detail');
  assert.equal(tripFallbackPathForPathname('/trips/trip-a/settlement-detail', 'trip-a'), '/trips/trip-a/settle');
  assert.equal(
    tripFallbackPathForPathname('/trips/trip-a/days/day-1', 'trip-a'),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
  assert.equal(
    tripFallbackPathForPathname('/trips/trip-a/days/day-1/place-search', 'trip-a'),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
  assert.equal(
    tripFallbackPathForPathname('/trips/trip-a/days/day-1/places/new', 'trip-a'),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
  assert.equal(
    tripFallbackPathForPathname('/trips/trip-a/days/day-1/expenses/quick', 'trip-a'),
    '/trips/trip-a/itinerary?dayId=day-1',
  );
});

test('recognizes only trip tab roots as root tab paths', () => {
  assert.equal(isTripRootTabPath('/trips/trip-a/today', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/map', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/itinerary', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/expenses', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/settle', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/detail', 'trip-a'), false);
  assert.equal(isTripRootTabPath('/trips/trip-b/today', 'trip-a'), false);
});

test('encodes and restores Expenses tab route state for deep links', () => {
  assert.deepEqual(resolveTripExpensesRouteState({ mode: 'days', dayId: 'day-2', category: 'food' }), {
    mode: 'days',
    selectedCategory: null,
    selectedDayId: 'day-2',
  });
  assert.deepEqual(resolveTripExpensesRouteState({ mode: 'categories', dayId: 'day-2', category: 'food' }), {
    mode: 'categories',
    selectedCategory: 'food',
    selectedDayId: null,
  });
  assert.deepEqual(resolveTripExpensesRouteState({ mode: 'unknown', dayId: 'day-2', category: 'food' }), {
    mode: 'main',
    selectedCategory: null,
    selectedDayId: null,
  });

  assert.equal(tripExpensesStatePath('trip-a', { mode: 'main' }), '/trips/trip-a/expenses');
  assert.equal(
    tripExpensesStatePath('trip-a', { mode: 'days', selectedDayId: 'day-2' }),
    '/trips/trip-a/expenses?mode=days&dayId=day-2',
  );
  assert.equal(
    tripExpensesStatePath('trip-a', { mode: 'categories', selectedCategory: 'food' }),
    '/trips/trip-a/expenses?mode=categories&category=food',
  );
});

test('encodes and restores Map route-layer tab state for deep links', () => {
  assert.deepEqual(parseTripMapRouteDayIdsParam('day-1,day-2,,day-1'), ['day-1', 'day-2']);
  assert.deepEqual(parseTripMapRouteDayIdsParam(['day-3,day-4']), ['day-3', 'day-4']);
  assert.deepEqual(parseTripMapRouteDayIdsParam(''), []);

  assert.equal(tripMapStatePath('trip-a', { routeDayIds: [] }), '/trips/trip-a/map');
  assert.equal(
    tripMapStatePath('trip-a', { routeDayIds: ['day-1', 'day-2'] }),
    '/trips/trip-a/map?routeDays=day-1%2Cday-2',
  );
});

test('preserves known Trip tab route state when switching tabs', () => {
  assert.equal(
    tripTabPathWithState('trip-a', 'expenses', { category: 'food', dayId: 'day-3', mode: 'days' }),
    '/trips/trip-a/expenses?mode=days&dayId=day-3',
  );
  assert.equal(
    tripTabPathWithState('trip-a', 'map', { routeDays: 'day-1,day-2' }),
    '/trips/trip-a/map?routeDays=day-1%2Cday-2',
  );
  assert.equal(
    tripTabPathWithState('trip-a', 'itinerary', { dayId: 'day-2', initialAction: 'add-place' }),
    '/trips/trip-a/itinerary?dayId=day-2',
  );
  assert.equal(tripTabPathWithState('trip-a', 'settle', { dayId: 'day-2' }), '/trips/trip-a/settle');
});
