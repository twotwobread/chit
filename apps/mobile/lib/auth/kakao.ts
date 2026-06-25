import type { OAuthCredential } from '@i-um/api-contract';

export type KakaoNativeToken = {
  accessToken?: string | null;
};

export type KakaoNativeSdk = {
  login: () => Promise<KakaoNativeToken>;
  loginWithKakaoAccount?: () => Promise<KakaoNativeToken>;
  logout?: () => Promise<string>;
};

type KakaoNativeEnv = {
  EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?: string;
};

type LoadKakaoNativeSdk = () => Promise<KakaoNativeSdk>;

const FALLBACK_ERROR_CODES = new Set([
  'KAKAO_TALK_UNAVAILABLE',
  'KAKAO_TALK_NOT_AVAILABLE',
  'KAKAO_TALK_NOT_INSTALLED',
  'KAKAOTALK_NOT_INSTALLED',
]);

export async function getKakaoNativeCredential(
  loadSdk: LoadKakaoNativeSdk = loadKakaoNativeSdk,
  env: KakaoNativeEnv = process.env,
): Promise<OAuthCredential> {
  getKakaoNativeAppKey(env);

  const sdk = await loadSdk();
  const token = await loginWithFallback(sdk);
  if (!token.accessToken) {
    throw new Error('Kakao access token is missing.');
  }

  return { accessToken: token.accessToken };
}

export async function clearKakaoNativeSession(loadSdk: LoadKakaoNativeSdk = loadKakaoNativeSdk): Promise<void> {
  try {
    const sdk = await loadSdk();
    await sdk.logout?.();
  } catch {
    // Kakao SDK session clearing is best-effort and must not block i-um logout/local clearing.
  }
}

export function getKakaoNativeScheme(env: KakaoNativeEnv = process.env): string {
  return `kakao${getKakaoNativeAppKey(env)}`;
}

function getKakaoNativeAppKey(env: KakaoNativeEnv): string {
  const appKey = env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  if (!appKey) {
    throw new Error('EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is required for Kakao native login.');
  }
  return appKey;
}

async function loginWithFallback(sdk: KakaoNativeSdk): Promise<KakaoNativeToken> {
  try {
    return await sdk.login();
  } catch (error) {
    if (!sdk.loginWithKakaoAccount || !shouldFallbackToKakaoAccount(error)) {
      throw error;
    }
    return sdk.loginWithKakaoAccount();
  }
}

function shouldFallbackToKakaoAccount(error: unknown): boolean {
  const code = errorCode(error).toUpperCase();
  if (FALLBACK_ERROR_CODES.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('kakaotalk') &&
    (message.includes('not available') || message.includes('unavailable') || message.includes('not installed'))
  );
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

async function loadKakaoNativeSdk(): Promise<KakaoNativeSdk> {
  const sdk = await import('@react-native-seoul/kakao-login');
  return {
    login: sdk.login,
    loginWithKakaoAccount: sdk.loginWithKakaoAccount,
    logout: sdk.logout,
  };
}
