import { PlacesService, type CreateGooglePlaceDayItineraryItemResponse, type SearchGooglePlacesResponse } from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';
import { buildCreateGooglePlaceDayItineraryItemRequest, googlePlaceSearchDefaultLimit, normalizeGooglePlaceSearchQuery } from './google-search';

export async function searchGooglePlaces(tripId: string, date: string, query: string, limit = googlePlaceSearchDefaultLimit): Promise<SearchGooglePlacesResponse> {
  await getMeWithRefresh();
  return PlacesService.searchGooglePlaces(tripId, date, normalizeGooglePlaceSearchQuery(query), limit);
}

export async function createGooglePlaceDayItineraryItem(
  tripId: string,
  date: string,
  googlePlaceId: string,
  duplicateConfirmed: boolean,
): Promise<CreateGooglePlaceDayItineraryItemResponse> {
  await getMeWithRefresh();
  return PlacesService.createGooglePlaceDayItineraryItem(tripId, date, buildCreateGooglePlaceDayItineraryItemRequest(googlePlaceId, duplicateConfirmed));
}
