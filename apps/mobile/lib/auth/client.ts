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
import { clearOAuthProviderLocalSessions } from './provider-cleanup';
import {
  clearStoredSession,
  getStoredSession,
  readStoredSession,
  saveStoredSession,
  type StoredSession,
  type StoredSessionReadResult,
} from './session';

export type AuthErrorCode =
  | 'ACCOUNT_LINK_REQUIRED'
  | 'INVALID_PROVIDER_TOKEN'
  | 'PROVIDER_ALREADY_LINKED'
  | 'INVALID_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

type AuthServiceClient = {
  loginWithOAuth: (request: {
    provider: AuthProvider;
    credential: OAuthCredential;
    device: { platform: string };
  }) => Promise<AuthLoginResponse>;
  linkOAuthProvider: (request: { provider: AuthProvider; credential: OAuthCredential }) => Promise<AuthLinkResponse>;
  refreshToken: (request: { refreshToken: string }) => Promise<AuthRefreshResponse>;
  getMe: () => Promise<AuthMeResponse>;
  updateMe: (request: { displayName: string }) => Promise<AuthMeResponse>;
  deleteMe: () => Promise<unknown>;
  logout: () => Promise<unknown>;
};

export type AuthClientDeps = {
  authService: AuthServiceClient;
  configureApi: (accessToken?: string) => void;
  readStoredSession: () => Promise<StoredSessionReadResult>;
  getStoredSession: () => Promise<StoredSession | null>;
  saveStoredSession: (session: StoredSession) => Promise<void>;
  clearStoredSession: () => Promise<void>;
  clearProviderLocalSessions: () => Promise<void>;
};

const defaultAuthClientDeps: AuthClientDeps = {
  authService: AuthService,
  configureApi,
  readStoredSession,
  getStoredSession,
  saveStoredSession,
  clearStoredSession,
  clearProviderLocalSessions: clearOAuthProviderLocalSessions,
};

let meWithRefreshInFlight: Promise<AuthMeResponse> | null = null;
let deleteAccountInFlight: Promise<void> | null = null;
let logoutInFlight: Promise<void> | null = null;

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
  deps: AuthClientDeps = defaultAuthClientDeps,
): Promise<AuthLoginResponse> {
  deps.configureApi();
  try {
    const response = await deps.authService.loginWithOAuth({
      provider,
      credential,
      device: { platform: 'ios' },
    });
    await persistSessionOrThrow({ user: response.user, tokens: response.tokens }, deps);
    deps.configureApi(response.tokens.accessToken);
    return response;
  } catch (error) {
    if (error instanceof MobileAuthError) {
      throw error;
    }
    throw toMobileAuthError(error);
  }
}

export async function linkOAuthProvider(
  provider: AuthProvider,
  credential: OAuthCredential,
  deps: AuthClientDeps = defaultAuthClientDeps,
): Promise<AuthLinkResponse> {
  const session = await requireSession(deps);
  deps.configureApi(session.tokens.accessToken);
  try {
    return await deps.authService.linkOAuthProvider({ provider, credential });
  } catch (error) {
    throw toMobileAuthError(error);
  }
}

export function getMeWithRefresh(deps: AuthClientDeps = defaultAuthClientDeps): Promise<AuthMeResponse> {
  if (meWithRefreshInFlight) {
    return meWithRefreshInFlight;
  }

  const promise = getMeWithRefreshOnce(deps).finally(() => {
    if (meWithRefreshInFlight === promise) {
      meWithRefreshInFlight = null;
    }
  });
  meWithRefreshInFlight = promise;
  return promise;
}

async function getMeWithRefreshOnce(deps: AuthClientDeps): Promise<AuthMeResponse> {
  const session = await requireSession(deps);
  deps.configureApi(session.tokens.accessToken);

  try {
    return await deps.authService.getMe();
  } catch (error) {
    if (getErrorCode(error) !== 'UNAUTHORIZED') {
      throw toMobileAuthError(error);
    }
  }

  const refreshed = await refreshStoredSession(session.tokens.refreshToken, deps, session);
  deps.configureApi(refreshed.tokens.accessToken);

  try {
    return await deps.authService.getMe();
  } catch (error) {
    if (isNonRetryableAuthError(error)) {
      await bestEffortClearStoredSession(deps);
    }
    throw toMobileAuthError(error);
  }
}

export async function updateDisplayNameWithRefresh(
  displayName: string,
  deps: AuthClientDeps = defaultAuthClientDeps,
): Promise<AuthMeResponse> {
  const session = await requireSession(deps);
  deps.configureApi(session.tokens.accessToken);

  try {
    const response = await deps.authService.updateMe({ displayName });
    await persistSessionOrThrow({ user: response.user, tokens: session.tokens }, deps);
    return response;
  } catch (error) {
    if (getErrorCode(error) !== 'UNAUTHORIZED') {
      throw toMobileAuthError(error);
    }
  }

  const refreshed = await refreshStoredSession(session.tokens.refreshToken, deps, session);
  deps.configureApi(refreshed.tokens.accessToken);

  try {
    const response = await deps.authService.updateMe({ displayName });
    await persistSessionOrThrow({ user: response.user, tokens: refreshed.tokens }, deps);
    return response;
  } catch (error) {
    const code = getErrorCode(error);
    if (code === 'INVALID_REFRESH_TOKEN' || code === 'UNAUTHORIZED') {
      await bestEffortClearStoredSession(deps);
    }
    throw toMobileAuthError(error);
  }
}

export async function refreshStoredSession(
  refreshToken: string,
  deps: AuthClientDeps = defaultAuthClientDeps,
  existingSession?: StoredSession,
): Promise<AuthRefreshResponse> {
  deps.configureApi();

  let response: AuthRefreshResponse;
  try {
    response = await deps.authService.refreshToken({ refreshToken });
  } catch (error) {
    if (isNonRetryableAuthError(error)) {
      await bestEffortClearStoredSession(deps);
    }
    throw toMobileAuthError(error);
  }

  const session = existingSession ?? (await deps.getStoredSession());
  if (!session) {
    await bestEffortClearStoredSession(deps);
    throw new MobileAuthError('UNAUTHORIZED', 'session is required');
  }

  await persistSessionOrThrow({ user: session.user, tokens: response.tokens }, deps);
  return response;
}

export function deleteAccountWithRefresh(deps: AuthClientDeps = defaultAuthClientDeps): Promise<void> {
  if (deleteAccountInFlight) {
    return deleteAccountInFlight;
  }

  const promise = deleteAccountWithRefreshOnce(deps).finally(() => {
    if (deleteAccountInFlight === promise) {
      deleteAccountInFlight = null;
    }
  });
  deleteAccountInFlight = promise;
  return promise;
}

async function deleteAccountWithRefreshOnce(deps: AuthClientDeps): Promise<void> {
  const session = await requireSession(deps);
  deps.configureApi(session.tokens.accessToken);

  try {
    await deps.authService.deleteMe();
    await clearLocalAuthAfterConfirmedEnd(deps);
    return;
  } catch (error) {
    if (getErrorCode(error) !== 'UNAUTHORIZED') {
      throw toMobileAuthError(error);
    }
  }

  const refreshed = await refreshStoredSession(session.tokens.refreshToken, deps, session);
  deps.configureApi(refreshed.tokens.accessToken);

  try {
    await deps.authService.deleteMe();
    await clearLocalAuthAfterConfirmedEnd(deps);
  } catch (error) {
    if (isNonRetryableAuthError(error)) {
      await bestEffortClearStoredSession(deps);
      deps.configureApi();
    }
    throw toMobileAuthError(error);
  }
}

export function logoutCurrentSession(deps: AuthClientDeps = defaultAuthClientDeps): Promise<void> {
  if (logoutInFlight) {
    return logoutInFlight;
  }

  const promise = logoutCurrentSessionOnce(deps).finally(() => {
    if (logoutInFlight === promise) {
      logoutInFlight = null;
    }
  });
  logoutInFlight = promise;
  return promise;
}

async function logoutCurrentSessionOnce(deps: AuthClientDeps): Promise<void> {
  const session = await deps.getStoredSession();
  if (!session) {
    return;
  }

  deps.configureApi(session.tokens.accessToken);
  try {
    await deps.authService.logout();
  } catch {
    // Device-local logout is prioritized even when server revocation cannot be confirmed.
  } finally {
    await clearLocalAuthAfterConfirmedEnd(deps);
  }
}

async function clearLocalAuthAfterConfirmedEnd(deps: AuthClientDeps): Promise<void> {
  try {
    await deps.clearProviderLocalSessions();
  } catch {
    // Provider-local cleanup is best-effort and must not block i-um local auth cleanup.
  }
  try {
    await deps.clearStoredSession();
  } finally {
    deps.configureApi();
  }
}

async function requireSession(deps: AuthClientDeps): Promise<StoredSession> {
  const result = await deps.readStoredSession();
  if (result.status !== 'ready') {
    throw new MobileAuthError('UNAUTHORIZED', 'session is required');
  }
  return result.session;
}

async function persistSessionOrThrow(session: StoredSession, deps: AuthClientDeps): Promise<void> {
  try {
    await deps.saveStoredSession(session);
  } catch {
    await bestEffortClearStoredSession(deps);
    deps.configureApi();
    throw new MobileAuthError('UNAUTHORIZED', 'session persistence failed');
  }
}

async function bestEffortClearStoredSession(deps: AuthClientDeps): Promise<void> {
  try {
    await deps.clearStoredSession();
  } catch {
    // Local cleanup is best-effort here; never log stored token payloads.
  }
}

function toMobileAuthError(error: unknown): MobileAuthError {
  const code = getErrorCode(error);
  return new MobileAuthError(code, error instanceof Error ? error.message : 'auth request failed');
}

function isNonRetryableAuthError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'INVALID_REFRESH_TOKEN' || code === 'UNAUTHORIZED' || code === 'VALIDATION_ERROR';
}

function getErrorCode(error: unknown): AuthErrorCode {
  if (typeof error === 'object' && error !== null) {
    if ('body' in error) {
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
          break;
      }
    }

    if ('status' in error && (error as { status?: unknown }).status === 401) {
      return 'UNAUTHORIZED';
    }
  }
  return 'UNKNOWN';
}
