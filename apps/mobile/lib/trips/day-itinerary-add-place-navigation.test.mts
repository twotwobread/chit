import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDayItineraryAddPlaceSearchRoute,
  isDayItineraryAddPlaceReturnToDay,
  resolveDayItineraryAddPlaceReturnNavigation,
} from './day-itinerary-add-place-navigation';

const tripId = '00000000-0000-0000-0000-000000000001';
const date = '2026-07-10';
const dayRoute = `/trips/${tripId}/days/${date}`;

describe('day itinerary add-place navigation helpers', () => {
  it('marks Google place search routes launched from Day detail', () => {
    assert.equal(
      buildDayItineraryAddPlaceSearchRoute(tripId, date),
      `/trips/${tripId}/days/${date}/place-search?returnTo=day-detail`,
    );

    assert.equal(isDayItineraryAddPlaceReturnToDay('day-detail'), true);
    assert.equal(isDayItineraryAddPlaceReturnToDay(['day-detail']), true);
    assert.equal(isDayItineraryAddPlaceReturnToDay('trip-detail'), false);
    assert.equal(isDayItineraryAddPlaceReturnToDay(undefined), false);
  });

  it('dismisses back to the existing Day detail entry when search was launched from Day detail', () => {
    assert.deepEqual(resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: 'day-detail' }), {
      kind: 'dismissToDay',
      href: dayRoute,
    });
  });

  it('falls back to replacing with a single Day detail route when return intent is missing', () => {
    assert.deepEqual(resolveDayItineraryAddPlaceReturnNavigation({ tripId, date }), {
      kind: 'replaceWithDay',
      href: dayRoute,
    });
  });

  it('uses the same existing-entry return strategy for repeated add-place successes', () => {
    const firstReturn = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: ['day-detail'] });
    const secondReturn = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: ['day-detail'] });

    assert.deepEqual(firstReturn, { kind: 'dismissToDay', href: dayRoute });
    assert.deepEqual(secondReturn, firstReturn);
  });
});
