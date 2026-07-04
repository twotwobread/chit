import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from './client';
import { clearStoredSession } from './session';

const SESSION_AUTH_ERROR_CODES = new Set(['UNAUTHORIZED', 'INVALID_REFRESH_TOKEN']);

export function apiErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const body = error.body as { error?: { code?: string } } | undefined;
  return body?.error?.code ?? null;
}

export function isApiStatus(error: unknown, ...statuses: number[]): boolean {
  const status = apiErrorStatus(error);
  return status !== undefined && statuses.includes(status);
}

export function isMobileAuthSessionError(error: unknown): boolean {
  return error instanceof MobileAuthError && SESSION_AUTH_ERROR_CODES.has(error.code);
}

export function isSessionAuthError(error: unknown): boolean {
  return isMobileAuthSessionError(error) || isApiStatus(error, 401);
}

export function isAnyMobileAuthOrApiAuthError(error: unknown): boolean {
  return error instanceof MobileAuthError || isApiStatus(error, 401);
}

export async function clearStoredSessionOnAuthError(error: unknown): Promise<boolean> {
  if (!isSessionAuthError(error)) {
    return false;
  }

  await clearStoredSession();
  return true;
}

export async function clearStoredSessionOnAnyMobileAuthOrApiAuthError(error: unknown): Promise<boolean> {
  if (!isAnyMobileAuthOrApiAuthError(error)) {
    return false;
  }

  await clearStoredSession();
  return true;
}
