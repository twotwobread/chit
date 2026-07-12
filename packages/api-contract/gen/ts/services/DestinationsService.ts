/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchDestinationsResponse } from '../models/SearchDestinationsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DestinationsService {
    /**
     * Search travel destination cities
     * Returns Google-backed city/admin-level travel destination candidates for trip creation. Results are not persisted until trip creation.
     * @param query Trimmed search text. Must contain at least 2 characters.
     * @param limit
     * @returns SearchDestinationsResponse Destination search results.
     * @throws ApiError
     */
    public static searchDestinations(
        query: string,
        limit: number = 10,
    ): CancelablePromise<SearchDestinationsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/destinations/search',
            query: {
                'query': query,
                'limit': limit,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                429: `Destination provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Destination provider unavailable.`,
            },
        });
    }
}
