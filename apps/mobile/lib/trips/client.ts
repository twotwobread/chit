import { TripsService, type CreateTripRequest, type CreateTripResponse } from '@i-um/api-contract';

import { getCurrentUserWithRefresh } from '../auth/client';

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.createTrip(request);
}
