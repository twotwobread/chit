import {
  TripsService,
  type CreateManualDayItineraryItemRequest,
  type CreateManualDayItineraryItemResponse,
  type CreateTripInviteResponse,
  type CreateTripRequest,
  type CreateTripResponse,
  type GetDayItineraryResponse,
  type GetTripDetailResponse,
  type ListTripParticipantsResponse,
  type ListTripsResponse,
  type ReorderDayItineraryItemsRequest,
  type ReorderDayItineraryItemsResponse,
  type SetDayLodgingPlaceRequest,
  type SetDayLodgingPlaceResponse,
  type UpdateDayItineraryItemRequest,
  type UpdateDayItineraryItemResponse,
  type UpdateTripRequest,
  type UpdateTripResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  await getMeWithRefresh();
  return TripsService.createTrip(request);
}

export async function getTripDetail(tripId: string): Promise<GetTripDetailResponse> {
  await getMeWithRefresh();
  return TripsService.getTripDetail(tripId);
}

export async function listTripParticipants(tripId: string): Promise<ListTripParticipantsResponse> {
  await getMeWithRefresh();
  return TripsService.listTripParticipants(tripId);
}

export async function createTripInvite(tripId: string): Promise<CreateTripInviteResponse> {
  await getMeWithRefresh();
  return TripsService.createTripInvite(tripId);
}

export async function getTripDayItinerary(tripId: string, date: string): Promise<GetDayItineraryResponse> {
  await getMeWithRefresh();
  return TripsService.getDayItinerary(tripId, date);
}

export async function createManualDayItineraryItem(
  tripId: string,
  date: string,
  request: CreateManualDayItineraryItemRequest,
): Promise<CreateManualDayItineraryItemResponse> {
  await getMeWithRefresh();
  return TripsService.createManualDayItineraryItem(tripId, date, request);
}

export async function setDayLodgingPlace(
  tripId: string,
  date: string,
  request: SetDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  await getMeWithRefresh();
  return TripsService.setDayLodgingPlace(tripId, date, request);
}

export async function clearDayLodgingPlace(tripId: string, date: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.clearDayLodgingPlace(tripId, date);
}

export async function reorderDayItineraryItems(
  tripId: string,
  date: string,
  request: ReorderDayItineraryItemsRequest,
): Promise<ReorderDayItineraryItemsResponse> {
  await getMeWithRefresh();
  return TripsService.reorderDayItineraryItems(tripId, date, request);
}

export async function updateDayItineraryItem(
  tripId: string,
  date: string,
  itemId: string,
  request: UpdateDayItineraryItemRequest,
): Promise<UpdateDayItineraryItemResponse> {
  await getMeWithRefresh();
  return TripsService.updateDayItineraryItem(tripId, date, itemId, request);
}

export async function deleteDayItineraryItem(tripId: string, date: string, itemId: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.deleteDayItineraryItem(tripId, date, itemId);
}

export async function updateTrip(tripId: string, request: UpdateTripRequest): Promise<UpdateTripResponse> {
  await getMeWithRefresh();
  return TripsService.updateTrip(tripId, request);
}

export async function deleteTrip(tripId: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.deleteTrip(tripId);
}

export async function listMyTrips(): Promise<ListTripsResponse> {
  await getMeWithRefresh();
  return TripsService.listTrips();
}
