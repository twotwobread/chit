import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetTripDetailResponse } from '@i-um/api-contract';

import { resolveTripShellDetail } from './trip-shell-detail.ts';
import type { TripShellState } from './trip-shell-context.tsx';

function detail(id = 'trip-a'): GetTripDetailResponse {
  return {
    trip: {
      id,
      name: '오사카',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      defaultCurrency: 'KRW',
      createdBy: 'user-1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      destinations: [],
    },
    participantSummary: { overflowCount: 0, previewNames: ['민수'], totalCount: 1 },
    days: [],
  };
}

test('resolves matching successful shell detail for tab controllers', () => {
  const shellState: TripShellState = { status: 'success', tripId: 'trip-a', detail: detail('trip-a') };

  assert.deepEqual(resolveTripShellDetail(shellState, 'trip-a'), {
    status: 'success',
    detail: shellState.detail,
  });
});

test('keeps tab controllers pending while the shell is loading or for another trip', () => {
  assert.deepEqual(resolveTripShellDetail({ status: 'loading', tripId: 'trip-a' }, 'trip-a'), { status: 'pending' });
  assert.deepEqual(
    resolveTripShellDetail({ status: 'success', tripId: 'trip-b', detail: detail('trip-b') }, 'trip-a'),
    {
      status: 'pending',
    },
  );
});

test('maps shell terminal failures to tab controller states', () => {
  assert.deepEqual(resolveTripShellDetail({ status: 'auth', tripId: 'trip-a' }, 'trip-a'), { status: 'auth' });
  assert.deepEqual(resolveTripShellDetail({ status: 'notFound', tripId: 'trip-a' }, 'trip-a'), { status: 'notFound' });
  assert.deepEqual(resolveTripShellDetail({ status: 'error', tripId: 'trip-a' }, 'trip-a'), { status: 'error' });
  assert.deepEqual(resolveTripShellDetail(null, 'trip-a'), { status: 'pending' });
  assert.deepEqual(
    resolveTripShellDetail({ status: 'success', tripId: 'trip-a', detail: detail('trip-a') }, undefined),
    {
      status: 'notFound',
    },
  );
});
