import {
  TripsService,
  type CreateManualDayLodgingPlaceRequest,
  type CreateManualScheduleItemRequest,
  type CreateManualScheduleItemResponse,
  type CreateRoutePreviewRequest,
  type GetDayScheduleItemsResponse,
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

import { getMeWithRefresh } from '../auth/client';

export async function getTripDayItinerary(tripId: string, tripDayId: string): Promise<GetDayScheduleItemsResponse> {
  await getMeWithRefresh();
  return TripsService.getDayScheduleItems(tripId, tripDayId);
}

export async function createManualScheduleItem(
  tripId: string,
  date: string,
  request: CreateManualScheduleItemRequest,
): Promise<CreateManualScheduleItemResponse> {
  await getMeWithRefresh();
  return TripsService.createManualScheduleItem(tripId, date, request);
}

export async function setDayLodgingPlace(
  tripId: string,
  date: string,
  request: SetDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  await getMeWithRefresh();
  return TripsService.setDayLodgingPlace(tripId, date, request);
}

export async function createManualDayLodgingPlace(
  tripId: string,
  date: string,
  request: CreateManualDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  await getMeWithRefresh();
  return TripsService.createManualDayLodgingPlace(tripId, date, request);
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
