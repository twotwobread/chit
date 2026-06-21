import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import type { AuthProvider, OAuthCredential } from '@i-um/api-contract';

WebBrowser.maybeCompleteAuthSession();

const kakaoDiscovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export async function getOAuthCredential(provider: AuthProvider): Promise<OAuthCredential> {
  if (process.env.EXPO_PUBLIC_AUTH_DEV_MODE === 'true') {
    return getDevCredential(provider);
  }

  if (provider === 'apple') {
    return getAppleCredential();
  }
  return getKakaoCredential();
}

async function getAppleCredential(): Promise<OAuthCredential> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Apple login is not available on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple identity token is missing.');
  }

  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ');

  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode ?? undefined,
    email: credential.email ?? undefined,
    emailVerified: credential.email ? true : undefined,
    displayName: displayName || undefined,
  };
}

async function getKakaoCredential(): Promise<OAuthCredential> {
  const clientId = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
  if (!clientId) {
    throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY is required for Kakao login.');
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'ium' });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['profile_nickname', 'account_email'],
    usePKCE: true,
  });

  const result = await request.promptAsync(kakaoDiscovery);
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Kakao login was cancelled.');
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    kakaoDiscovery,
  );

  if (!token.accessToken) {
    throw new Error('Kakao access token is missing.');
  }

  return { accessToken: token.accessToken };
}

function getDevCredential(provider: AuthProvider): OAuthCredential {
  return {
    devSubject: `${provider}-dev-user`,
    email: 'dev@example.com',
    emailVerified: true,
    displayName: provider === 'apple' ? 'Apple Dev User' : 'Kakao Dev User',
  };
}
