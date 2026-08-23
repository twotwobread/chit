import type { GetTripDetailResponse } from '@i-um/api-contract';

export type PromoteMeetingState =
  | { status: 'idle'; message?: string }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export function canShowOneOffMeetingPromotion(detail: GetTripDetailResponse, currentUserId?: string): boolean {
  return (
    detail.trip.eventContext?.meetingVisibility === 'one_off' &&
    Boolean(currentUserId) &&
    currentUserId === detail.trip.createdBy
  );
}

export function buildPromoteMeetingDefaultName(detail: GetTripDetailResponse): string {
  return detail.trip.name.trim() || detail.trip.eventContext?.meetingName?.trim() || '새 모임';
}

export function validatePromoteMeetingName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return '모임 이름을 입력해주세요.';
  }
  if ([...trimmed].length > 80) {
    return '모임 이름은 80자 이내로 입력해주세요.';
  }
  return null;
}

export function buildPromoteMeetingSuccessMessage(meetingName: string): string {
  return `${meetingName.trim() || '모임'}을 내 모임에 저장했어요.`;
}

export function promoteMeetingFailureMessage(status?: number): string {
  switch (status) {
    case 400:
      return '모임 이름을 다시 확인해주세요.';
    case 401:
      return '다시 로그인한 뒤 모임으로 저장해주세요.';
    case 403:
      return '모임으로 저장할 권한이 없어요.';
    case 404:
      return '일정 정보를 찾을 수 없어요.';
    case 409:
      return '이미 저장된 모임이거나 이번만 일정이 아니에요.';
    default:
      return '모임으로 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
  }
}
