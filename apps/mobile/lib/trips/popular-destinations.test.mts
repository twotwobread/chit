import assert from 'node:assert/strict';
import { test } from 'node:test';

import { destinationKey } from './destinations';
import {
  filterPopularTripDestinations,
  popularTripDestinationSearchResults,
  popularTripDestinations,
} from './popular-destinations';

test('popular trip destinations are ranked curated city rows for the initial wizard list', () => {
  assert.equal(popularTripDestinations.length >= 12, true);
  assert.deepEqual(
    popularTripDestinations.slice(0, 4).map((destination) => destination.cityName),
    ['오사카', '도쿄', '후쿠오카', '제주'],
  );
  assert.deepEqual(
    popularTripDestinations.slice(0, 2).map((destination) => destination.nearbySummary),
    ['오사카, 교토, 고베, 나라', '도쿄, 하코네, 요코하마, 가마쿠라'],
  );
  assert.deepEqual(
    popularTripDestinationSearchResults.slice(0, 2).map((destination) => destination.displayName),
    ['오사카, 일본', '도쿄, 일본'],
  );
});

test('popular trip destination filtering matches Korean English country and alias keywords while preserving rank', () => {
  assert.deepEqual(
    filterPopularTripDestinations('오사').map((destination) => destination.cityName),
    ['오사카'],
  );
  assert.deepEqual(
    filterPopularTripDestinations('japan', 3).map((destination) => destination.cityName),
    ['오사카', '도쿄', '후쿠오카'],
  );
  assert.deepEqual(
    filterPopularTripDestinations('대만').map((destination) => destination.cityName),
    ['타이베이'],
  );
});

test('popular trip destinations keep create-trip compatible provider identity and image keys', () => {
  const keys = popularTripDestinationSearchResults.map(destinationKey);

  assert.equal(new Set(keys).size, keys.length);
  for (const destination of popularTripDestinations) {
    assert.equal(destination.provider, 'google');
    assert.match(destination.providerPlaceId, /^google-city-/);
    assert.equal(destination.countryCode, destination.countryCode.toUpperCase());
    assert.equal(destination.imageKey.length > 0, true);
    assert.equal(destination.latitude >= -90 && destination.latitude <= 90, true);
    assert.equal(destination.longitude >= -180 && destination.longitude <= 180, true);
    assert.equal(destination.radiusMeters > 0, true);
  }
});
