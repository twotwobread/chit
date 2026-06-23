import assert from 'node:assert/strict';
import test from 'node:test';

import { readStoredSession, type SessionStore, type StoredSession } from './session.ts';

const validSession: StoredSession = {
  user: {
    id: 'user-1',
    displayName: '민수',
    email: 'minsu@example.com',
  },
  tokens: {
    accessToken: 'access-token',
    accessTokenExpiresAt: '2026-06-23T12:15:00Z',
    refreshToken: 'refresh-token',
    refreshTokenExpiresAt: '2026-07-23T12:00:00Z',
  },
};

function storeWith(raw: string | null) {
  const calls: string[] = [];
  const store: SessionStore = {
    getItem: async () => raw,
    setItem: async () => undefined,
    deleteItem: async () => {
      calls.push('delete');
      raw = null;
    },
  };
  return { store, calls };
}

test('missing stored auth session is a normal logged-out state', async () => {
  const { store, calls } = storeWith(null);

  assert.deepEqual(await readStoredSession(store), { status: 'missing' });
  assert.deepEqual(calls, []);
});

test('valid stored auth session is returned for bootstrap', async () => {
  const { store } = storeWith(JSON.stringify(validSession));

  assert.deepEqual(await readStoredSession(store), { status: 'ready', session: validSession });
});

test('invalid JSON stored auth session is treated as corrupt and cleared', async () => {
  const { store, calls } = storeWith('{not-json');

  assert.deepEqual(await readStoredSession(store), { status: 'corrupt' });
  assert.deepEqual(calls, ['delete']);
});

test('stored auth session with missing required token fields is corrupt and cleared', async () => {
  const { store, calls } = storeWith(JSON.stringify({ ...validSession, tokens: { accessToken: 'access-token' } }));

  assert.deepEqual(await readStoredSession(store), { status: 'corrupt' });
  assert.deepEqual(calls, ['delete']);
});

test('stored auth session with missing required user fields is corrupt and cleared', async () => {
  const { store, calls } = storeWith(JSON.stringify({ ...validSession, user: { id: 'user-1' } }));

  assert.deepEqual(await readStoredSession(store), { status: 'corrupt' });
  assert.deepEqual(calls, ['delete']);
});
