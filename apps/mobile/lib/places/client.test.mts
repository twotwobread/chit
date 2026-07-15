import assert from 'node:assert/strict';
import test from 'node:test';

import type { SearchGooglePlacesResponse } from '@i-um/api-contract';

import type { AuthClientDeps } from '../auth/client';
import type { StoredSession, StoredSessionReadResult } from '../auth/session';

import { searchGooglePlaces } from './client';

const user = {
  id: 'user-1',
  displayName: '민수',
};

const tokens = {
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-07-15T12:00:00Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: '2026-08-15T12:00:00Z',
};

function createAuthenticatedDeps(): AuthClientDeps {
  const stored: StoredSession = { user, tokens };
  const readResult: StoredSessionReadResult = { status: 'ready', session: stored };
  return {
    authService: {
      loginWithOAuth: async () => {
        throw new Error('loginWithOAuth must not be called');
      },
      linkOAuthProvider: async () => {
        throw new Error('linkOAuthProvider must not be called');
      },
      refreshToken: async () => {
        throw new Error('refreshToken must not be called');
      },
      getMe: async () => {
        throw new Error('getMe must not be called');
      },
      updateMe: async () => {
        throw new Error('updateMe must not be called');
      },
      deleteMe: async () => {
        throw new Error('deleteMe must not be called');
      },
      logout: async () => {
        throw new Error('logout must not be called');
      },
    },
    configureApi: () => undefined,
    readStoredSession: async () => readResult,
    getStoredSession: async () => stored,
    saveStoredSession: async () => undefined,
    clearStoredSession: async () => undefined,
    clearProviderLocalSessions: async () => undefined,
  };
}

test('searchGooglePlaces forwards default limit and location bias params to generated client', async () => {
  const calls: unknown[][] = [];
  const response: SearchGooglePlacesResponse = { results: [] };
  const placesService = {
    searchGooglePlaces: async (...args: unknown[]) => {
      calls.push(args);
      return response;
    },
  };

  assert.equal(
    await searchGooglePlaces(
      'trip-1',
      'day-1',
      '  도톤보리  ',
      {
        latitude: 34.7,
        longitude: 135.5,
        radiusMeters: 12000,
      },
      { auth: createAuthenticatedDeps(), placesService },
    ),
    response,
  );

  assert.deepEqual(calls, [['trip-1', 'day-1', '도톤보리', 10, 34.7, 135.5, 12000]]);
});
