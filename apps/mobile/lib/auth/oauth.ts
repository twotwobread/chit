import * as AppleAuthentication from 'expo-apple-authentication';

import type { AuthProvider, OAuthCredential } from '@i-um/api-contract';

import { getKakaoNativeCredential } from './kakao';

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
  return getKakaoNativeCredential();
}

function getDevCredential(provider: AuthProvider): OAuthCredential {
  return {
    devSubject: `${provider}-dev-user`,
    email: 'dev@example.com',
    emailVerified: true,
    displayName: provider === 'apple' ? 'Apple Dev User' : 'Kakao Dev User',
  };
}
