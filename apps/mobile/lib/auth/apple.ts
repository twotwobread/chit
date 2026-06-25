import type { OAuthCredential } from '@i-um/api-contract';

export type AppleAuthenticationScopeModule = {
  FULL_NAME: unknown;
  EMAIL: unknown;
};

export type AppleAuthenticationFullName = {
  givenName?: string | null;
  familyName?: string | null;
};

export type AppleAuthenticationCredential = {
  identityToken?: string | null;
  authorizationCode?: string | null;
  email?: string | null;
  fullName?: AppleAuthenticationFullName | null;
};

export type AppleAuthenticationModule = {
  AppleAuthenticationScope: AppleAuthenticationScopeModule;
  isAvailableAsync: () => Promise<boolean>;
  signInAsync: (options: { requestedScopes: unknown[] }) => Promise<AppleAuthenticationCredential>;
};

type LoadAppleAuthentication = () => Promise<AppleAuthenticationModule>;

export async function getAppleCredential(
  loadAppleAuthentication: LoadAppleAuthentication = loadExpoAppleAuthentication,
): Promise<OAuthCredential> {
  const AppleAuthentication = await loadAppleAuthentication();
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

  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');

  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode ?? undefined,
    email: credential.email ?? undefined,
    emailVerified: credential.email ? true : undefined,
    displayName: displayName || undefined,
  };
}

async function loadExpoAppleAuthentication(): Promise<AppleAuthenticationModule> {
  return import('expo-apple-authentication') as Promise<AppleAuthenticationModule>;
}
