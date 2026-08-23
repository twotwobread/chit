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
  type PromoteTripMeetingRequest,
  type PromoteTripMeetingResponse,
  type ReplaceTripParticipantsRequest,
  type ListTripsResponse,
  type UpdateTripRequest,
  type UpdateTripResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  return runAuthenticatedRequest(() => TripsService.createTrip(request));
}

export async function searchDestinations(query: string, limit = 10): Promise<SearchDestinationsResponse> {
  return runAuthenticatedRequest(() => DestinationsService.searchDestinations(query, limit));
}

export async function getTripDetail(tripId: string): Promise<GetTripDetailResponse> {
  return runAuthenticatedRequest(() => TripsService.getTripDetail(tripId));
}

export async function listTripParticipants(tripId: string): Promise<ListTripParticipantsResponse> {
  return runAuthenticatedRequest(() => TripsService.listTripParticipants(tripId));
}

export async function listTripPlaces(tripId: string): Promise<ListTripPlacesResponse> {
  return runAuthenticatedRequest(() => TripsService.listTripPlaces(tripId));
}

export async function removeTripParticipant(tripId: string, participantId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.removeTripParticipant(tripId, participantId));
}

export async function replaceTripParticipants(
  tripId: string,
  request: ReplaceTripParticipantsRequest,
): Promise<ListTripParticipantsResponse> {
  return runAuthenticatedRequest(() => TripsService.replaceTripParticipants(tripId, request));
}

export async function promoteTripMeeting(
  tripId: string,
  request: PromoteTripMeetingRequest,
): Promise<PromoteTripMeetingResponse> {
  return runAuthenticatedRequest(() => TripsService.promoteTripMeeting(tripId, request));
}

export async function createTripInvite(tripId: string): Promise<CreateTripInviteResponse> {
  return runAuthenticatedRequest(() => TripsService.createTripInvite(tripId));
}

export async function acceptTripInvite(token: string): Promise<AcceptTripInviteResponse> {
  return runAuthenticatedRequest(() => TripsService.acceptTripInvite(token));
}

export async function updateTrip(tripId: string, request: UpdateTripRequest): Promise<UpdateTripResponse> {
  return runAuthenticatedRequest(() => TripsService.updateTrip(tripId, request));
}

export async function deleteTrip(tripId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.deleteTrip(tripId));
}

export async function listMyTrips(): Promise<ListTripsResponse> {
  return runAuthenticatedRequest(() => TripsService.listTrips());
}
