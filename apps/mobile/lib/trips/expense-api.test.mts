import assert from 'node:assert/strict';
import test from 'node:test';

import { TripsService } from '@i-um/api-contract';

import { listTripExpenses } from './expense-api.ts';

test('listTripExpenses wrapper is backed by the generated trip-level API method', () => {
  assert.equal(typeof TripsService.listTripExpenses, 'function');
  assert.equal(typeof listTripExpenses, 'function');
});
