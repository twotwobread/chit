import assert from 'node:assert/strict';
import test from 'node:test';

import { clearOAuthProviderLocalSessions, type OAuthProviderCleanupAdapter } from './provider-cleanup.ts';

test('runs registered provider cleanup adapters without exposing provider details to core logout', async () => {
  const calls: string[] = [];
  const adapters: OAuthProviderCleanupAdapter[] = [
    { provider: 'kakao', clearLocalSession: async () => calls.push('kakao') },
    { provider: 'future-provider', clearLocalSession: async () => calls.push('future') },
  ];

  await clearOAuthProviderLocalSessions(adapters);

  assert.deepEqual(calls, ['kakao', 'future']);
});

test('provider cleanup is best-effort when one provider adapter fails', async () => {
  const calls: string[] = [];
  const adapters: OAuthProviderCleanupAdapter[] = [
    {
      provider: 'kakao',
      clearLocalSession: async () => {
        calls.push('kakao');
        throw new Error('kakao cleanup failed');
      },
    },
    { provider: 'future-provider', clearLocalSession: async () => calls.push('future') },
  ];

  await clearOAuthProviderLocalSessions(adapters);

  assert.deepEqual(calls, ['kakao', 'future']);
});
