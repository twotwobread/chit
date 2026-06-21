import {
  TripsService,
  type CreateTripRequest,
  type CreateTripResponse,
  type GetTripDetailResponse,
  type ListTripsResponse,
} from '@i-um/api-contract';

import { getCurrentUserWithRefresh } from '../auth/client';

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.createTrip(request);
}

export async function getTripDetail(tripId: string): Promise<GetTripDetailResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.getTripDetail(tripId);
}

export async function listMyTrips(): Promise<ListTripsResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.listTrips();
}
