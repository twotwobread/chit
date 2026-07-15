import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAddableFlightPassengerOptions,
  canSubmitAddFlightPassengers,
  toggleFlightPassengerSelection,
  validateAddFlightPassengers,
} from './passengers.ts';

test('builds addable passenger options from current trip participants excluding existing flight passengers', () => {
  const options = buildAddableFlightPassengerOptions({
    participants: [participant('p-owner', '민수'), participant('p-late', '지영'), participant('p-friend', '하준')],
    passengers: [{ participantId: 'p-owner', displayName: '민수' }],
    selectedPassengerIds: ['p-late'],
  });

  assert.deepEqual(options, [
    { participantId: 'p-late', displayName: '지영', selected: true },
    { participantId: 'p-friend', displayName: '하준', selected: false },
  ]);
});

test('toggles one or more passenger selections without duplicating ids', () => {
  assert.deepEqual(toggleFlightPassengerSelection([], 'p-late'), ['p-late']);
  assert.deepEqual(toggleFlightPassengerSelection(['p-late'], 'p-friend'), ['p-late', 'p-friend']);
  assert.deepEqual(toggleFlightPassengerSelection(['p-late', 'p-friend'], 'p-late'), ['p-friend']);
});

test('validates passenger add submission and blocks duplicate submits while saving', () => {
  assert.equal(validateAddFlightPassengers([]), '추가할 탑승자를 1명 이상 선택해주세요.');
  assert.equal(validateAddFlightPassengers(['p-late']), null);
  assert.equal(canSubmitAddFlightPassengers(['p-late'], false), true);
  assert.equal(canSubmitAddFlightPassengers(['p-late'], true), false);
});

function participant(participantId: string, displayName: string) {
  return {
    participantId,
    displayName,
    role: 'member' as const,
    joinedAt: '2026-07-01T00:00:00Z',
  };
}
