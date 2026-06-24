import type { AcceptTripInviteResponse, CreateTripInviteResponse, GetTripDetailResponse } from '@i-um/api-contract';
import type { ShareContent } from 'react-native';
import type { TextTemplateType } from 'react-native-kakao-share-link';

const inviteTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

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

export type InviteAcceptAction = 'viewTrip' | 'login' | 'home' | 'retry';

export type InviteAcceptViewModel = {
  kind: 'accepted' | 'alreadyMember' | 'ownerAlready' | 'loginRequired' | 'authRequired' | 'expired' | 'invalid' | 'retryableError';
  title: string;
  message: string;
  primaryAction: InviteAcceptAction;
  primaryLabel: string;
  secondaryAction?: InviteAcceptAction;
  secondaryLabel?: string;
  tripId?: string;
  tripName?: string;
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

export function isInviteTokenFormatValid(token: string | null | undefined): token is string {
  return typeof token === 'string' && inviteTokenPattern.test(token.trim());
}

export function toInviteAcceptViewModel(response: AcceptTripInviteResponse): InviteAcceptViewModel {
  if (response.role === 'owner' && response.alreadyAccepted) {
    return {
      kind: 'ownerAlready',
      title: '이미 주최자로 참여 중인 여행이에요.',
      message: `${response.tripName} 여행으로 이동할 수 있어요.`,
      primaryAction: 'viewTrip',
      primaryLabel: '여행 보기',
      tripId: response.tripId,
      tripName: response.tripName,
    };
  }

  if (response.alreadyAccepted) {
    return {
      kind: 'alreadyMember',
      title: '이미 참여 중인 여행이에요.',
      message: `${response.tripName} 여행으로 이동할 수 있어요.`,
      primaryAction: 'viewTrip',
      primaryLabel: '여행 보기',
      tripId: response.tripId,
      tripName: response.tripName,
    };
  }

  return {
    kind: 'accepted',
    title: '여행에 참여했어요.',
    message: `${response.tripName} 여행을 함께 볼 수 있어요.`,
    primaryAction: 'viewTrip',
    primaryLabel: '여행 보기',
    tripId: response.tripId,
    tripName: response.tripName,
  };
}

export function buildInviteLoginRequiredViewModel(): InviteAcceptViewModel {
  return {
    kind: 'loginRequired',
    title: '로그인이 필요합니다.',
    message: '로그인 후 초대 링크를 다시 열어주세요.',
    primaryAction: 'login',
    primaryLabel: '로그인하기',
    secondaryAction: 'home',
    secondaryLabel: '홈으로',
  };
}

export function buildInviteAuthRequiredViewModel(): InviteAcceptViewModel {
  return {
    kind: 'authRequired',
    title: '다시 로그인해주세요.',
    message: '로그인 후 초대 링크를 다시 열어주세요.',
    primaryAction: 'login',
    primaryLabel: '로그인하기',
    secondaryAction: 'home',
    secondaryLabel: '홈으로',
  };
}

export function buildInviteInvalidViewModel(): InviteAcceptViewModel {
  return {
    kind: 'invalid',
    title: '초대 링크를 확인할 수 없어요.',
    message: '링크가 잘못되었거나 더 이상 사용할 수 없어요.',
    primaryAction: 'home',
    primaryLabel: '홈으로',
  };
}

export function getInviteAcceptErrorViewModel(error: unknown): InviteAcceptViewModel {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  if (status === 401 || code === 'UNAUTHORIZED' || code === 'INVALID_REFRESH_TOKEN') {
    return buildInviteAuthRequiredViewModel();
  }
  if (status === 410 || code === 'INVITE_EXPIRED') {
    return {
      kind: 'expired',
      title: '초대 링크가 만료됐어요.',
      message: '주최자에게 새 링크를 요청해주세요.',
      primaryAction: 'home',
      primaryLabel: '홈으로',
    };
  }
  if (status === 400 || status === 404 || code === 'VALIDATION_ERROR' || code === 'INVITE_NOT_FOUND') {
    return buildInviteInvalidViewModel();
  }

  return {
    kind: 'retryableError',
    title: '초대 링크를 확인할 수 없어요.',
    message: '잠시 후 다시 시도해주세요.',
    primaryAction: 'retry',
    primaryLabel: '다시 시도',
    secondaryAction: 'home',
    secondaryLabel: '홈으로',
  };
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

function getErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number(error.status);
    return Number.isFinite(status) ? status : null;
  }
  return null;
}

function getErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (!('body' in error) || typeof error.body !== 'object' || error.body === null) {
    return '';
  }
  const body = error.body as { error?: { code?: unknown } };
  return typeof body.error?.code === 'string' ? body.error.code : '';
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
