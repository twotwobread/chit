/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchGooglePlacesResponse } from '../models/SearchGooglePlacesResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PlacesService {
    /**
     * Search Google Places for a trip day
     * Returns display-only Google Places text search results for an authenticated trip participant and in-range virtual trip day. Results are not persisted.
     * @param tripId
     * @param date
     * @param query
     * @param limit
     * @returns SearchGooglePlacesResponse Google Places search results.
     * @throws ApiError
     */
    public static searchGooglePlaces(
        tripId: string,
        date: string,
        query: string,
        limit: number = 5,
    ): CancelablePromise<SearchGooglePlacesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{date}/places/google/search',
            path: {
                'tripId': tripId,
                'date': date,
            },
            query: {
                'query': query,
                'limit': limit,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or virtual day not found.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
}
