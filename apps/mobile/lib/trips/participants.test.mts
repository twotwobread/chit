import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripParticipantListItem } from '@i-um/api-contract';

import { buildParticipantListViewModel, participantListFailureStatus, participantRoleLabel, tripParticipantsPath } from './participants.ts';

function participant(overrides: Partial<TripParticipantListItem>): TripParticipantListItem {
  return {
    participantId: 'participant-1',
    displayName: '민수',
    role: 'owner',
    joinedAt: '2026-06-21T15:00:00Z',
    ...overrides,
  };
}

test('formats participant role labels for the participant list', () => {
  assert.equal(participantRoleLabel('owner'), '주최자');
  assert.equal(participantRoleLabel('member'), '동행자');
});

test('builds participant rows without exposing joinedAt in the row view model', () => {
  const viewModel = buildParticipantListViewModel([
    participant({ participantId: 'participant-owner', displayName: ' 민수 ', role: 'owner' }),
    participant({ participantId: 'participant-member', displayName: '', role: 'member' }),
  ]);

  assert.deepEqual(viewModel.rows, [
    { participantId: 'participant-owner', displayName: '민수', role: 'owner', roleLabel: '주최자' },
    { participantId: 'participant-member', displayName: '여행자', role: 'member', roleLabel: '동행자' },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(viewModel.rows[0], 'joinedAt'), false);
});

test('maps participant list failures to user-facing screen states', () => {
  assert.equal(participantListFailureStatus({ mobileAuthCode: 'UNAUTHORIZED' }), 'auth');
  assert.equal(participantListFailureStatus({ mobileAuthCode: 'INVALID_REFRESH_TOKEN' }), 'auth');
  assert.equal(participantListFailureStatus({ httpStatus: 401 }), 'auth');
  assert.equal(participantListFailureStatus({ httpStatus: 400 }), 'invalid');
  assert.equal(participantListFailureStatus({ httpStatus: 403 }), 'notFound');
  assert.equal(participantListFailureStatus({ httpStatus: 404 }), 'notFound');
  assert.equal(participantListFailureStatus({ httpStatus: 500 }), 'error');
  assert.equal(participantListFailureStatus({}), 'error');
});

test('builds the participant list route for trip detail navigation', () => {
  assert.equal(tripParticipantsPath('trip_123'), '/trips/trip_123/participants');
});
