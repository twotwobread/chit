import type { MeetingListItem, TripMeetingContextInput } from '@i-um/api-contract';

export type CreateTripMeetingContextSelection =
  | { mode: 'one_off' }
  | { mode: 'existing'; meetingId: string }
  | { mode: 'new_saved'; meetingName: string };

export function defaultCreateTripMeetingContext(): CreateTripMeetingContextSelection {
  return { mode: 'one_off' };
}

export function validateCreateTripMeetingContext(
  selection: CreateTripMeetingContextSelection,
  meetings: readonly MeetingListItem[],
): string | null {
  if (selection.mode === 'existing') {
    if (!selection.meetingId.trim()) {
      return '함께할 모임을 선택해주세요.';
    }
    if (!meetings.some((meeting) => meeting.visibility === 'saved' && meeting.id === selection.meetingId)) {
      return '선택한 모임을 다시 확인해주세요.';
    }
  }
  if (selection.mode === 'new_saved' && [...selection.meetingName.trim()].length > 80) {
    return '모임 이름은 80자 이내로 입력해주세요.';
  }
  return null;
}

export function buildCreateTripMeetingContextPayload(
  selection: CreateTripMeetingContextSelection,
  tripName: string,
): TripMeetingContextInput {
  if (selection.mode === 'existing') {
    return { mode: 'existing', meetingId: selection.meetingId };
  }
  if (selection.mode === 'new_saved') {
    const meetingName = selection.meetingName.trim() || tripName.trim();
    return { mode: 'new_saved', meetingName };
  }
  return { mode: 'one_off' };
}

export function createTripMeetingContextSummary(
  selection: CreateTripMeetingContextSelection,
  meetings: readonly MeetingListItem[],
): string {
  if (selection.mode === 'existing') {
    const meeting = meetings.find((item) => item.id === selection.meetingId);
    if (!meeting) {
      return '기존 모임';
    }
    return `${meeting.name} · ${meeting.memberCount}명`;
  }
  if (selection.mode === 'new_saved') {
    const name = selection.meetingName.trim();
    return name ? `${name} · 새 모임` : '새 모임으로 저장';
  }
  return '이번만 함께하기';
}
