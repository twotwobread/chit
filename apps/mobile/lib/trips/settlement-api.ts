import {
  AuthService,
  TripsService,
  type GetMySettlementSummaryResponse,
  type GetTripSettlementResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function getTripSettlement(tripId: string): Promise<GetTripSettlementResponse> {
  return runAuthenticatedRequest(() => TripsService.getTripSettlement(tripId));
}

export async function getMySettlementSummary(): Promise<GetMySettlementSummaryResponse> {
  return runAuthenticatedRequest(() => AuthService.getMySettlementSummary());
}
