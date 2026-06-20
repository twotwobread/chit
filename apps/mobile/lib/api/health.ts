import { HealthService, OpenAPI, type HealthResponse } from '@i-um/api-contract';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export async function fetchHealth(): Promise<HealthResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required.');
  }

  OpenAPI.BASE = trimTrailingSlash(baseUrl);
  return HealthService.getHealth();
}
