import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTripRootTab,
  isTripRootTabPath,
  tripDetailPath,
  tripFallbackPath,
  tripFallbackPathForPathname,
  tripItineraryDayPath,
  tripItineraryPath,
  tripMapPath,
  tripParticipantsPath,
  tripRootPath,
  tripSettlePath,
  tripTabPath,
  tripTodayPath,
} from './routes.ts';

test('builds canonical trip tab and hidden detail paths', () => {
  assert.equal(tripRootPath('trip-a'), '/trips/trip-a');
  assert.equal(tripTodayPath('trip-a'), '/trips/trip-a/today');
  assert.equal(tripMapPath('trip-a'), '/trips/trip-a/map');
  assert.equal(tripItineraryPath('trip-a'), '/trips/trip-a/itinerary');
  assert.equal(tripItineraryDayPath('trip-a', 'day-1'), '/trips/trip-a/itinerary?dayId=day-1');
  assert.equal(tripSettlePath('trip-a'), '/trips/trip-a/settle');
  assert.equal(tripDetailPath('trip-a'), '/trips/trip-a/detail');
  assert.equal(tripParticipantsPath('trip-a'), '/trips/trip-a/participants');
});

test('maps tab names to canonical tab roots', () => {
  assert.equal(tripTabPath('trip-a', 'today'), '/trips/trip-a/today');
  assert.equal(tripTabPath('trip-a', 'map'), '/trips/trip-a/map');
  assert.equal(tripTabPath('trip-a', 'itinerary'), '/trips/trip-a/itinerary');
  assert.equal(tripTabPath('trip-a', 'settle'), '/trips/trip-a/settle');
});

test('recognizes concrete trip root tab route names for custom tab navigation', () => {
  assert.equal(isTripRootTab('today'), true);
  assert.equal(isTripRootTab('map'), true);
  assert.equal(isTripRootTab('itinerary'), true);
  assert.equal(isTripRootTab('settle'), true);
  assert.equal(isTripRootTab('detail'), false);
  assert.equal(isTripRootTab('(tabs)'), false);
});

test('encodes no-history fallback matrix for trip shell routes', () => {
  assert.equal(tripFallbackPath({ kind: 'rootTab', tripId: 'trip-a' }), '/');
  assert.equal(tripFallbackPath({ kind: 'detail', tripId: 'trip-a' }), '/');
  assert.equal(tripFallbackPath({ kind: 'edit', tripId: 'trip-a' }), '/trips/trip-a/detail');
  assert.equal(tripFallbackPath({ kind: 'participants', tripId: 'trip-a' }), '/trips/trip-a/detail');
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
  assert.equal(isTripRootTabPath('/trips/trip-a/settle', 'trip-a'), true);
  assert.equal(isTripRootTabPath('/trips/trip-a/detail', 'trip-a'), false);
  assert.equal(isTripRootTabPath('/trips/trip-b/today', 'trip-a'), false);
});
