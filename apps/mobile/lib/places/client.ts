import { PlacesService, type SearchGooglePlacesResponse } from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';
import { googlePlaceSearchDefaultLimit, normalizeGooglePlaceSearchQuery } from './google-search';

export async function searchGooglePlaces(tripId: string, date: string, query: string, limit = googlePlaceSearchDefaultLimit): Promise<SearchGooglePlacesResponse> {
  await getMeWithRefresh();
  return PlacesService.searchGooglePlaces(tripId, date, normalizeGooglePlaceSearchQuery(query), limit);
}
