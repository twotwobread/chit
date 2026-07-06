import {
  PlacesService,
  type CreateGooglePlaceScheduleItemRequest,
  type CreateGooglePlaceScheduleItemResponse,
  type SearchGooglePlacesResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';
import { googlePlaceSearchDefaultLimit, normalizeGooglePlaceSearchQuery } from './google-search';

export async function searchGooglePlaces(
  tripId: string,
  tripDayId: string,
  query: string,
  limit = googlePlaceSearchDefaultLimit,
): Promise<SearchGooglePlacesResponse> {
  await getMeWithRefresh();
  return PlacesService.searchGooglePlaces(tripId, tripDayId, normalizeGooglePlaceSearchQuery(query), limit);
}

export async function createGooglePlaceScheduleItem(
  tripId: string,
  tripDayId: string,
  request: CreateGooglePlaceScheduleItemRequest,
): Promise<CreateGooglePlaceScheduleItemResponse> {
  await getMeWithRefresh();
  return PlacesService.createGooglePlaceScheduleItem(tripId, tripDayId, request);
}
