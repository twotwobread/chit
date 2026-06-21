import { OpenAPI } from '@i-um/api-contract';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export function configureApi(accessToken?: string | null) {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required.');
  }

  OpenAPI.BASE = trimTrailingSlash(baseUrl);
  OpenAPI.TOKEN = accessToken ?? undefined;
}
