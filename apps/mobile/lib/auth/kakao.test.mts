import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  clearKakaoNativeSession,
  getKakaoNativeCredential,
  getKakaoNativeScheme,
  type KakaoNativeSdk,
} from './kakao.ts';

const env = { EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'native-key' };

test('returns OAuth credential with accessToken on Kakao native SDK success', async () => {
  const calls: string[] = [];
  const sdk: KakaoNativeSdk = {
    login: async () => {
      calls.push('login');
      return { accessToken: 'kakao-access-token' };
    },
  };

  const credential = await getKakaoNativeCredential(() => Promise.resolve(sdk), env);

  assert.deepEqual(credential, { accessToken: 'kakao-access-token' });
  assert.deepEqual(calls, ['login']);
});

test('falls back to Kakao account login when KakaoTalk login is unavailable', async () => {
  const calls: string[] = [];
  const sdk: KakaoNativeSdk = {
    login: async () => {
      calls.push('login');
      const error = new Error('KakaoTalk is not available');
      Object.assign(error, { code: 'KAKAO_TALK_UNAVAILABLE' });
      throw error;
    },
    loginWithKakaoAccount: async () => {
      calls.push('loginWithKakaoAccount');
      return { accessToken: 'fallback-access-token' };
    },
  };

  const credential = await getKakaoNativeCredential(() => Promise.resolve(sdk), env);

  assert.deepEqual(credential, { accessToken: 'fallback-access-token' });
  assert.deepEqual(calls, ['login', 'loginWithKakaoAccount']);
});

test('propagates Kakao cancel/provider failure so existing login UI maps it to generic error', async () => {
  const sdk: KakaoNativeSdk = {
    login: async () => {
      throw new Error('Kakao login was cancelled.');
    },
    loginWithKakaoAccount: async () => ({ accessToken: 'must-not-be-used' }),
  };

  await assert.rejects(() => getKakaoNativeCredential(() => Promise.resolve(sdk), env), /cancelled/);
});

test('rejects missing Kakao native access token', async () => {
  const sdk: KakaoNativeSdk = {
    login: async () => ({}),
  };

  await assert.rejects(() => getKakaoNativeCredential(() => Promise.resolve(sdk), env), /access token is missing/);
});

test('requires native app key for non-dev Kakao login and derives the native scheme', async () => {
  assert.equal(getKakaoNativeScheme(env), 'kakaonative-key');

  const sdk: KakaoNativeSdk = {
    login: async () => ({ accessToken: 'must-not-be-used' }),
  };

  await assert.rejects(
    () => getKakaoNativeCredential(() => Promise.resolve(sdk), {}),
    /EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is required/,
  );
});

test('clears app-local Kakao native SDK session when logout is available', async () => {
  const calls: string[] = [];
  const sdk: KakaoNativeSdk = {
    login: async () => ({ accessToken: 'unused' }),
    logout: async () => {
      calls.push('logout');
      return 'logged out';
    },
  };

  await clearKakaoNativeSession(() => Promise.resolve(sdk));

  assert.deepEqual(calls, ['logout']);
});

test('does not fail app logout when Kakao native SDK session clear is unavailable', async () => {
  await clearKakaoNativeSession(async () => {
    throw new Error('native module unavailable');
  });
});

test('default Kakao native env uses direct Expo public app key reads for native builds', () => {
  const source = readFileSync(new URL('./kakao.ts', import.meta.url), 'utf8');

  assert.match(source, /process\.env\.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY/);
  assert.doesNotMatch(source, /=\s*process\.env/);
});
