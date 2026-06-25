import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthLoginResponse, AuthMeResponse, AuthRefreshResponse } from '@i-um/api-contract';

import {
  deleteAccountWithRefresh,
  getMeWithRefresh,
  logoutCurrentSession,
  MobileAuthError,
  updateDisplayNameWithRefresh,
  type AuthClientDeps,
} from './client.ts';
import type { StoredSession, StoredSessionReadResult } from './session.ts';

const user = {
  id: 'user-1',
  displayName: '민수',
  email: 'minsu@example.com',
};

const oldTokens = {
  accessToken: 'old-access-token',
  accessTokenExpiresAt: '2026-06-23T12:15:00Z',
  refreshToken: 'old-refresh-token',
  refreshTokenExpiresAt: '2026-07-23T12:00:00Z',
};

const newTokens = {
  accessToken: 'new-access-token',
  accessTokenExpiresAt: '2026-06-23T12:30:00Z',
  refreshToken: 'new-refresh-token',
  refreshTokenExpiresAt: '2026-07-23T12:15:00Z',
};

const me: AuthMeResponse = { user, linkedProviders: ['kakao'] };
const loginResponse: AuthLoginResponse = { result: 'login_success', user, tokens: oldTokens };
const refreshResponse: AuthRefreshResponse = { result: 'refresh_success', tokens: newTokens };

type DepsOptions = {
  stored?: StoredSession | null;
  readResult?: StoredSessionReadResult;
  getMe?: () => Promise<AuthMeResponse>;
  updateMe?: (request: { displayName: string }) => Promise<AuthMeResponse>;
  deleteMe?: () => Promise<unknown>;
  refreshToken?: () => Promise<AuthRefreshResponse>;
  logout?: () => Promise<unknown>;
  saveStoredSession?: (session: StoredSession) => Promise<void>;
  clearProviderLocalSessions?: () => Promise<void>;
};

function createDeps(options: DepsOptions = {}) {
  let stored = options.stored === undefined ? { user, tokens: oldTokens } : options.stored;
  const calls: string[] = [];
  const deps: AuthClientDeps = {
    authService: {
      loginWithOAuth: async () => loginResponse,
      linkOAuthProvider: async () => ({ result: 'provider_link_success', linkedIdentity: { provider: 'kakao' } }),
      getMe: options.getMe ?? (async () => me),
      updateMe: options.updateMe ?? (async () => me),
      deleteMe: options.deleteMe ?? (async () => undefined),
      refreshToken: options.refreshToken ?? (async () => refreshResponse),
      logout:
        options.logout ??
        (async () => {
          calls.push('logout');
          return { result: 'logout_success' };
        }),
    },
    configureApi: (accessToken?: string) => {
      calls.push(`configure:${accessToken ?? ''}`);
    },
    readStoredSession: async () =>
      options.readResult ?? (stored ? { status: 'ready', session: stored } : { status: 'missing' }),
    getStoredSession: async () => stored,
    saveStoredSession: async (session: StoredSession) => {
      calls.push(`save:${session.tokens.accessToken}`);
      await options.saveStoredSession?.(session);
      stored = session;
    },
    clearStoredSession: async () => {
      calls.push('clear');
      stored = null;
    },
    clearProviderLocalSessions:
      options.clearProviderLocalSessions ??
      (async () => {
        calls.push('clearProviders');
      }),
  };
  return { deps, calls, getStored: () => stored };
}

function apiError(code: string, status = 401): Error & { body: { error: { code: string } }; status: number } {
  return Object.assign(new Error(code), { body: { error: { code } }, status });
}

test('does not call auth API when stored session is missing', async () => {
  const { deps, calls } = createDeps({
    readResult: { status: 'missing' },
    getMe: async () => {
      throw new Error('getMe must not be called');
    },
    refreshToken: async () => {
      throw new Error('refreshToken must not be called');
    },
  });

  await assert.rejects(
    () => getMeWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNAUTHORIZED');
      return true;
    },
  );
  assert.deepEqual(calls, []);
});

test('does not call auth API when stored session is corrupt', async () => {
  const { deps, calls } = createDeps({
    readResult: { status: 'corrupt' },
    getMe: async () => {
      throw new Error('getMe must not be called');
    },
    refreshToken: async () => {
      throw new Error('refreshToken must not be called');
    },
  });

  await assert.rejects(
    () => getMeWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNAUTHORIZED');
      return true;
    },
  );
  assert.deepEqual(calls, []);
});

test('restores current user with a valid stored access token without refreshing', async () => {
  let refreshCalls = 0;
  const { deps, calls } = createDeps({
    refreshToken: async () => {
      refreshCalls += 1;
      return refreshResponse;
    },
  });

  assert.deepEqual(await getMeWithRefresh(deps), me);
  assert.equal(refreshCalls, 0);
  assert.deepEqual(calls, ['configure:old-access-token']);
});

test('refreshes once after unauthorized current user, saves rotated tokens, then retries current user', async () => {
  let getMeCalls = 0;
  const { deps, calls, getStored } = createDeps({
    getMe: async () => {
      getMeCalls += 1;
      if (getMeCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      return me;
    },
  });

  assert.deepEqual(await getMeWithRefresh(deps), me);
  assert.equal(getMeCalls, 2);
  assert.equal(getStored()?.tokens.refreshToken, 'new-refresh-token');
  assert.deepEqual(calls, [
    'configure:old-access-token',
    'configure:',
    'save:new-access-token',
    'configure:new-access-token',
  ]);
});

test('clears local session on non-retryable refresh failure', async () => {
  const { deps, getStored } = createDeps({
    getMe: async () => {
      throw apiError('UNAUTHORIZED');
    },
    refreshToken: async () => {
      throw apiError('INVALID_REFRESH_TOKEN');
    },
  });

  await assert.rejects(
    () => getMeWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'INVALID_REFRESH_TOKEN');
      return true;
    },
  );
  assert.equal(getStored(), null);
});

test('keeps local session on retryable refresh transport failure', async () => {
  const { deps, getStored } = createDeps({
    getMe: async () => {
      throw apiError('UNAUTHORIZED');
    },
    refreshToken: async () => {
      throw new Error('network unavailable');
    },
  });

  await assert.rejects(
    () => getMeWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNKNOWN');
      return true;
    },
  );
  assert.equal(getStored()?.tokens.refreshToken, 'old-refresh-token');
});

test('does not return authenticated success when saving rotated tokens fails', async () => {
  let getMeCalls = 0;
  const { deps, getStored } = createDeps({
    getMe: async () => {
      getMeCalls += 1;
      if (getMeCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      return me;
    },
    saveStoredSession: async () => {
      throw new Error('SecureStore write failed');
    },
  });

  await assert.rejects(
    () => getMeWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNAUTHORIZED');
      return true;
    },
  );
  assert.equal(getMeCalls, 1);
  assert.equal(getStored(), null);
});

test('shares one in-flight refresh across concurrent current-user restore callers', async () => {
  let getMeCalls = 0;
  let refreshCalls = 0;
  const { deps } = createDeps({
    getMe: async () => {
      getMeCalls += 1;
      if (getMeCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      return me;
    },
    refreshToken: async () => {
      refreshCalls += 1;
      return refreshResponse;
    },
  });

  const [first, second] = await Promise.all([getMeWithRefresh(deps), getMeWithRefresh(deps)]);

  assert.deepEqual(first, me);
  assert.deepEqual(second, me);
  assert.equal(refreshCalls, 1);
  assert.equal(getMeCalls, 2);
});

test('updates display name with a valid stored access token and saves returned user', async () => {
  const updatedMe: AuthMeResponse = { user: { ...user, displayName: '지영' }, linkedProviders: ['kakao'] };
  let updateRequest: { displayName: string } | null = null;
  const { deps, calls, getStored } = createDeps({
    updateMe: async (request) => {
      updateRequest = request;
      return updatedMe;
    },
  });

  assert.deepEqual(await updateDisplayNameWithRefresh('지영', deps), updatedMe);
  assert.deepEqual(updateRequest, { displayName: '지영' });
  assert.equal(getStored()?.user.displayName, '지영');
  assert.equal(getStored()?.tokens.accessToken, 'old-access-token');
  assert.deepEqual(calls, ['configure:old-access-token', 'save:old-access-token']);
});

test('refreshes once after unauthorized display-name update, retries, and saves returned user', async () => {
  const updatedMe: AuthMeResponse = { user: { ...user, displayName: '지영' }, linkedProviders: ['kakao'] };
  let updateCalls = 0;
  const { deps, calls, getStored } = createDeps({
    updateMe: async () => {
      updateCalls += 1;
      if (updateCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      return updatedMe;
    },
  });

  assert.deepEqual(await updateDisplayNameWithRefresh('지영', deps), updatedMe);
  assert.equal(updateCalls, 2);
  assert.equal(getStored()?.user.displayName, '지영');
  assert.equal(getStored()?.tokens.accessToken, 'new-access-token');
  assert.deepEqual(calls, [
    'configure:old-access-token',
    'configure:',
    'save:new-access-token',
    'configure:new-access-token',
    'save:new-access-token',
  ]);
});

test('maps display-name validation errors and keeps local session unchanged', async () => {
  const { deps, getStored } = createDeps({
    updateMe: async () => {
      throw apiError('VALIDATION_ERROR', 400);
    },
  });

  await assert.rejects(
    () => updateDisplayNameWithRefresh(' ', deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
  assert.equal(getStored()?.user.displayName, '민수');
  assert.equal(getStored()?.tokens.accessToken, 'old-access-token');
});

test('keeps refreshed session when retried display-name update returns validation error', async () => {
  let updateCalls = 0;
  const { deps, getStored } = createDeps({
    updateMe: async () => {
      updateCalls += 1;
      if (updateCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      throw apiError('VALIDATION_ERROR', 400);
    },
  });

  await assert.rejects(
    () => updateDisplayNameWithRefresh(' ', deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
  assert.equal(getStored()?.user.displayName, '민수');
  assert.equal(getStored()?.tokens.accessToken, 'new-access-token');
});

test('deletes account with a valid stored access token and clears provider, local session, and API auth', async () => {
  let deleteCalls = 0;
  const { deps, calls, getStored } = createDeps({
    deleteMe: async () => {
      deleteCalls += 1;
    },
  });

  await deleteAccountWithRefresh(deps);

  assert.equal(deleteCalls, 1);
  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'clearProviders', 'clear', 'configure:']);
});

test('refreshes once after unauthorized account deletion, retries, and clears local auth after success', async () => {
  let deleteCalls = 0;
  const { deps, calls, getStored } = createDeps({
    deleteMe: async () => {
      deleteCalls += 1;
      if (deleteCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
    },
  });

  await deleteAccountWithRefresh(deps);

  assert.equal(deleteCalls, 2);
  assert.equal(getStored(), null);
  assert.deepEqual(calls, [
    'configure:old-access-token',
    'configure:',
    'save:new-access-token',
    'configure:new-access-token',
    'clearProviders',
    'clear',
    'configure:',
  ]);
});

test('keeps local session when account deletion fails with retryable server error', async () => {
  const { deps, getStored } = createDeps({
    deleteMe: async () => {
      throw apiError('INTERNAL_ERROR', 500);
    },
  });

  await assert.rejects(
    () => deleteAccountWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNKNOWN');
      return true;
    },
  );
  assert.equal(getStored()?.tokens.accessToken, 'old-access-token');
});

test('account deletion clears local session when retry still returns unauthorized', async () => {
  const { deps, getStored } = createDeps({
    deleteMe: async () => {
      throw apiError('UNAUTHORIZED');
    },
  });

  await assert.rejects(
    () => deleteAccountWithRefresh(deps),
    (error) => {
      assert.ok(error instanceof MobileAuthError);
      assert.equal(error.code, 'UNAUTHORIZED');
      return true;
    },
  );
  assert.equal(getStored(), null);
});

test('account deletion ignores provider cleanup failure after confirmed server success', async () => {
  const { deps, calls, getStored } = createDeps({
    clearProviderLocalSessions: async () => {
      calls.push('clearProviders');
      throw new Error('provider cleanup failed');
    },
  });

  await deleteAccountWithRefresh(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'clearProviders', 'clear', 'configure:']);
});

test('account deletion is single-flight for duplicate callers', async () => {
  let releaseDelete: (() => void) | null = null;
  let deleteCalls = 0;
  const { deps, calls, getStored } = createDeps({
    deleteMe: async () => {
      deleteCalls += 1;
      await new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
    },
  });

  const first = deleteAccountWithRefresh(deps);
  const second = deleteAccountWithRefresh(deps);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseDelete?.();
  await Promise.all([first, second]);

  assert.equal(deleteCalls, 1);
  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'clearProviders', 'clear', 'configure:']);
});

test('logout attempts server revoke and clears provider, local session, and API auth', async () => {
  const { deps, calls, getStored } = createDeps();

  await logoutCurrentSession(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'logout', 'clearProviders', 'clear', 'configure:']);
});

test('logout skips server revoke and provider cleanup when no session is stored', async () => {
  const { deps, calls, getStored } = createDeps({ stored: null });

  await logoutCurrentSession(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, []);
});

test('logout clears local session and provider state even when server logout fails', async () => {
  const { deps, calls, getStored } = createDeps({
    logout: async () => {
      calls.push('logout');
      throw new Error('server unavailable');
    },
  });

  await logoutCurrentSession(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'logout', 'clearProviders', 'clear', 'configure:']);
});

test('logout clears local session even when provider cleanup fails', async () => {
  const { deps, calls, getStored } = createDeps({
    clearProviderLocalSessions: async () => {
      calls.push('clearProviders');
      throw new Error('provider cleanup failed');
    },
  });

  await logoutCurrentSession(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'logout', 'clearProviders', 'clear', 'configure:']);
});

test('logout is single-flight for duplicate callers', async () => {
  let releaseLogout: (() => void) | null = null;
  const { deps, calls, getStored } = createDeps({
    logout: async () => {
      calls.push('logout');
      await new Promise<void>((resolve) => {
        releaseLogout = resolve;
      });
      return { result: 'logout_success' };
    },
  });

  const first = logoutCurrentSession(deps);
  const second = logoutCurrentSession(deps);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseLogout?.();
  await Promise.all([first, second]);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'logout', 'clearProviders', 'clear', 'configure:']);
});
