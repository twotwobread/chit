import { HealthService, type HealthResponse, type ReadinessResponse } from '@i-um/api-contract';

import { configureApi } from './config';

export async function fetchHealthAndReadiness(): Promise<{
  health: HealthResponse;
  readiness: ReadinessResponse;
}> {
  configureApi();

  const health = await HealthService.getHealth();
  const readiness = await HealthService.getReady();

  return { health, readiness };
}
