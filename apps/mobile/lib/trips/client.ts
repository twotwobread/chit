import {
  TripsService,
  type CreateManualDayItineraryItemRequest,
  type CreateManualDayItineraryItemResponse,
  type CreateTripRequest,
  type CreateTripResponse,
  type GetDayItineraryResponse,
  type GetTripDetailResponse,
  type ListTripsResponse,
  type UpdateTripRequest,
  type UpdateTripResponse,
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

export async function getTripDayItinerary(tripId: string, date: string): Promise<GetDayItineraryResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.getDayItinerary(tripId, date);
}

export async function createManualDayItineraryItem(
  tripId: string,
  date: string,
  request: CreateManualDayItineraryItemRequest,
): Promise<CreateManualDayItineraryItemResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.createManualDayItineraryItem(tripId, date, request);
}

export async function updateTrip(tripId: string, request: UpdateTripRequest): Promise<UpdateTripResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.updateTrip(tripId, request);
}

export async function deleteTrip(tripId: string): Promise<void> {
  await getCurrentUserWithRefresh();
  return TripsService.deleteTrip(tripId);
}

export async function listMyTrips(): Promise<ListTripsResponse> {
  await getCurrentUserWithRefresh();
  return TripsService.listTrips();
}
