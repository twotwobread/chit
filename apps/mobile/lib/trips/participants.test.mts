import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripParticipantListItem } from '@i-um/api-contract';

import {
  buildParticipantListViewModel,
  participantListFailureStatus,
  participantRemovalFailureMessage,
  participantRemovalFailureStatus,
  participantRoleLabel,
  removeParticipantFromViewModel,
  tripParticipantsPath,
} from './participants.ts';

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
    { participantId: 'participant-owner', displayName: '민수', role: 'owner', roleLabel: '주최자', canRemove: false },
    { participantId: 'participant-member', displayName: '여행자', role: 'member', roleLabel: '동행자', canRemove: false },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(viewModel.rows[0], 'joinedAt'), false);
});

test('marks only member rows removable when the current user can remove members', () => {
  const viewModel = buildParticipantListViewModel(
    [
      participant({ participantId: 'participant-owner', displayName: '민수', role: 'owner' }),
      participant({ participantId: 'participant-member', displayName: '지영', role: 'member' }),
    ],
    { canRemoveMembers: true },
  );

  assert.equal(viewModel.rows[0].canRemove, false);
  assert.equal(viewModel.rows[1].canRemove, true);
});

test('removes a participant row from the participant list view model', () => {
  const viewModel = buildParticipantListViewModel(
    [
      participant({ participantId: 'participant-owner', role: 'owner' }),
      participant({ participantId: 'participant-member', role: 'member' }),
    ],
    { canRemoveMembers: true },
  );

  assert.deepEqual(removeParticipantFromViewModel(viewModel, 'participant-member').rows, [
    { participantId: 'participant-owner', displayName: '민수', role: 'owner', roleLabel: '주최자', canRemove: false },
  ]);
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

test('maps participant removal failures without exposing target details', () => {
  const genericMessage = '참여자를 제거할 수 없어요. 잠시 후 다시 시도해주세요.';

  assert.equal(participantRemovalFailureStatus({ mobileAuthCode: 'UNAUTHORIZED' }), 'auth');
  assert.equal(participantRemovalFailureStatus({ mobileAuthCode: 'INVALID_REFRESH_TOKEN' }), 'auth');
  assert.equal(participantRemovalFailureStatus({ httpStatus: 401 }), 'auth');
  assert.equal(participantRemovalFailureStatus({ httpStatus: 400 }), 'error');
  assert.equal(participantRemovalFailureStatus({ httpStatus: 403 }), 'error');
  assert.equal(participantRemovalFailureStatus({ httpStatus: 404 }), 'error');
  assert.equal(participantRemovalFailureMessage({ httpStatus: 400 }), genericMessage);
  assert.equal(participantRemovalFailureMessage({ httpStatus: 403 }), genericMessage);
  assert.equal(participantRemovalFailureMessage({ httpStatus: 404 }), genericMessage);
  assert.equal(participantRemovalFailureMessage({}), genericMessage);
  assert.equal(participantRemovalFailureMessage({ httpStatus: 401 }), '다시 로그인해주세요.');
});

test('builds the participant list route for trip detail navigation', () => {
  assert.equal(tripParticipantsPath('trip_123'), '/trips/trip_123/participants');
});
