/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateGoogleDayLodgingPlaceRequest } from '../models/CreateGoogleDayLodgingPlaceRequest';
import type { CreateGooglePlaceScheduleItemRequest } from '../models/CreateGooglePlaceScheduleItemRequest';
import type { CreateGooglePlaceScheduleItemResponse } from '../models/CreateGooglePlaceScheduleItemResponse';
import type { CreateGoogleTripPlaceBookmarkRequest } from '../models/CreateGoogleTripPlaceBookmarkRequest';
import type { CreateGoogleTripPlaceBookmarkResponse } from '../models/CreateGoogleTripPlaceBookmarkResponse';
import type { GooglePlaceDetailsResponse } from '../models/GooglePlaceDetailsResponse';
import type { ListTripPlaceBookmarksResponse } from '../models/ListTripPlaceBookmarksResponse';
import type { SearchGooglePlacesResponse } from '../models/SearchGooglePlacesResponse';
import type { SetDayLodgingPlaceResponse } from '../models/SetDayLodgingPlaceResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PlacesService {
    /**
     * Create or reuse a Google-backed lodging place and set Day lodging
     * Resolves a Google-backed place server-side, upserts or reuses the trip-level place by googlePlaceId, and stores it as the selected Day lodging target. Does not create a Day schedule item.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns SetDayLodgingPlaceResponse Google-backed lodging place created or reused and set as Day lodging.
     * @throws ApiError
     */
    public static createGoogleDayLodgingPlace(
        tripId: string,
        tripDayId: string,
        requestBody: CreateGoogleDayLodgingPlaceRequest,
    ): CancelablePromise<SetDayLodgingPlaceResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/lodging-place/google',
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
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
    /**
     * Search Google Places for a trip day
     * Returns display-only Google Places text search results for an authenticated trip participant and in-range virtual trip day. Results are not persisted.
     * @param tripId
     * @param tripDayId
     * @param query
     * @param limit
     * @param latitude Map center latitude used as a Google Text Search location bias.
     * @param longitude Map center longitude used as a Google Text Search location bias.
     * @param radiusMeters Search bias radius in meters. Requires latitude and longitude when provided.
     * @returns SearchGooglePlacesResponse Google Places search results.
     * @throws ApiError
     */
    public static searchGooglePlaces(
        tripId: string,
        tripDayId: string,
        query: string,
        limit: number = 10,
        latitude?: number,
        longitude?: number,
        radiusMeters?: number,
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
                'latitude': latitude,
                'longitude': longitude,
                'radiusMeters': radiusMeters,
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
     * Get selected Google Place details
     * Returns selected-only display details for an authenticated trip participant and in-range virtual trip day. Used after a user focuses a search result.
     * @param tripId
     * @param tripDayId
     * @param googlePlaceId
     * @returns GooglePlaceDetailsResponse Selected Google Place details.
     * @throws ApiError
     */
    public static getGooglePlaceDetails(
        tripId: string,
        tripDayId: string,
        googlePlaceId: string,
    ): CancelablePromise<GooglePlaceDetailsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/places/google/{googlePlaceId}/details',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'googlePlaceId': googlePlaceId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or Google place not found.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
    /**
     * Resolve a selected Google Place photo
     * Validates a short-lived server-issued Google Place photo token and redirects to the provider photo URI for an authenticated trip participant.
     * @param tripId
     * @param tripDayId
     * @param photoToken
     * @param maxWidthPx
     * @returns void
     * @throws ApiError
     */
    public static getGooglePlacePhoto(
        tripId: string,
        tripDayId: string,
        photoToken: string,
        maxWidthPx: number = 320,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/places/google/photos/{photoToken}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'photoToken': photoToken,
            },
            query: {
                'maxWidthPx': maxWidthPx,
            },
            errors: {
                302: `Redirects to a short-lived provider photo URI.`,
                400: `Validation error or invalid photo token.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or photo not found.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
    /**
     * List bookmarked candidate places for a trip
     * Returns trip-level Google-backed candidate places saved before scheduling.
     * @param tripId
     * @returns ListTripPlaceBookmarksResponse Bookmarked candidate places for the trip.
     * @throws ApiError
     */
    public static listTripPlaceBookmarks(
        tripId: string,
    ): CancelablePromise<ListTripPlaceBookmarksResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/place-bookmarks',
            path: {
                'tripId': tripId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Bookmark a Google Place as a trip candidate place
     * Resolves a Google-backed place server-side, reuses the trip-level place by googlePlaceId when present, and stores or updates a trip-level bookmark category without adding it to a Day schedule.
     * @param tripId
     * @param requestBody
     * @returns CreateGoogleTripPlaceBookmarkResponse Google-backed candidate place bookmarked for the trip.
     * @throws ApiError
     */
    public static createGoogleTripPlaceBookmark(
        tripId: string,
        requestBody: CreateGoogleTripPlaceBookmarkRequest,
    ): CancelablePromise<CreateGoogleTripPlaceBookmarkResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/place-bookmarks/google',
            path: {
                'tripId': tripId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or Google place not found.`,
                429: `Google Places provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Google Places provider unavailable.`,
            },
        });
    }
    /**
     * Remove a bookmarked candidate place from a trip
     * Deletes the trip-level bookmark. The underlying trip_place remains available for existing schedule items.
     * @param tripId
     * @param bookmarkId
     * @returns void
     * @throws ApiError
     */
    public static deleteTripPlaceBookmark(
        tripId: string,
        bookmarkId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/place-bookmarks/{bookmarkId}',
            path: {
                'tripId': tripId,
                'bookmarkId': bookmarkId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or bookmark not found.`,
                500: `Unexpected server error.`,
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
