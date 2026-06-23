import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthLoginResponse, AuthMeResponse, AuthRefreshResponse } from '@i-um/api-contract';

import {
  getCurrentUserWithRefresh,
  logoutCurrentSession,
  MobileAuthError,
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
  getCurrentUser?: () => Promise<AuthMeResponse>;
  refreshToken?: () => Promise<AuthRefreshResponse>;
  logout?: () => Promise<unknown>;
  saveStoredSession?: (session: StoredSession) => Promise<void>;
};

function createDeps(options: DepsOptions = {}) {
  let stored = options.stored === undefined ? { user, tokens: oldTokens } : options.stored;
  const calls: string[] = [];
  const deps: AuthClientDeps = {
    authService: {
      loginWithOAuth: async () => loginResponse,
      linkOAuthProvider: async () => ({ result: 'provider_link_success', linkedIdentity: { provider: 'kakao' } }),
      getCurrentUser: options.getCurrentUser ?? (async () => me),
      refreshToken: options.refreshToken ?? (async () => refreshResponse),
      logout: options.logout ?? (async () => ({ result: 'logout_success' })),
    },
    configureApi: (accessToken?: string) => {
      calls.push(`configure:${accessToken ?? ''}`);
    },
    readStoredSession: async () => options.readResult ?? (stored ? { status: 'ready', session: stored } : { status: 'missing' }),
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
    clearKakaoNativeSession: async () => {
      calls.push('clearKakao');
    },
  };
  return { deps, calls, getStored: () => stored };
}

function apiError(code: string): Error & { body: { error: { code: string } }; status: number } {
  return Object.assign(new Error(code), { body: { error: { code } }, status: 401 });
}

test('does not call auth API when stored session is missing', async () => {
  const { deps, calls } = createDeps({
    readResult: { status: 'missing' },
    getCurrentUser: async () => {
      throw new Error('getCurrentUser must not be called');
    },
    refreshToken: async () => {
      throw new Error('refreshToken must not be called');
    },
  });

  await assert.rejects(() => getCurrentUserWithRefresh(deps), (error) => {
    assert.ok(error instanceof MobileAuthError);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
  assert.deepEqual(calls, []);
});

test('does not call auth API when stored session is corrupt', async () => {
  const { deps, calls } = createDeps({
    readResult: { status: 'corrupt' },
    getCurrentUser: async () => {
      throw new Error('getCurrentUser must not be called');
    },
    refreshToken: async () => {
      throw new Error('refreshToken must not be called');
    },
  });

  await assert.rejects(() => getCurrentUserWithRefresh(deps), (error) => {
    assert.ok(error instanceof MobileAuthError);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
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

  assert.deepEqual(await getCurrentUserWithRefresh(deps), me);
  assert.equal(refreshCalls, 0);
  assert.deepEqual(calls, ['configure:old-access-token']);
});

test('refreshes once after unauthorized current user, saves rotated tokens, then retries current user', async () => {
  let getMeCalls = 0;
  const { deps, calls, getStored } = createDeps({
    getCurrentUser: async () => {
      getMeCalls += 1;
      if (getMeCalls === 1) {
        throw apiError('UNAUTHORIZED');
      }
      return me;
    },
  });

  assert.deepEqual(await getCurrentUserWithRefresh(deps), me);
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
    getCurrentUser: async () => {
      throw apiError('UNAUTHORIZED');
    },
    refreshToken: async () => {
      throw apiError('INVALID_REFRESH_TOKEN');
    },
  });

  await assert.rejects(() => getCurrentUserWithRefresh(deps), (error) => {
    assert.ok(error instanceof MobileAuthError);
    assert.equal(error.code, 'INVALID_REFRESH_TOKEN');
    return true;
  });
  assert.equal(getStored(), null);
});

test('keeps local session on retryable refresh transport failure', async () => {
  const { deps, getStored } = createDeps({
    getCurrentUser: async () => {
      throw apiError('UNAUTHORIZED');
    },
    refreshToken: async () => {
      throw new Error('network unavailable');
    },
  });

  await assert.rejects(() => getCurrentUserWithRefresh(deps), (error) => {
    assert.ok(error instanceof MobileAuthError);
    assert.equal(error.code, 'UNKNOWN');
    return true;
  });
  assert.equal(getStored()?.tokens.refreshToken, 'old-refresh-token');
});

test('does not return authenticated success when saving rotated tokens fails', async () => {
  let getMeCalls = 0;
  const { deps, getStored } = createDeps({
    getCurrentUser: async () => {
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

  await assert.rejects(() => getCurrentUserWithRefresh(deps), (error) => {
    assert.ok(error instanceof MobileAuthError);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
  assert.equal(getMeCalls, 1);
  assert.equal(getStored(), null);
});

test('shares one in-flight refresh across concurrent current-user restore callers', async () => {
  let getMeCalls = 0;
  let refreshCalls = 0;
  const { deps } = createDeps({
    getCurrentUser: async () => {
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

  const [first, second] = await Promise.all([getCurrentUserWithRefresh(deps), getCurrentUserWithRefresh(deps)]);

  assert.deepEqual(first, me);
  assert.deepEqual(second, me);
  assert.equal(refreshCalls, 1);
  assert.equal(getMeCalls, 2);
});

test('logout clears local session and Kakao state even when server logout fails', async () => {
  const { deps, calls, getStored } = createDeps({
    logout: async () => {
      throw new Error('server unavailable');
    },
  });

  await logoutCurrentSession(deps);

  assert.equal(getStored(), null);
  assert.deepEqual(calls, ['configure:old-access-token', 'clearKakao', 'clear', 'configure:']);
});
