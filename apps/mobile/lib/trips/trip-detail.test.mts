import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTripDetailPrimaryAction } from './trip-detail.ts';

test('builds a single Trip Detail primary shortcut to Today', () => {
  assert.deepEqual(buildTripDetailPrimaryAction('trip-a'), {
    label: '여행 바로가기',
    route: '/trips/trip-a/today',
  });
});
