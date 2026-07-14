import {
  TripsService,
  type CreateManualDayLodgingPlaceRequest,
  type CreateManualScheduleItemRequest,
  type CreateManualScheduleItemResponse,
  type CreateRoutePreviewRequest,
  type GetDayScheduleItemsResponse,
  type ListTripScheduleItemsResponse,
  type MarkScheduleItemArrivedResponse,
  type MarkScheduleItemSkippedResponse,
  type ReorderScheduleItemsRequest,
  type ReorderScheduleItemsResponse,
  type RestoreScheduleItemResponse,
  type RoutePreviewResponse,
  type SetDayLodgingPlaceRequest,
  type SetDayLodgingPlaceResponse,
  type UpdateScheduleItemRequest,
  type UpdateScheduleItemResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function getTripDayItinerary(tripId: string, tripDayId: string): Promise<GetDayScheduleItemsResponse> {
  return runAuthenticatedRequest(() => TripsService.getDayScheduleItems(tripId, tripDayId));
}

export async function listTripScheduleItems(tripId: string): Promise<ListTripScheduleItemsResponse> {
  return runAuthenticatedRequest(() => TripsService.listTripScheduleItems(tripId));
}

export async function createManualScheduleItem(
  tripId: string,
  date: string,
  request: CreateManualScheduleItemRequest,
): Promise<CreateManualScheduleItemResponse> {
  return runAuthenticatedRequest(() => TripsService.createManualScheduleItem(tripId, date, request));
}

export async function setDayLodgingPlace(
  tripId: string,
  date: string,
  request: SetDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  return runAuthenticatedRequest(() => TripsService.setDayLodgingPlace(tripId, date, request));
}

export async function createManualDayLodgingPlace(
  tripId: string,
  date: string,
  request: CreateManualDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  return runAuthenticatedRequest(() => TripsService.createManualDayLodgingPlace(tripId, date, request));
}

export async function clearDayLodgingPlace(tripId: string, date: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.clearDayLodgingPlace(tripId, date));
}

export async function reorderScheduleItems(
  tripId: string,
  date: string,
  request: ReorderScheduleItemsRequest,
): Promise<ReorderScheduleItemsResponse> {
  return runAuthenticatedRequest(() => TripsService.reorderScheduleItems(tripId, date, request));
}

export async function markScheduleItemArrived(
  tripId: string,
  date: string,
  itemId: string,
): Promise<MarkScheduleItemArrivedResponse> {
  return runAuthenticatedRequest(() => TripsService.markScheduleItemArrived(tripId, date, itemId));
}

export async function markScheduleItemSkipped(
  tripId: string,
  date: string,
  itemId: string,
): Promise<MarkScheduleItemSkippedResponse> {
  return runAuthenticatedRequest(() => TripsService.markScheduleItemSkipped(tripId, date, itemId));
}

export async function restoreScheduleItem(
  tripId: string,
  date: string,
  itemId: string,
): Promise<RestoreScheduleItemResponse> {
  return runAuthenticatedRequest(() => TripsService.restoreScheduleItem(tripId, date, itemId));
}

export async function createRoutePreview(
  tripId: string,
  date: string,
  itemId: string,
  request: CreateRoutePreviewRequest,
): Promise<RoutePreviewResponse> {
  return runAuthenticatedRequest(() => TripsService.createRoutePreview(tripId, date, itemId, request));
}

export async function updateScheduleItem(
  tripId: string,
  date: string,
  itemId: string,
  request: UpdateScheduleItemRequest,
): Promise<UpdateScheduleItemResponse> {
  return runAuthenticatedRequest(() => TripsService.updateScheduleItem(tripId, date, itemId, request));
}

export async function deleteScheduleItem(tripId: string, date: string, itemId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.deleteScheduleItem(tripId, date, itemId));
}
