import {
  AuthService,
  type AuthLinkResponse,
  type AuthLoginResponse,
  type AuthMeResponse,
  type AuthProvider,
  type AuthRefreshResponse,
  type OAuthCredential,
} from '@i-um/api-contract';

import { configureApi } from '../api/config';
import { clearKakaoNativeSession } from './kakao';
import { clearStoredSession, getStoredSession, saveStoredSession, type StoredSession } from './session';

export type AuthErrorCode =
  | 'ACCOUNT_LINK_REQUIRED'
  | 'INVALID_PROVIDER_TOKEN'
  | 'PROVIDER_ALREADY_LINKED'
  | 'INVALID_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export class MobileAuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'MobileAuthError';
    this.code = code;
  }
}

export async function loginWithOAuth(
  provider: AuthProvider,
  credential: OAuthCredential,
): Promise<AuthLoginResponse> {
  configureApi();
  try {
    const response = await AuthService.loginWithOAuth({
      provider,
      credential,
      device: { platform: 'ios' },
    });
    await saveStoredSession({ user: response.user, tokens: response.tokens });
    configureApi(response.tokens.accessToken);
    return response;
  } catch (error) {
    throw toMobileAuthError(error);
  }
}

export async function linkOAuthProvider(
  provider: AuthProvider,
  credential: OAuthCredential,
): Promise<AuthLinkResponse> {
  const session = await requireSession();
  configureApi(session.tokens.accessToken);
  try {
    return await AuthService.linkOAuthProvider({ provider, credential });
  } catch (error) {
    throw toMobileAuthError(error);
  }
}

export async function getCurrentUserWithRefresh(): Promise<AuthMeResponse> {
  const session = await requireSession();
  configureApi(session.tokens.accessToken);

  try {
    return await AuthService.getCurrentUser();
  } catch (error) {
    if (getErrorCode(error) !== 'UNAUTHORIZED') {
      throw toMobileAuthError(error);
    }
  }

  const refreshed = await refreshStoredSession(session.tokens.refreshToken);
  configureApi(refreshed.tokens.accessToken);
  return AuthService.getCurrentUser();
}

export async function refreshStoredSession(refreshToken: string): Promise<AuthRefreshResponse> {
  configureApi();
  try {
    const response = await AuthService.refreshToken({ refreshToken });
    const existing = await getStoredSession();
    if (existing) {
      await saveStoredSession({ user: existing.user, tokens: response.tokens });
    }
    return response;
  } catch (error) {
    await clearStoredSession();
    throw toMobileAuthError(error);
  }
}

export async function logoutCurrentSession(): Promise<void> {
  const session = await getStoredSession();
  if (!session) {
    return;
  }

  configureApi(session.tokens.accessToken);
  try {
    await AuthService.logout();
  } finally {
    await clearKakaoNativeSession();
    await clearStoredSession();
    configureApi();
  }
}

async function requireSession(): Promise<StoredSession> {
  const session = await getStoredSession();
  if (!session) {
    throw new MobileAuthError('UNAUTHORIZED', 'session is required');
  }
  return session;
}

function toMobileAuthError(error: unknown): MobileAuthError {
  const code = getErrorCode(error);
  return new MobileAuthError(code, error instanceof Error ? error.message : 'auth request failed');
}

function getErrorCode(error: unknown): AuthErrorCode {
  if (typeof error === 'object' && error !== null && 'body' in error) {
    const body = (error as { body?: { error?: { code?: string } } }).body;
    const code = body?.error?.code;
    switch (code) {
      case 'ACCOUNT_LINK_REQUIRED':
      case 'INVALID_PROVIDER_TOKEN':
      case 'PROVIDER_ALREADY_LINKED':
      case 'INVALID_REFRESH_TOKEN':
      case 'UNAUTHORIZED':
      case 'VALIDATION_ERROR':
        return code;
      default:
        return 'UNKNOWN';
    }
  }
  return 'UNKNOWN';
}
