/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptTripInviteResponse } from '../models/AcceptTripInviteResponse';
import type { CreateManualDayItineraryItemRequest } from '../models/CreateManualDayItineraryItemRequest';
import type { CreateManualDayItineraryItemResponse } from '../models/CreateManualDayItineraryItemResponse';
import type { CreateQuickExpenseRequest } from '../models/CreateQuickExpenseRequest';
import type { CreateQuickExpenseResponse } from '../models/CreateQuickExpenseResponse';
import type { CreateRoutePreviewRequest } from '../models/CreateRoutePreviewRequest';
import type { CreateTripInviteResponse } from '../models/CreateTripInviteResponse';
import type { CreateTripRequest } from '../models/CreateTripRequest';
import type { CreateTripResponse } from '../models/CreateTripResponse';
import type { GetDayItineraryResponse } from '../models/GetDayItineraryResponse';
import type { GetTripDetailResponse } from '../models/GetTripDetailResponse';
import type { ListDayExpensesResponse } from '../models/ListDayExpensesResponse';
import type { ListTripParticipantsResponse } from '../models/ListTripParticipantsResponse';
import type { ListTripsResponse } from '../models/ListTripsResponse';
import type { MarkDayItineraryItemArrivedResponse } from '../models/MarkDayItineraryItemArrivedResponse';
import type { MarkDayItineraryItemSkippedResponse } from '../models/MarkDayItineraryItemSkippedResponse';
import type { ReorderDayItineraryItemsRequest } from '../models/ReorderDayItineraryItemsRequest';
import type { ReorderDayItineraryItemsResponse } from '../models/ReorderDayItineraryItemsResponse';
import type { RestoreDayItineraryItemResponse } from '../models/RestoreDayItineraryItemResponse';
import type { RoutePreviewResponse } from '../models/RoutePreviewResponse';
import type { SetDayLodgingPlaceRequest } from '../models/SetDayLodgingPlaceRequest';
import type { SetDayLodgingPlaceResponse } from '../models/SetDayLodgingPlaceResponse';
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
     * Create or retrieve the current trip invite link
     * Creates a new invite link for a trip owner, or returns the existing unexpired current invite link.
     * @param tripId
     * @returns CreateTripInviteResponse Existing active invite link returned.
     * @throws ApiError
     */
    public static createTripInvite(
        tripId: string,
    ): CancelablePromise<CreateTripInviteResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/invites',
            path: {
                'tripId': tripId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip not found.`,
                409: `Invite token conflict after retry.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Accept a trip invite link
     * Accepts a reusable active trip invite for the authenticated user. Existing participants receive an idempotent success response.
     * @param token
     * @returns AcceptTripInviteResponse Invite accepted or already accepted.
     * @throws ApiError
     */
    public static acceptTripInvite(
        token: string,
    ): CancelablePromise<AcceptTripInviteResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/invites/{token}/accept',
            path: {
                'token': token,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Invite token not found.`,
                410: `Invite token expired or deactivated.`,
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
     * Remove a trip participant
     * Removes a member participant from a trip when requested by the authenticated trip owner. Removed members immediately lose trip access and may rejoin through a valid invite link.
     * @param tripId
     * @param participantId
     * @returns void
     * @throws ApiError
     */
    public static removeTripParticipant(
        tripId: string,
        participantId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/participants/{participantId}',
            path: {
                'tripId': tripId,
                'participantId': participantId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or removable participant not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Set a trip day lodging place
     * Stores or replaces the selected Day lodging target for an authenticated trip participant.
     * @param tripId
     * @param date
     * @param requestBody
     * @returns SetDayLodgingPlaceResponse Day lodging place saved.
     * @throws ApiError
     */
    public static setDayLodgingPlace(
        tripId: string,
        date: string,
        requestBody: SetDayLodgingPlaceRequest,
    ): CancelablePromise<SetDayLodgingPlaceResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/days/{date}/lodging-place',
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
                404: `Trip, virtual day, or trip place not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Clear a trip day lodging place
     * Removes the selected Day lodging target for an authenticated trip participant. Clearing an empty Day lodging selection is a 204 no-op.
     * @param tripId
     * @param date
     * @returns void
     * @throws ApiError
     */
    public static clearDayLodgingPlace(
        tripId: string,
        date: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/days/{date}/lodging-place',
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
     * List expenses for a trip day
     * Returns read-only expense rows for the selected trip day, ordered newest-first.
     * @param tripId
     * @param date
     * @returns ListDayExpensesResponse Day expenses.
     * @throws ApiError
     */
    public static listDayExpenses(
        tripId: string,
        date: string,
    ): CancelablePromise<ListDayExpensesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{date}/expenses',
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
     * Create a quick expense for a trip day place
     * Creates an expense from a selected itinerary item, using the trip default currency and equal splits across current trip participants.
     * @param tripId
     * @param date
     * @param requestBody
     * @returns CreateQuickExpenseResponse Quick expense created.
     * @throws ApiError
     */
    public static createQuickExpense(
        tripId: string,
        date: string,
        requestBody: CreateQuickExpenseRequest,
    ): CancelablePromise<CreateQuickExpenseResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/expenses/quick',
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
                404: `Trip, virtual day, itinerary item, or payer participant not found.`,
                409: `Participant or itinerary state changed during creation.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * @deprecated
     * Add a manual place to a trip day itinerary
     * Deprecated. Manual Day itinerary item creation is disabled for normal app use; add Google-backed places instead.
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
                410: `Manual place creation is disabled; use Google-backed place add flow.`,
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
     * Mark a trip day itinerary item arrived
     * Marks the selected itinerary item instance arrived when it is the first pending item for the selected Day, and returns the latest Day itinerary snapshot.
     * @param tripId
     * @param date
     * @param itemId
     * @returns MarkDayItineraryItemArrivedResponse Day itinerary item arrived, or already arrived idempotently.
     * @throws ApiError
     */
    public static markDayItineraryItemArrived(
        tripId: string,
        date: string,
        itemId: string,
    ): CancelablePromise<MarkDayItineraryItemArrivedResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive',
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
                409: `Arrival conflict because the target pending item is not the first pending item for the selected Day.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Mark a trip day itinerary item skipped
     * Marks the selected itinerary item instance skipped when it is the first pending item for the selected Day, and returns the latest Day itinerary snapshot.
     * @param tripId
     * @param date
     * @param itemId
     * @returns MarkDayItineraryItemSkippedResponse Day itinerary item skipped, or already skipped idempotently.
     * @throws ApiError
     */
    public static markDayItineraryItemSkipped(
        tripId: string,
        date: string,
        itemId: string,
    ): CancelablePromise<MarkDayItineraryItemSkippedResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}/skip',
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
                409: `Skip conflict because the target item is arrived or is not the first pending item for the selected Day.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Restore a skipped trip day itinerary item
     * Clears skipped state for the selected itinerary item instance and returns the latest Day itinerary snapshot.
     * @param tripId
     * @param date
     * @param itemId
     * @returns RestoreDayItineraryItemResponse Day itinerary item restored, or already pending idempotently.
     * @throws ApiError
     */
    public static restoreDayItineraryItem(
        tripId: string,
        date: string,
        itemId: string,
    ): CancelablePromise<RestoreDayItineraryItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}/restore',
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
                409: `Restore conflict because the target item is already arrived.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create an in-app route preview for a trip day itinerary item
     * Returns a lightweight current-location-to-next-place route preview for the selected first pending itinerary item. Detailed navigation remains delegated to Google Maps.
     * @param tripId
     * @param date
     * @param itemId
     * @param requestBody
     * @returns RoutePreviewResponse Route preview for the selected current next item.
     * @throws ApiError
     */
    public static createRoutePreview(
        tripId: string,
        date: string,
        itemId: string,
        requestBody: CreateRoutePreviewRequest,
    ): CancelablePromise<RoutePreviewResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{date}/itinerary/items/{itemId}/route-preview',
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
                404: `Trip, virtual day, itinerary item, or provider route not found.`,
                409: `Target item is stale or destination place is not routable.`,
                429: `Route provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Route provider unavailable or returned unusable route data.`,
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
