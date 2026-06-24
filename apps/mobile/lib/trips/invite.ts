import type { CreateTripInviteResponse, GetTripDetailResponse } from '@i-um/api-contract';
import type { ShareContent } from 'react-native';
import type { TextTemplateType } from 'react-native-kakao-share-link';

export const invitePlaceholderMessage = '초대 링크를 열었어요. 참여 기능은 곧 지원될 예정이에요.';

export type InviteShareInput = {
  tripName: string;
  inviteUrl: string;
};

export type InviteViewModel = {
  token: string;
  inviteUrl: string;
  expiresAt: string;
  expiryLabel: string;
  statusLabel: string;
};

export function canCreateTripInvite(tripDetail: GetTripDetailResponse | null, currentUserId: string | null | undefined): boolean {
  return Boolean(tripDetail && currentUserId && tripDetail.trip.createdBy === currentUserId);
}

export function toInviteViewModel(response: CreateTripInviteResponse): InviteViewModel {
  return {
    token: response.invite.token,
    inviteUrl: response.invite.inviteUrl,
    expiresAt: response.invite.expiresAt,
    expiryLabel: `만료: ${formatInviteExpiry(response.invite.expiresAt)}`,
    statusLabel: response.created ? '초대 링크가 준비됐어요.' : '기존 초대 링크를 불러왔어요.',
  };
}

export function buildInviteCopyText(inviteUrl: string): string {
  return inviteUrl;
}

export function buildKakaoInviteTemplate(input: InviteShareInput): TextTemplateType {
  const text = `${input.tripName} 여행에 초대받았어요.\n이음에서 함께 일정을 확인해보세요.\n${input.inviteUrl}`;
  const link = { webUrl: input.inviteUrl, mobileWebUrl: input.inviteUrl };

  return {
    text,
    link,
    buttons: [
      {
        title: '이음에서 참여하기',
        link,
      },
    ],
  };
}

export function buildFallbackShareContent(input: InviteShareInput): ShareContent {
  return {
    title: '이음 여행 초대',
    message: `${input.tripName} 여행에 초대받았어요.\n${input.inviteUrl}`,
    url: input.inviteUrl,
  };
}

export function getInviteActionErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'FORBIDDEN') {
    return '여행 Owner만 초대 링크를 만들 수 있어요.';
  }
  if (code === 'NOT_FOUND') {
    return '여행을 찾을 수 없어요.';
  }
  return '초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.';
}

export function getKakaoShareFailureMessage(): string {
  return '카카오톡 공유를 열 수 없어요. 링크를 복사하거나 다른 앱으로 공유해보세요.';
}

function formatInviteExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
