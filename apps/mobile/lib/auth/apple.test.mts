import assert from 'node:assert/strict';
import test from 'node:test';

import { getAppleCredential, type AppleAuthenticationModule } from './apple.ts';

function appleModule(overrides: Partial<AppleAuthenticationModule> = {}): AppleAuthenticationModule {
  return {
    AppleAuthenticationScope: {
      FULL_NAME: 'fullName',
      EMAIL: 'email',
    },
    isAvailableAsync: async () => true,
    signInAsync: async () => ({ identityToken: 'apple-identity-token' }),
    ...overrides,
  };
}

test('returns an OAuth credential with identityToken and optional Apple snapshots', async () => {
  let requestedScopes: unknown[] = [];
  const credential = await getAppleCredential(async () =>
    appleModule({
      signInAsync: async (options) => {
        requestedScopes = options.requestedScopes;
        return {
          identityToken: 'apple-identity-token',
          authorizationCode: 'apple-auth-code',
          email: 'minsu@example.com',
          fullName: { givenName: '민수', familyName: '김' },
        };
      },
    }),
  );

  assert.deepEqual(requestedScopes, ['fullName', 'email']);
  assert.deepEqual(credential, {
    identityToken: 'apple-identity-token',
    authorizationCode: 'apple-auth-code',
    email: 'minsu@example.com',
    emailVerified: true,
    displayName: '민수 김',
  });
});

test('rejects when Apple authentication is unavailable on this device or build', async () => {
  await assert.rejects(
    () => getAppleCredential(async () => appleModule({ isAvailableAsync: async () => false })),
    /Apple login is not available/,
  );
});

test('rejects missing Apple identity token', async () => {
  await assert.rejects(
    () =>
      getAppleCredential(async () =>
        appleModule({
          signInAsync: async () => ({ authorizationCode: 'auth-code-without-id-token' }),
        }),
      ),
    /Apple identity token is missing/,
  );
});
