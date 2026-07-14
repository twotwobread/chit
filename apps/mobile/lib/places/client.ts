import {
  PlacesService,
  type CreateGoogleDayLodgingPlaceRequest,
  type CreateGooglePlaceScheduleItemRequest,
  type CreateGooglePlaceScheduleItemResponse,
  type CreateGoogleTripPlaceBookmarkRequest,
  type CreateGoogleTripPlaceBookmarkResponse,
  type GooglePlaceDetailsResponse,
  type ListTripPlaceBookmarksResponse,
  type SearchGooglePlacesResponse,
  type SetDayLodgingPlaceResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';
import {
  buildCreateGooglePlaceScheduleItemRequest,
  googlePlaceSearchDefaultLimit,
  normalizeGooglePlaceSearchQuery,
  type GooglePlaceSearchBias,
} from './google-search';

export type SearchGooglePlacesOptions = Partial<GooglePlaceSearchBias> & { limit?: number };

export async function searchGooglePlaces(
  tripId: string,
  tripDayId: string,
  query: string,
  limitOrOptions: number | SearchGooglePlacesOptions = googlePlaceSearchDefaultLimit,
): Promise<SearchGooglePlacesResponse> {
  const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
  return runAuthenticatedRequest(() =>
    PlacesService.searchGooglePlaces(
      tripId,
      tripDayId,
      normalizeGooglePlaceSearchQuery(query),
      options.limit ?? googlePlaceSearchDefaultLimit,
      options.latitude,
      options.longitude,
      options.radiusMeters,
    ),
  );
}

export async function getGooglePlaceDetails(
  tripId: string,
  tripDayId: string,
  googlePlaceId: string,
): Promise<GooglePlaceDetailsResponse> {
  return runAuthenticatedRequest(() => PlacesService.getGooglePlaceDetails(tripId, tripDayId, googlePlaceId));
}

export async function listTripPlaceBookmarks(tripId: string): Promise<ListTripPlaceBookmarksResponse> {
  return runAuthenticatedRequest(() => PlacesService.listTripPlaceBookmarks(tripId));
}

export async function createGoogleTripPlaceBookmark(
  tripId: string,
  request: CreateGoogleTripPlaceBookmarkRequest,
): Promise<CreateGoogleTripPlaceBookmarkResponse> {
  return runAuthenticatedRequest(() => PlacesService.createGoogleTripPlaceBookmark(tripId, request));
}

export async function deleteTripPlaceBookmark(tripId: string, bookmarkId: string): Promise<void> {
  return runAuthenticatedRequest(() => PlacesService.deleteTripPlaceBookmark(tripId, bookmarkId));
}

export async function createGoogleDayLodgingPlace(
  tripId: string,
  tripDayId: string,
  request: CreateGoogleDayLodgingPlaceRequest,
): Promise<SetDayLodgingPlaceResponse> {
  return runAuthenticatedRequest(() => PlacesService.createGoogleDayLodgingPlace(tripId, tripDayId, request));
}

export async function createGooglePlaceScheduleItem(
  tripId: string,
  tripDayId: string,
  request: CreateGooglePlaceScheduleItemRequest,
): Promise<CreateGooglePlaceScheduleItemResponse>;
export async function createGooglePlaceScheduleItem(
  tripId: string,
  tripDayId: string,
  googlePlaceId: string,
  duplicateConfirmed: boolean,
  title: string,
): Promise<CreateGooglePlaceScheduleItemResponse>;
export async function createGooglePlaceScheduleItem(
  tripId: string,
  tripDayId: string,
  requestOrGooglePlaceId: CreateGooglePlaceScheduleItemRequest | string,
  duplicateConfirmed?: boolean,
  title?: string,
): Promise<CreateGooglePlaceScheduleItemResponse> {
  const request =
    typeof requestOrGooglePlaceId === 'string'
      ? buildCreateGooglePlaceScheduleItemRequest(requestOrGooglePlaceId, duplicateConfirmed === true, title ?? '')
      : requestOrGooglePlaceId;
  return runAuthenticatedRequest(() => PlacesService.createGooglePlaceScheduleItem(tripId, tripDayId, request));
}
