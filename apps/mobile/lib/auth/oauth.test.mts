import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthProvider, OAuthCredential } from '@i-um/api-contract';

import {
  getOAuthCredential,
  getOAuthProviderConfigs,
  getVisibleOAuthProviderConfigs,
  OAuthProviderUnavailableError,
  UnsupportedOAuthProviderError,
  type OAuthProviderConfig,
} from './oauth.ts';

const appleCredential: OAuthCredential = { identityToken: 'apple-token' };
const kakaoCredential: OAuthCredential = { accessToken: 'kakao-token' };

function providerConfig(
  id: AuthProvider,
  label: string,
  order: number,
  getCredential: () => Promise<OAuthCredential>,
  available = true,
): OAuthProviderConfig {
  return {
    id,
    label,
    order,
    availability: () => (available ? { status: 'available' } : { status: 'unavailable', reason: `${id} unavailable` }),
    buttonStyle: {
      backgroundColor: `${id}-background`,
      textColor: `${id}-text`,
    },
    loginLabel: ({ label: providerLabel }) => `${providerLabel}로 계속하기`,
    linkLabel: ({ label: providerLabel }, linked) => `${providerLabel} ${linked ? '연결됨' : '연결'}`,
    getCredential,
  };
}

test('returns OAuth provider configs in supported provider order with shared labels and styles', () => {
  const configs = getOAuthProviderConfigs([
    providerConfig('kakao', 'Kakao', 20, async () => kakaoCredential),
    providerConfig('apple', 'Apple', 10, async () => appleCredential),
  ]);

  assert.deepEqual(configs.map((provider) => provider.id), ['apple', 'kakao']);
  assert.equal(configs[0].loginLabel(configs[0]), 'Apple로 계속하기');
  assert.equal(configs[0].linkLabel(configs[0], false), 'Apple 연결');
  assert.equal(configs[0].linkLabel(configs[0], true), 'Apple 연결됨');
  assert.deepEqual(configs[0].buttonStyle, { backgroundColor: 'apple-background', textColor: 'apple-text' });
});

test('filters unavailable providers for UI rendering without changing provider metadata source', () => {
  const configs = getVisibleOAuthProviderConfigs([
    providerConfig('apple', 'Apple', 10, async () => appleCredential, false),
    providerConfig('kakao', 'Kakao', 20, async () => kakaoCredential),
  ]);

  assert.deepEqual(configs.map((provider) => provider.id), ['kakao']);
});

test('dispatches credential acquisition through the requested provider adapter', async () => {
  const calls: string[] = [];
  const providers = [
    providerConfig('apple', 'Apple', 10, async () => {
      calls.push('apple');
      return appleCredential;
    }),
    providerConfig('kakao', 'Kakao', 20, async () => {
      calls.push('kakao');
      return kakaoCredential;
    }),
  ];

  await assert.deepEqual(await getOAuthCredential('apple', { providers, env: {} }), appleCredential);
  await assert.deepEqual(await getOAuthCredential('kakao', { providers, env: {} }), kakaoCredential);
  assert.deepEqual(calls, ['apple', 'kakao']);
});

test('rejects unsupported providers explicitly and never falls back to Kakao', async () => {
  let kakaoCalls = 0;
  const providers = [
    providerConfig('apple', 'Apple', 10, async () => appleCredential),
    providerConfig('kakao', 'Kakao', 20, async () => {
      kakaoCalls += 1;
      return kakaoCredential;
    }),
  ];

  await assert.rejects(
    () => getOAuthCredential('google' as AuthProvider, { providers, env: {} }),
    UnsupportedOAuthProviderError,
  );
  assert.equal(kakaoCalls, 0);
});

test('rejects unavailable providers explicitly and never falls back to Kakao', async () => {
  let kakaoCalls = 0;
  const providers = [
    providerConfig('apple', 'Apple', 10, async () => appleCredential, false),
    providerConfig('kakao', 'Kakao', 20, async () => {
      kakaoCalls += 1;
      return kakaoCredential;
    }),
  ];

  await assert.rejects(
    () => getOAuthCredential('apple', { providers, env: {} }),
    OAuthProviderUnavailableError,
  );
  assert.equal(kakaoCalls, 0);
});

test('dev OAuth credential is explicit per supported provider and does not call native adapters', async () => {
  let adapterCalls = 0;
  const providers = [
    providerConfig('apple', 'Apple', 10, async () => {
      adapterCalls += 1;
      return appleCredential;
    }),
  ];

  const credential = await getOAuthCredential('apple', {
    providers,
    env: { EXPO_PUBLIC_AUTH_DEV_MODE: 'true' },
  });

  assert.deepEqual(credential, {
    devSubject: 'apple-dev-user',
    email: 'dev@example.com',
    emailVerified: true,
    displayName: 'Apple Dev User',
  });
  assert.equal(adapterCalls, 0);
});
