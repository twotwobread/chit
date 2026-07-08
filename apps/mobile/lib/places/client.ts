import {
  PlacesService,
  type CreateGooglePlaceScheduleItemRequest,
  type CreateGooglePlaceScheduleItemResponse,
  type GooglePlaceDetailsResponse,
  type SearchGooglePlacesResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';
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
  await getMeWithRefresh();
  return PlacesService.searchGooglePlaces(
    tripId,
    tripDayId,
    normalizeGooglePlaceSearchQuery(query),
    options.limit ?? googlePlaceSearchDefaultLimit,
    options.latitude,
    options.longitude,
    options.radiusMeters,
  );
}

export async function getGooglePlaceDetails(
  tripId: string,
  tripDayId: string,
  googlePlaceId: string,
): Promise<GooglePlaceDetailsResponse> {
  await getMeWithRefresh();
  return PlacesService.getGooglePlaceDetails(tripId, tripDayId, googlePlaceId);
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
  await getMeWithRefresh();
  const request =
    typeof requestOrGooglePlaceId === 'string'
      ? buildCreateGooglePlaceScheduleItemRequest(requestOrGooglePlaceId, duplicateConfirmed === true, title ?? '')
      : requestOrGooglePlaceId;
  return PlacesService.createGooglePlaceScheduleItem(tripId, tripDayId, request);
}
