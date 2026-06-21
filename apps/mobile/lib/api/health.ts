import {
  HealthService,
  OpenAPI,
  type HealthResponse,
  type ReadinessResponse,
} from '@i-um/api-contract';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

function configureApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required.');
  }

  OpenAPI.BASE = trimTrailingSlash(baseUrl);
}

export async function fetchHealthAndReadiness(): Promise<{
  health: HealthResponse;
  readiness: ReadinessResponse;
}> {
  configureApiBaseUrl();

  const health = await HealthService.getHealth();
  const readiness = await HealthService.getReady();

  return { health, readiness };
}
