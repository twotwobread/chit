import type { AuthProvider, OAuthCredential } from '@i-um/api-contract';

import { theme } from '../design/theme';
import { getAppleCredential } from './apple';
import { getKakaoNativeCredential } from './kakao';

export type OAuthProviderAvailability = { status: 'available' } | { status: 'unavailable'; reason: string };

export type OAuthProviderButtonStyle = {
  backgroundColor: string;
  textColor: string;
};

export type OAuthProviderConfig = {
  id: AuthProvider;
  label: string;
  order: number;
  availability: () => OAuthProviderAvailability;
  buttonStyle: OAuthProviderButtonStyle;
  loginLabel: (provider: OAuthProviderConfig) => string;
  linkLabel: (provider: OAuthProviderConfig, linked: boolean) => string;
  getCredential: () => Promise<OAuthCredential>;
};

type OAuthEnv = {
  EXPO_PUBLIC_AUTH_DEV_MODE?: string;
};

type GetOAuthCredentialOptions = {
  providers?: OAuthProviderConfig[];
  env?: OAuthEnv;
};

export class UnsupportedOAuthProviderError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`Unsupported OAuth provider: ${provider}`);
    this.name = 'UnsupportedOAuthProviderError';
    this.provider = provider;
  }
}

export class OAuthProviderUnavailableError extends Error {
  readonly provider: AuthProvider;

  constructor(provider: AuthProvider, reason: string) {
    super(reason);
    this.name = 'OAuthProviderUnavailableError';
    this.provider = provider;
  }
}

export const defaultOAuthProviderConfigs: OAuthProviderConfig[] = [
  {
    id: 'apple',
    label: 'Apple',
    order: 10,
    availability: () => ({ status: 'available' }),
    buttonStyle: {
      backgroundColor: theme.providerColor.appleBg,
      textColor: theme.providerColor.appleText,
    },
    loginLabel: ({ label }) => `${label}로 계속하기`,
    linkLabel: ({ label }, linked) => `${label} ${linked ? '연결됨' : '연결'}`,
    getCredential: getAppleCredential,
  },
  {
    id: 'kakao',
    label: 'Kakao',
    order: 20,
    availability: () => ({ status: 'available' }),
    buttonStyle: {
      backgroundColor: theme.providerColor.kakaoBg,
      textColor: theme.providerColor.kakaoText,
    },
    loginLabel: ({ label }) => `${label}로 계속하기`,
    linkLabel: ({ label }, linked) => `${label} ${linked ? '연결됨' : '연결'}`,
    getCredential: getKakaoNativeCredential,
  },
];

export function getOAuthProviderConfigs(
  providers: OAuthProviderConfig[] = defaultOAuthProviderConfigs,
): OAuthProviderConfig[] {
  return [...providers].sort((left, right) => left.order - right.order);
}

export function getVisibleOAuthProviderConfigs(
  providers: OAuthProviderConfig[] = defaultOAuthProviderConfigs,
): OAuthProviderConfig[] {
  return getOAuthProviderConfigs(providers).filter((provider) => provider.availability().status === 'available');
}

export async function getOAuthCredential(
  provider: AuthProvider | string,
  options: GetOAuthCredentialOptions = {},
): Promise<OAuthCredential> {
  const providers = options.providers ?? defaultOAuthProviderConfigs;
  const config = providers.find((candidate) => candidate.id === provider);
  if (!config) {
    throw new UnsupportedOAuthProviderError(provider);
  }

  const availability = config.availability();
  if (availability.status !== 'available') {
    throw new OAuthProviderUnavailableError(config.id, availability.reason);
  }

  const env = options.env ?? process.env;
  if (env.EXPO_PUBLIC_AUTH_DEV_MODE === 'true') {
    return getDevCredential(config);
  }

  return config.getCredential();
}

function getDevCredential(provider: OAuthProviderConfig): OAuthCredential {
  return {
    devSubject: `${provider.id}-dev-user`,
    email: 'dev@example.com',
    emailVerified: true,
    displayName: `${provider.label} Dev User`,
  };
}
