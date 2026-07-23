import assert from 'node:assert/strict';
import test from 'node:test';

import { TripsService } from '@i-um/api-contract';

import { createManualTripPlace, listTripExpenses } from './expense-api.ts';

test('listTripExpenses wrapper is backed by the generated trip-level API method', () => {
  assert.equal(typeof TripsService.listTripExpenses, 'function');
  assert.equal(typeof listTripExpenses, 'function');
  assert.equal(TripsService.listTripExpenses.length, 2);
  assert.equal(listTripExpenses.length, 2);
});

test('createManualTripPlace wrapper is backed by the generated trip-place-only API method', () => {
  assert.equal(typeof TripsService.createManualTripPlace, 'function');
  assert.equal(typeof createManualTripPlace, 'function');
});
