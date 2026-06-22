import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginTripDelete,
  cancelTripDelete,
  deleteTripFailureState,
  openTripDeleteConfirmation,
  type TripDeleteState,
} from './delete-flow.ts';

const idle: TripDeleteState = { status: 'idle' };

test('delete starts from an explicit confirmation state', () => {
  assert.deepEqual(openTripDeleteConfirmation(idle), { status: 'confirming' });
  assert.deepEqual(cancelTripDelete({ status: 'confirming' }), idle);
});

test('begin delete only works after confirmation and blocks duplicate submit', () => {
  assert.deepEqual(beginTripDelete(idle), idle);
  assert.deepEqual(beginTripDelete({ status: 'confirming' }), { status: 'deleting' });
  assert.deepEqual(beginTripDelete({ status: 'deleting' }), { status: 'deleting' });
});

test('maps delete failures to user-facing states', () => {
  assert.deepEqual(deleteTripFailureState(401), { status: 'auth', message: '다시 로그인해주세요.' });
  assert.deepEqual(deleteTripFailureState(400), {
    status: 'safeFailure',
    message: '여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.',
  });
  assert.deepEqual(deleteTripFailureState(403), {
    status: 'safeFailure',
    message: '여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.',
  });
  assert.deepEqual(deleteTripFailureState(404), {
    status: 'safeFailure',
    message: '여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.',
  });
  assert.deepEqual(deleteTripFailureState(500), {
    status: 'error',
    message: '여행을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.',
  });
});
