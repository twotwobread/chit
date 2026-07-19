import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDestinationInput } from '@i-um/api-contract';

import {
  applySuggestedTripName,
  createTripWizardSteps,
  nextCreateTripWizardStep,
  previousCreateTripWizardStep,
  suggestTripName,
} from './create-trip-wizard';

const osaka: TripDestinationInput = {
  cityName: '오사카',
  countryName: '일본',
  countryCode: 'JP',
  displayName: '오사카, 일본',
  latitude: 34.6937,
  longitude: 135.5023,
  radiusMeters: 25000,
  provider: 'google',
  providerPlaceId: 'google-city-osaka',
};

const kyoto: TripDestinationInput = {
  cityName: '교토',
  countryName: '일본',
  countryCode: 'JP',
  displayName: '교토, 일본',
  latitude: 35.0116,
  longitude: 135.7681,
  radiusMeters: 25000,
  provider: 'google',
  providerPlaceId: 'google-city-kyoto',
};

describe('create trip wizard helpers', () => {
  it('defines the four-step creation flow and clamps previous/next navigation', () => {
    assert.deepEqual(createTripWizardSteps, ['destinations', 'dates', 'settings', 'review']);
    assert.equal(nextCreateTripWizardStep('destinations'), 'dates');
    assert.equal(nextCreateTripWizardStep('dates'), 'settings');
    assert.equal(nextCreateTripWizardStep('settings'), 'review');
    assert.equal(nextCreateTripWizardStep('review'), 'review');
    assert.equal(previousCreateTripWizardStep('review'), 'settings');
    assert.equal(previousCreateTripWizardStep('settings'), 'dates');
    assert.equal(previousCreateTripWizardStep('dates'), 'destinations');
    assert.equal(previousCreateTripWizardStep('destinations'), 'destinations');
  });

  it('suggests editable trip names from destinations and date range', () => {
    assert.equal(suggestTripName([osaka], '2026-07-10', '2026-07-13'), '오사카 3박 4일');
    assert.equal(suggestTripName([osaka, kyoto], '2026-07-10', '2026-07-14'), '오사카·교토 4박 5일');
    assert.equal(suggestTripName([osaka], '2026-07-10', '2026-07-10'), '오사카 당일치기');
    assert.equal(suggestTripName([], '2026-07-10', '2026-07-13'), '새 여행');
    assert.equal(suggestTripName([osaka], '', ''), '오사카 여행');
  });

  it('keeps manual trip names until the user explicitly resets to the suggestion', () => {
    assert.equal(applySuggestedTripName('', '오사카 3박 4일', false), '오사카 3박 4일');
    assert.equal(applySuggestedTripName('여름휴가', '오사카 3박 4일', true), '여름휴가');
    assert.equal(applySuggestedTripName('여름휴가', '오사카 3박 4일', false), '오사카 3박 4일');
  });
});
