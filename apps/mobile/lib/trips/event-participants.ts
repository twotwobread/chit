import type { MeetingMember, TripParticipantListItem } from '@i-um/api-contract';

import { meetingMemberRoleLabel } from './meeting-detail';

export type EventParticipantSelectionRow = {
  memberId: string;
  displayName: string;
  roleLabel: string;
  selected: boolean;
  disabled: boolean;
  isCurrentUser: boolean;
};

export function buildDefaultEventParticipantMemberIds(members: readonly MeetingMember[]): string[] {
  return sortMeetingMembers(members).map((member) => member.id);
}

export function toggleEventParticipantMemberId(
  selectedMemberIds: readonly string[],
  memberId: string,
  members: readonly MeetingMember[],
): string[] {
  const member = members.find((item) => item.id === memberId);
  if (!member) {
    return [...selectedMemberIds];
  }
  const selected = new Set(selectedMemberIds);
  if (selected.has(memberId)) {
    selected.delete(memberId);
  } else {
    selected.add(memberId);
  }
  return sortMeetingMembers(members)
    .filter((item) => selected.has(item.id))
    .map((item) => item.id);
}

export function validateEventParticipantSelection(
  members: readonly MeetingMember[],
  selectedMemberIds: readonly string[],
  currentUserId: string | null | undefined,
): string | null {
  if (selectedMemberIds.length === 0) {
    return '이번 일정 참여자를 1명 이상 선택해주세요.';
  }
  const memberIds = new Set(members.map((member) => member.id));
  if (selectedMemberIds.some((memberId) => !memberIds.has(memberId))) {
    return '참여자 선택을 다시 확인해주세요.';
  }
  const currentUserMember = members.find((member) => member.userId === currentUserId);
  if (currentUserMember && !selectedMemberIds.includes(currentUserMember.id)) {
    return '내가 참여자로 포함되어야 일정을 만들 수 있어요.';
  }
  return null;
}

export function buildEventParticipantSelectionRows(
  members: readonly MeetingMember[],
  selectedMemberIds: readonly string[],
  currentUserId: string | null | undefined,
): EventParticipantSelectionRow[] {
  const selected = new Set(selectedMemberIds);
  return sortMeetingMembers(members).map((member) => {
    const isCurrentUser = member.userId === currentUserId;
    return {
      memberId: member.id,
      displayName: normalizeDisplayName(member.displayName),
      roleLabel: meetingMemberRoleLabel(member.role),
      selected: selected.has(member.id),
      disabled: isCurrentUser,
      isCurrentUser,
    };
  });
}

export function eventParticipantSelectionSummary(
  members: readonly MeetingMember[],
  selectedMemberIds: readonly string[],
): string {
  return `${members.length}명 중 ${selectedMemberIds.length}명 선택`;
}

export function selectedMemberIdsFromTripParticipants(
  members: readonly MeetingMember[],
  participants: readonly TripParticipantListItem[],
): string[] {
  const participantUserIds = new Set(participants.map((participant) => participant.userId));
  return sortMeetingMembers(members)
    .filter((member) => participantUserIds.has(member.userId))
    .map((member) => member.id);
}

export function areEventParticipantSelectionsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  return right.every((id) => leftSet.has(id));
}

function sortMeetingMembers(members: readonly MeetingMember[]): MeetingMember[] {
  return [...members].sort((left, right) => {
    const roleCompare = roleOrder(left.role) - roleOrder(right.role);
    if (roleCompare !== 0) {
      return roleCompare;
    }
    return left.joinedAt.localeCompare(right.joinedAt) || left.id.localeCompare(right.id);
  });
}

function roleOrder(role: MeetingMember['role']): number {
  return role === 'owner' ? 0 : 1;
}

function normalizeDisplayName(value: string): string {
  const trimmed = value.trim();
  return trimmed || '참여자';
}
