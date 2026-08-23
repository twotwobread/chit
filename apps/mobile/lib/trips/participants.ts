import type { TripParticipantListItem, TripParticipantRole } from '@i-um/api-contract';

import type { Participant as CompanionSheetParticipant } from '../trip-ui/CompanionsSheet';
import { tripRoleLabel } from './mypage';

export type ParticipantRowViewModel = {
  participantId: string;
  displayName: string;
  role: TripParticipantRole;
  roleLabel: string;
  canRemove: boolean;
};

export type ParticipantListViewModel = {
  rows: ParticipantRowViewModel[];
};

export type ParticipantListOptions = {
  canRemoveMembers?: boolean;
};

export type ParticipantListFailureStatus = 'auth' | 'invalid' | 'notFound' | 'error';
export type ParticipantRemovalFailureStatus = 'auth' | 'error';

const participantRemovalGenericErrorMessage = '참여자를 제거할 수 없어요. 잠시 후 다시 시도해주세요.';
const participantRemovalAuthErrorMessage = '다시 로그인해주세요.';

export function buildParticipantListViewModel(
  participants: TripParticipantListItem[],
  options: ParticipantListOptions = {},
): ParticipantListViewModel {
  return {
    rows: participants.map((participant) => toParticipantRowViewModel(participant, options)),
  };
}

export function toParticipantRowViewModel(
  participant: TripParticipantListItem,
  options: ParticipantListOptions = {},
): ParticipantRowViewModel {
  return {
    participantId: participant.participantId,
    displayName: participant.displayName.trim() || '참여자',
    role: participant.role,
    roleLabel: participantRoleLabel(participant.role),
    canRemove: Boolean(options.canRemoveMembers && participant.role === 'member'),
  };
}

export function removeParticipantFromViewModel(
  viewModel: ParticipantListViewModel,
  participantId: string,
): ParticipantListViewModel {
  return {
    rows: viewModel.rows.filter((participant) => participant.participantId !== participantId),
  };
}

export function buildCompanionSheetParticipants(
  viewModel: ParticipantListViewModel,
  currentUserId: string | null | undefined,
): CompanionSheetParticipant[] {
  return viewModel.rows.map((participant) => ({
    id: participant.participantId,
    name: participant.displayName,
    role: participant.role,
    isMe: Boolean(currentUserId && participant.participantId === currentUserId),
  }));
}

export function participantRoleLabel(role: TripParticipantRole): string {
  return tripRoleLabel(role);
}

export function participantListFailureStatus(input: {
  httpStatus?: number;
  mobileAuthCode?: string;
}): ParticipantListFailureStatus {
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

export function participantRemovalFailureStatus(input: {
  httpStatus?: number;
  mobileAuthCode?: string;
}): ParticipantRemovalFailureStatus {
  if (input.mobileAuthCode === 'UNAUTHORIZED' || input.mobileAuthCode === 'INVALID_REFRESH_TOKEN') {
    return 'auth';
  }
  if (input.httpStatus === 401) {
    return 'auth';
  }
  return 'error';
}

export function participantRemovalFailureMessage(input: { httpStatus?: number; mobileAuthCode?: string }): string {
  if (participantRemovalFailureStatus(input) === 'auth') {
    return participantRemovalAuthErrorMessage;
  }
  return participantRemovalGenericErrorMessage;
}

export function tripParticipantsPath(tripId: string): `/trips/${string}/participants` {
  return `/trips/${tripId}/participants`;
}
