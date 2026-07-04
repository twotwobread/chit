import {
  AuthService,
  TripsService,
  type GetMySettlementSummaryResponse,
  type GetTripSettlementResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';

export async function getTripSettlement(tripId: string): Promise<GetTripSettlementResponse> {
  await getMeWithRefresh();
  return TripsService.getTripSettlement(tripId);
}

export async function getMySettlementSummary(): Promise<GetMySettlementSummaryResponse> {
  await getMeWithRefresh();
  return AuthService.getMySettlementSummary();
}
