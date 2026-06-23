import type { TripParticipantListItem, TripParticipantRole } from '@i-um/api-contract';

import { tripRoleLabel } from './mypage';

export type ParticipantRowViewModel = {
  participantId: string;
  displayName: string;
  role: TripParticipantRole;
  roleLabel: string;
};

export type ParticipantListViewModel = {
  rows: ParticipantRowViewModel[];
};

export type ParticipantListFailureStatus = 'auth' | 'invalid' | 'notFound' | 'error';

export function buildParticipantListViewModel(participants: TripParticipantListItem[]): ParticipantListViewModel {
  return {
    rows: participants.map(toParticipantRowViewModel),
  };
}

export function toParticipantRowViewModel(participant: TripParticipantListItem): ParticipantRowViewModel {
  return {
    participantId: participant.participantId,
    displayName: participant.displayName.trim() || '여행자',
    role: participant.role,
    roleLabel: participantRoleLabel(participant.role),
  };
}

export function participantRoleLabel(role: TripParticipantRole): string {
  return tripRoleLabel(role);
}

export function participantListFailureStatus(input: { httpStatus?: number; mobileAuthCode?: string }): ParticipantListFailureStatus {
  if (input.mobileAuthCode === 'UNAUTHORIZED' || input.mobileAuthCode === 'INVALID_REFRESH_TOKEN') {
    return 'auth';
  }
  if (input.httpStatus === 401) {
    return 'auth';
  }
  if (input.httpStatus === 400) {
    return 'invalid';
  }
  if (input.httpStatus === 403 || input.httpStatus === 404) {
    return 'notFound';
  }
  return 'error';
}

export function tripParticipantsPath(tripId: string): `/trips/${string}/participants` {
  return `/trips/${tripId}/participants`;
}
