import {
  TripsService,
  type AcceptTripInviteResponse,
  type CreateManualScheduleItemRequest,
  type CreateManualScheduleItemResponse,
  type CreateQuickExpenseRequest,
  type CreateQuickExpenseResponse,
  type CreateRoutePreviewRequest,
  type CreateTripInviteResponse,
  type CreateTripRequest,
  type CreateTripResponse,
  type GetDayScheduleItemsResponse,
  type GetTripDetailResponse,
  type ListDayExpensesResponse,
  type ListTripParticipantsResponse,
  type ListTripsResponse,
  type MarkScheduleItemArrivedResponse,
  type MarkScheduleItemSkippedResponse,
  type ReorderScheduleItemsRequest,
  type ReorderScheduleItemsResponse,
  type RoutePreviewResponse,
  type SetDayLodgingPlaceRequest,
  type SetDayLodgingPlaceResponse,
  type RestoreScheduleItemResponse,
  type UpdateScheduleItemRequest,
  type UpdateScheduleItemResponse,
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

export async function getTripDayItinerary(tripId: string, tripDayId: string): Promise<GetDayScheduleItemsResponse> {
  await getMeWithRefresh();
  return TripsService.getDayScheduleItems(tripId, tripDayId);
}

export async function listDayExpenses(tripId: string, tripDayId: string): Promise<ListDayExpensesResponse> {
  await getMeWithRefresh();
  return TripsService.listDayExpenses(tripId, tripDayId);
}

export async function createManualScheduleItem(
  tripId: string,
  date: string,
  request: CreateManualScheduleItemRequest,
): Promise<CreateManualScheduleItemResponse> {
  await getMeWithRefresh();
  return TripsService.createManualScheduleItem(tripId, date, request);
}

export async function createQuickExpense(
  tripId: string,
  date: string,
  request: CreateQuickExpenseRequest,
): Promise<CreateQuickExpenseResponse> {
  await getMeWithRefresh();
  return TripsService.createQuickExpense(tripId, date, request);
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

export async function reorderScheduleItems(
  tripId: string,
  date: string,
  request: ReorderScheduleItemsRequest,
): Promise<ReorderScheduleItemsResponse> {
  await getMeWithRefresh();
  return TripsService.reorderScheduleItems(tripId, date, request);
}

export async function markScheduleItemArrived(
  tripId: string,
  date: string,
  itemId: string,
): Promise<MarkScheduleItemArrivedResponse> {
  await getMeWithRefresh();
  return TripsService.markScheduleItemArrived(tripId, date, itemId);
}

export async function markScheduleItemSkipped(
  tripId: string,
  date: string,
  itemId: string,
): Promise<MarkScheduleItemSkippedResponse> {
  await getMeWithRefresh();
  return TripsService.markScheduleItemSkipped(tripId, date, itemId);
}

export async function restoreScheduleItem(
  tripId: string,
  date: string,
  itemId: string,
): Promise<RestoreScheduleItemResponse> {
  await getMeWithRefresh();
  return TripsService.restoreScheduleItem(tripId, date, itemId);
}

export async function createRoutePreview(
  tripId: string,
  date: string,
  itemId: string,
  request: CreateRoutePreviewRequest,
): Promise<RoutePreviewResponse> {
  await getMeWithRefresh();
  return TripsService.createRoutePreview(tripId, date, itemId, request);
}

export async function updateScheduleItem(
  tripId: string,
  date: string,
  itemId: string,
  request: UpdateScheduleItemRequest,
): Promise<UpdateScheduleItemResponse> {
  await getMeWithRefresh();
  return TripsService.updateScheduleItem(tripId, date, itemId, request);
}

export async function deleteScheduleItem(tripId: string, date: string, itemId: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.deleteScheduleItem(tripId, date, itemId);
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
