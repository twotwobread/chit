import { isInviteTokenFormatValid } from './invite';

export const LOGIN_GENERIC_SUBTITLE = '일정을 함께 이어가려면 로그인해주세요.';
export const LOGIN_INVITE_HANDOFF_SUBTITLE = '로그인하면 이 초대 링크로 돌아와요.';

export type InviteLoginReturnPath = `/invite/${string}`;

export type PendingInviteLoginHandoff = {
  token: string;
  returnPath: InviteLoginReturnPath;
};

let pendingInviteLoginHandoff: PendingInviteLoginHandoff | null = null;

export function buildInviteLoginReturnPath(token: string | null | undefined): InviteLoginReturnPath | null {
  if (typeof token !== 'string') {
    return null;
  }
  const normalizedToken = token.trim();
  if (!isInviteTokenFormatValid(normalizedToken)) {
    return null;
  }
  return `/invite/${normalizedToken}`;
}

export function parseInviteLoginReturnPath(path: string | null | undefined): PendingInviteLoginHandoff | null {
  if (typeof path !== 'string') {
    return null;
  }
  const match = /^\/invite\/([^/?#]+)$/.exec(path);
  if (!match) {
    return null;
  }
  const token = match[1];
  if (token !== token.trim() || !isInviteTokenFormatValid(token)) {
    return null;
  }
  return { token, returnPath: `/invite/${token}` };
}

export function setPendingInviteLoginHandoffForToken(
  token: string | null | undefined,
): PendingInviteLoginHandoff | null {
  const returnPath = buildInviteLoginReturnPath(token);
  if (!returnPath) {
    return null;
  }
  const handoff = parseInviteLoginReturnPath(returnPath);
  pendingInviteLoginHandoff = handoff;
  return handoff;
}

export function peekPendingInviteLoginHandoff(): PendingInviteLoginHandoff | null {
  if (!pendingInviteLoginHandoff) {
    return null;
  }
  const handoff = parseInviteLoginReturnPath(pendingInviteLoginHandoff.returnPath);
  if (!handoff || handoff.token !== pendingInviteLoginHandoff.token) {
    pendingInviteLoginHandoff = null;
    return null;
  }
  return handoff;
}

export function consumePendingInviteLoginHandoff(): PendingInviteLoginHandoff | null {
  const handoff = peekPendingInviteLoginHandoff();
  pendingInviteLoginHandoff = null;
  return handoff;
}

export function clearPendingInviteLoginHandoff(): void {
  pendingInviteLoginHandoff = null;
}

export function getLoginSubtitleForInviteHandoff(): string {
  return peekPendingInviteLoginHandoff() ? LOGIN_INVITE_HANDOFF_SUBTITLE : LOGIN_GENERIC_SUBTITLE;
}

export function consumeInviteLoginRedirectPath(): InviteLoginReturnPath | '/' {
  return consumePendingInviteLoginHandoff()?.returnPath ?? '/';
}
