import {
  DestinationsService,
  TripsService,
  type AcceptTripInviteResponse,
  type CreateTripInviteResponse,
  type CreateTripRequest,
  type CreateTripResponse,
  type GetTripDetailResponse,
  type SearchDestinationsResponse,
  type ListTripParticipantsResponse,
  type ListTripPlacesResponse,
  type ListTripsResponse,
  type UpdateTripRequest,
  type UpdateTripResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  await getMeWithRefresh();
  return TripsService.createTrip(request);
}

export async function searchDestinations(query: string, limit = 10): Promise<SearchDestinationsResponse> {
  await getMeWithRefresh();
  return DestinationsService.searchDestinations(query, limit);
}

export async function getTripDetail(tripId: string): Promise<GetTripDetailResponse> {
  await getMeWithRefresh();
  return TripsService.getTripDetail(tripId);
}

export async function listTripParticipants(tripId: string): Promise<ListTripParticipantsResponse> {
  await getMeWithRefresh();
  return TripsService.listTripParticipants(tripId);
}

export async function listTripPlaces(tripId: string): Promise<ListTripPlacesResponse> {
  await getMeWithRefresh();
  return TripsService.listTripPlaces(tripId);
}

export async function removeTripParticipant(tripId: string, participantId: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.removeTripParticipant(tripId, participantId);
}

export async function createTripInvite(tripId: string): Promise<CreateTripInviteResponse> {
  await getMeWithRefresh();
  return TripsService.createTripInvite(tripId);
}

export async function acceptTripInvite(token: string): Promise<AcceptTripInviteResponse> {
  await getMeWithRefresh();
  return TripsService.acceptTripInvite(token);
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
