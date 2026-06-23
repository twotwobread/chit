/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateManualDayItineraryItemRequest } from '../models/CreateManualDayItineraryItemRequest';
import type { CreateManualDayItineraryItemResponse } from '../models/CreateManualDayItineraryItemResponse';
import type { CreateTripRequest } from '../models/CreateTripRequest';
import type { CreateTripResponse } from '../models/CreateTripResponse';
import type { GetDayItineraryResponse } from '../models/GetDayItineraryResponse';
import type { GetTripDetailResponse } from '../models/GetTripDetailResponse';
import type { ListTripParticipantsResponse } from '../models/ListTripParticipantsResponse';
import type { ListTripsResponse } from '../models/ListTripsResponse';
import type { ReorderDayItineraryItemsRequest } from '../models/ReorderDayItineraryItemsRequest';
import type { ReorderDayItineraryItemsResponse } from '../models/ReorderDayItineraryItemsResponse';
import type { UpdateDayItineraryItemRequest } from '../models/UpdateDayItineraryItemRequest';
import type { UpdateDayItineraryItemResponse } from '../models/UpdateDayItineraryItemResponse';
import type { UpdateTripRequest } from '../models/UpdateTripRequest';
import type { UpdateTripResponse } from '../models/UpdateTripResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TripsService {
    /**
     * List my trips
     * Returns trips where the authenticated user is an Owner or Member participant.
     * @returns ListTripsResponse Participated trips for the authenticated user.
     * @throws ApiError
     */
    public static listTrips(): CancelablePromise<ListTripsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips',
            errors: {
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a trip
     * Creates a Trip and the authenticated user's Owner participant.
     * @param requestBody
     * @returns CreateTripResponse Trip created.
     * @throws ApiError
     */
    public static createTrip(
        requestBody: CreateTripRequest,
    ): CancelablePromise<CreateTripResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get trip detail
     * Returns basic trip detail for an authenticated trip participant.
     * @param tripId
     * @returns GetTripDetailResponse Trip detail.
     * @throws ApiError
     */
    public static getTripDetail(
        tripId: string,
    ): CancelablePromise<GetTripDetailResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}',
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
     * Update trip basic information
     * Updates basic trip metadata for the authenticated trip owner. Only changed fields need to be sent.
     * @param tripId
     * @param requestBody
     * @returns UpdateTripResponse Trip updated.
     * @throws ApiError
     */
    public static updateTrip(
        tripId: string,
        requestBody: UpdateTripRequest,
    ): CancelablePromise<UpdateTripResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}',
            path: {
                'tripId': tripId,
            },
            body: requestBody,
            mediaType: 'application/json',
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
     * Delete a trip
     * Hard-deletes a trip for all participants when requested by the authenticated trip owner.
     * @param tripId
     * @returns void
     * @throws ApiError
     */
    public static deleteTrip(
        tripId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}',
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
     * List trip participants
     * Returns the current accepted participants for a trip. Only authenticated current trip participants can access the list.
     * @param tripId
     * @returns ListTripParticipantsResponse Current trip participants.
     * @throws ApiError
     */
    public static listTripParticipants(
        tripId: string,
    ): CancelablePromise<ListTripParticipantsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/participants',
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
     * Get a trip day itinerary
     * Returns the ordered read-only itinerary items for a selected virtual trip day.
     * @param tripId
     * @param date
     * @returns GetDayItineraryResponse Day itinerary.
     * @throws ApiError
     */
    public static getDayItinerary(
        tripId: string,
        date: string,
    ): CancelablePromise<GetDayItineraryResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{date}/itinerary',
            path: {
                'tripId': tripId,
                'date': date,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or virtual day not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Add a manual place to a trip day itinerary
     * Creates a manual trip place snapshot and appends a linked itinerary item to the selected virtual trip day.
     * @param tripId
     * @param date
     * @param requestBody
     * @returns CreateManualDayItineraryItemResponse Manual place added to the selected Day itinerary.
     * @throws ApiError
     */
    public static createManualDayItineraryItem(
        tripId: string,
        date: string,
        requestBody: CreateManualDayItineraryItemRequest,
    ): CancelablePromise<CreateManualDayItineraryItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/itinerary-items',
            path: {
                'tripId': tripId,
                'date': date,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or virtual day not found.`,
                409: `Concurrent append conflict.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Reorder a trip day itinerary
     * Applies an ordered batch of same-Day itinerary item moves inside one transaction and returns the latest Day itinerary.
     * @param tripId
     * @param date
     * @param requestBody
     * @returns ReorderDayItineraryItemsResponse Day itinerary reordered.
     * @throws ApiError
     */
    public static reorderDayItineraryItems(
        tripId: string,
        date: string,
        requestBody: ReorderDayItineraryItemsRequest,
    ): CancelablePromise<ReorderDayItineraryItemsResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/days/{date}/itinerary-items/order',
            path: {
                'tripId': tripId,
                'date': date,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or virtual day not found.`,
                409: `Reorder conflict.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update a trip day itinerary item place snapshot
     * Updates name, address, and/or place type for the trip place snapshot linked from the selected Day itinerary item.
     * @param tripId
     * @param date
     * @param itemId
     * @param requestBody
     * @returns UpdateDayItineraryItemResponse Day itinerary item updated.
     * @throws ApiError
     */
    public static updateDayItineraryItem(
        tripId: string,
        date: string,
        itemId: string,
        requestBody: UpdateDayItineraryItemRequest,
    ): CancelablePromise<UpdateDayItineraryItemResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}',
            path: {
                'tripId': tripId,
                'date': date,
                'itemId': itemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, virtual day, or itinerary item not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Delete a trip day itinerary item
     * Removes the selected itinerary item from the virtual Day and orphan-cleans the linked trip place when unreferenced.
     * @param tripId
     * @param date
     * @param itemId
     * @returns void
     * @throws ApiError
     */
    public static deleteDayItineraryItem(
        tripId: string,
        date: string,
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}',
            path: {
                'tripId': tripId,
                'date': date,
                'itemId': itemId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, virtual day, or itinerary item not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
}
