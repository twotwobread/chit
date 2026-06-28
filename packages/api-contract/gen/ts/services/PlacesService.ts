/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateGooglePlaceScheduleItemRequest } from '../models/CreateGooglePlaceScheduleItemRequest';
import type { CreateGooglePlaceScheduleItemResponse } from '../models/CreateGooglePlaceScheduleItemResponse';
import type { SearchGooglePlacesResponse } from '../models/SearchGooglePlacesResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PlacesService {
    /**
     * Search Google Places for a trip day
     * Returns display-only Google Places text search results for an authenticated trip participant and in-range virtual trip day. Results are not persisted.
     * @param tripId
     * @param tripDayId
     * @param query
     * @param limit
     * @returns SearchGooglePlacesResponse Google Places search results.
     * @throws ApiError
     */
    public static searchGooglePlaces(
        tripId: string,
        tripDayId: string,
        query: string,
        limit: number = 5,
    ): CancelablePromise<SearchGooglePlacesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/places/google/search',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
            },
            query: {
                'query': query,
                'limit': limit,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip day not found.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
    /**
     * Add a Google Place result to a trip day schedule
     * Resolves a Google-backed place server-side, reuses the trip-level place by googlePlaceId when present, and appends a Day schedule item. Same-Day duplicates require explicit confirmation.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns CreateGooglePlaceScheduleItemResponse Google-backed place added to the selected Day schedule.
     * @throws ApiError
     */
    public static createGooglePlaceScheduleItem(
        tripId: string,
        tripDayId: string,
        requestBody: CreateGooglePlaceScheduleItemRequest,
    ): CancelablePromise<CreateGooglePlaceScheduleItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/places/google/schedule-items',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip day not found.`,
                409: `Same-Day duplicate confirmation required or concurrent append conflict.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable or selected provider place is unusable.`,
            },
        });
    }
}
