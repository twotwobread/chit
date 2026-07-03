import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDayItineraryAddPlaceSearchRoute,
  isDayItineraryAddPlaceReturnToDay,
  resolveDayItineraryAddPlaceReturnNavigation,
} from './day-itinerary-add-place-navigation';

const tripId = '00000000-0000-0000-0000-000000000001';
const date = '2026-07-10';
const itineraryDayRoute = `/trips/${tripId}/itinerary?dayId=${date}`;

describe('day itinerary add-place navigation helpers', () => {
  it('marks Google place search routes launched from the itinerary tab', () => {
    assert.equal(
      buildDayItineraryAddPlaceSearchRoute(tripId, date),
      `/trips/${tripId}/days/${date}/place-search?returnTo=itinerary-tab`,
    );

    assert.equal(isDayItineraryAddPlaceReturnToDay('itinerary-tab'), true);
    assert.equal(isDayItineraryAddPlaceReturnToDay(['itinerary-tab']), true);
    assert.equal(isDayItineraryAddPlaceReturnToDay('day-detail'), false);
    assert.equal(isDayItineraryAddPlaceReturnToDay('trip-detail'), false);
    assert.equal(isDayItineraryAddPlaceReturnToDay(undefined), false);
  });

  it('dismisses back to the existing itinerary tab entry when search was launched from itinerary', () => {
    assert.deepEqual(resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: 'itinerary-tab' }), {
      kind: 'dismissToDay',
      href: itineraryDayRoute,
    });
  });

  it('falls back to replacing with the itinerary tab selected day route when return intent is missing', () => {
    assert.deepEqual(resolveDayItineraryAddPlaceReturnNavigation({ tripId, date }), {
      kind: 'replaceWithDay',
      href: itineraryDayRoute,
    });
  });

  it('uses the same existing-entry return strategy for repeated add-place successes', () => {
    const firstReturn = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: ['itinerary-tab'] });
    const secondReturn = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: ['itinerary-tab'] });

    assert.deepEqual(firstReturn, { kind: 'dismissToDay', href: itineraryDayRoute });
    assert.deepEqual(secondReturn, firstReturn);
  });
});
