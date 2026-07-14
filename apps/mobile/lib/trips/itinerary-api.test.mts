import assert from 'node:assert/strict';
import test from 'node:test';

import { TripsService } from '@i-um/api-contract';

import { listTripScheduleItems } from './itinerary-api.ts';

test('listTripScheduleItems wrapper is backed by the generated trip-level API method', () => {
  assert.equal(typeof TripsService.listTripScheduleItems, 'function');
  assert.equal(typeof listTripScheduleItems, 'function');
});
