/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptTripInviteResponse } from '../models/AcceptTripInviteResponse';
import type { CreateManualDayLodgingPlaceRequest } from '../models/CreateManualDayLodgingPlaceRequest';
import type { CreateManualScheduleItemRequest } from '../models/CreateManualScheduleItemRequest';
import type { CreateManualScheduleItemResponse } from '../models/CreateManualScheduleItemResponse';
import type { CreateNonPlaceScheduleItemRequest } from '../models/CreateNonPlaceScheduleItemRequest';
import type { CreateNonPlaceScheduleItemResponse } from '../models/CreateNonPlaceScheduleItemResponse';
import type { CreateQuickExpenseRequest } from '../models/CreateQuickExpenseRequest';
import type { CreateQuickExpenseResponse } from '../models/CreateQuickExpenseResponse';
import type { CreateRoutePreviewRequest } from '../models/CreateRoutePreviewRequest';
import type { CreateTripInviteResponse } from '../models/CreateTripInviteResponse';
import type { CreateTripRequest } from '../models/CreateTripRequest';
import type { CreateTripResponse } from '../models/CreateTripResponse';
import type { GetDayScheduleItemsResponse } from '../models/GetDayScheduleItemsResponse';
import type { GetExpenseResponse } from '../models/GetExpenseResponse';
import type { GetTripDetailResponse } from '../models/GetTripDetailResponse';
import type { GetTripSettlementResponse } from '../models/GetTripSettlementResponse';
import type { ListDayExpensesResponse } from '../models/ListDayExpensesResponse';
import type { ListTripParticipantsResponse } from '../models/ListTripParticipantsResponse';
import type { ListTripPlacesResponse } from '../models/ListTripPlacesResponse';
import type { ListTripsResponse } from '../models/ListTripsResponse';
import type { MarkScheduleItemArrivedResponse } from '../models/MarkScheduleItemArrivedResponse';
import type { MarkScheduleItemSkippedResponse } from '../models/MarkScheduleItemSkippedResponse';
import type { ReorderScheduleItemsRequest } from '../models/ReorderScheduleItemsRequest';
import type { ReorderScheduleItemsResponse } from '../models/ReorderScheduleItemsResponse';
import type { RestoreScheduleItemResponse } from '../models/RestoreScheduleItemResponse';
import type { RoutePreviewResponse } from '../models/RoutePreviewResponse';
import type { SetDayLodgingPlaceRequest } from '../models/SetDayLodgingPlaceRequest';
import type { SetDayLodgingPlaceResponse } from '../models/SetDayLodgingPlaceResponse';
import type { UpdateExpenseRequest } from '../models/UpdateExpenseRequest';
import type { UpdateExpenseResponse } from '../models/UpdateExpenseResponse';
import type { UpdateScheduleItemRequest } from '../models/UpdateScheduleItemRequest';
import type { UpdateScheduleItemResponse } from '../models/UpdateScheduleItemResponse';
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
     * Get trip settlement calculation
     * Returns authoritative per-currency participant balances and deterministic suggested transfers for an authenticated current trip participant.
     * @param tripId
     * @returns GetTripSettlementResponse Trip settlement calculation.
     * @throws ApiError
     */
    public static getTripSettlement(
        tripId: string,
    ): CancelablePromise<GetTripSettlementResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/settlement',
            path: {
                'tripId': tripId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip not found.`,
                409: `Settlement data is inconsistent.`,
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
     * List trip places
     * Returns existing trip-level places for an authenticated trip participant. Used by Day lodging selection.
     * @param tripId
     * @returns ListTripPlacesResponse Existing trip places.
     * @throws ApiError
     */
    public static listTripPlaces(
        tripId: string,
    ): CancelablePromise<ListTripPlacesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/places',
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
     * Set a trip day lodging place
     * Stores or replaces the selected Day lodging target for an authenticated trip participant.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns SetDayLodgingPlaceResponse Day lodging place saved.
     * @throws ApiError
     */
    public static setDayLodgingPlace(
        tripId: string,
        tripDayId: string,
        requestBody: SetDayLodgingPlaceRequest,
    ): CancelablePromise<SetDayLodgingPlaceResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/days/{tripDayId}/lodging-place',
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
                404: `Trip, trip day, or trip place not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Clear a trip day lodging place
     * Removes the selected Day lodging target for an authenticated trip participant. Clearing an empty Day lodging selection is a 204 no-op.
     * @param tripId
     * @param tripDayId
     * @returns void
     * @throws ApiError
     */
    public static clearDayLodgingPlace(
        tripId: string,
        tripDayId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/days/{tripDayId}/lodging-place',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip day not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a manual lodging place and set Day lodging
     * Creates a manual lodging TripPlace for the trip and stores it as the selected Day lodging target. Does not create a Day schedule item.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns SetDayLodgingPlaceResponse Manual lodging place created and set as Day lodging.
     * @throws ApiError
     */
    public static createManualDayLodgingPlace(
        tripId: string,
        tripDayId: string,
        requestBody: CreateManualDayLodgingPlaceRequest,
    ): CancelablePromise<SetDayLodgingPlaceResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/lodging-place/manual',
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
                404: `Trip/day not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get a trip day schedule
     * Returns the ordered read-only schedule items for a selected virtual trip day.
     * @param tripId
     * @param tripDayId
     * @returns GetDayScheduleItemsResponse Day schedule.
     * @throws ApiError
     */
    public static getDayScheduleItems(
        tripId: string,
        tripDayId: string,
    ): CancelablePromise<GetDayScheduleItemsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip day not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * List expenses for a trip day
     * Returns read-only expense rows for the selected trip day, ordered newest-first.
     * @param tripId
     * @param tripDayId
     * @returns ListDayExpensesResponse Day expenses.
     * @throws ApiError
     */
    public static listDayExpenses(
        tripId: string,
        tripDayId: string,
    ): CancelablePromise<ListDayExpensesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/expenses',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip day not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get a day expense for editing
     * Returns editable detail for one expense in the selected trip day.
     * @param tripId
     * @param tripDayId
     * @param expenseId
     * @returns GetExpenseResponse Expense detail.
     * @throws ApiError
     */
    public static getDayExpense(
        tripId: string,
        tripDayId: string,
        expenseId: string,
    ): CancelablePromise<GetExpenseResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/days/{tripDayId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update a day expense
     * Updates amount, payer, memo, and linked schedule item for an expense, then recalculates equal splits.
     * @param tripId
     * @param tripDayId
     * @param expenseId
     * @param requestBody
     * @returns UpdateExpenseResponse Expense updated.
     * @throws ApiError
     */
    public static updateExpense(
        tripId: string,
        tripDayId: string,
        expenseId: string,
        requestBody: UpdateExpenseRequest,
    ): CancelablePromise<UpdateExpenseResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/days/{tripDayId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'expenseId': expenseId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, expense, payer, split participant, or linked schedule item not found.`,
                409: `Conflict while updating the expense.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Delete a day expense
     * Hard-deletes an expense in the selected trip day.
     * @param tripId
     * @param tripDayId
     * @param expenseId
     * @returns void
     * @throws ApiError
     */
    public static deleteExpense(
        tripId: string,
        tripDayId: string,
        expenseId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/days/{tripDayId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a quick expense for a trip day place
     * Creates an expense from a selected schedule item, using the trip default currency and equal splits across the submitted selected current trip participants.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns CreateQuickExpenseResponse Quick expense created.
     * @throws ApiError
     */
    public static createQuickExpense(
        tripId: string,
        tripDayId: string,
        requestBody: CreateQuickExpenseRequest,
    ): CancelablePromise<CreateQuickExpenseResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/expenses/quick',
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
                404: `Trip, trip day, schedule item, or payer participant not found.`,
                409: `Participant or schedule state changed during creation.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * @deprecated
     * Add a manual place to a trip day schedule
     * Deprecated. Manual Day schedule item creation is disabled for normal app use; add Google-backed places instead.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns CreateManualScheduleItemResponse Manual place added to the selected Day schedule.
     * @throws ApiError
     */
    public static createManualScheduleItem(
        tripId: string,
        tripDayId: string,
        requestBody: CreateManualScheduleItemRequest,
    ): CancelablePromise<CreateManualScheduleItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/manual',
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
                409: `Concurrent append conflict.`,
                410: `Manual place creation is disabled; use Google-backed place add flow.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Add a non-place item to a trip day schedule
     * Creates a manually entered schedule item that is not tied to a TripPlace, such as transport, rest, memo, or reminder.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns CreateNonPlaceScheduleItemResponse Non-place item added to the selected Day schedule.
     * @throws ApiError
     */
    public static createNonPlaceScheduleItem(
        tripId: string,
        tripDayId: string,
        requestBody: CreateNonPlaceScheduleItemRequest,
    ): CancelablePromise<CreateNonPlaceScheduleItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/non-place',
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
                409: `Concurrent append conflict.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Reorder a trip day schedule
     * Applies an ordered batch of same-Day schedule item moves inside one transaction and returns the latest Day schedule.
     * @param tripId
     * @param tripDayId
     * @param requestBody
     * @returns ReorderScheduleItemsResponse Day schedule reordered.
     * @throws ApiError
     */
    public static reorderScheduleItems(
        tripId: string,
        tripDayId: string,
        requestBody: ReorderScheduleItemsRequest,
    ): CancelablePromise<ReorderScheduleItemsResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/order',
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
                409: `Reorder conflict.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Mark a trip day schedule item arrived
     * Marks the selected schedule item instance arrived when it is the first pending item for the selected Day, and returns the latest Day schedule snapshot.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @returns MarkScheduleItemArrivedResponse Day schedule item arrived, or already arrived idempotently.
     * @throws ApiError
     */
    public static markScheduleItemArrived(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
    ): CancelablePromise<MarkScheduleItemArrivedResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/arrive',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or schedule item not found.`,
                409: `Arrival conflict because the target pending item is not the first pending item for the selected Day.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Mark a trip day schedule item skipped
     * Marks the selected schedule item instance skipped when it is the first pending item for the selected Day, and returns the latest Day schedule snapshot.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @returns MarkScheduleItemSkippedResponse Day schedule item skipped, or already skipped idempotently.
     * @throws ApiError
     */
    public static markScheduleItemSkipped(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
    ): CancelablePromise<MarkScheduleItemSkippedResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/skip',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or schedule item not found.`,
                409: `Skip conflict because the target item is arrived or is not the first pending item for the selected Day.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Restore a skipped trip day schedule item
     * Clears skipped state for the selected schedule item instance and returns the latest Day schedule snapshot.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @returns RestoreScheduleItemResponse Day schedule item restored, or already pending idempotently.
     * @throws ApiError
     */
    public static restoreScheduleItem(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
    ): CancelablePromise<RestoreScheduleItemResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/restore',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or schedule item not found.`,
                409: `Restore conflict because the target item is already arrived.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create an in-app route preview for a trip day schedule item
     * Returns a lightweight current-location-to-next-place route preview for the selected first pending schedule item. Detailed navigation remains delegated to Google Maps.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @param requestBody
     * @returns RoutePreviewResponse Route preview for the selected current next item.
     * @throws ApiError
     */
    public static createRoutePreview(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
        requestBody: CreateRoutePreviewRequest,
    ): CancelablePromise<RoutePreviewResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/route-preview',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, schedule item, or provider route not found.`,
                409: `Target item is stale or destination place is not routable.`,
                429: `Route provider rate limited.`,
                500: `Unexpected server error.`,
                502: `Route provider unavailable or returned unusable route data.`,
            },
        });
    }
    /**
     * Update a trip day schedule item place snapshot
     * Updates name, address, and/or place type for the trip place snapshot linked from the selected Day schedule item.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @param requestBody
     * @returns UpdateScheduleItemResponse Day schedule item updated.
     * @throws ApiError
     */
    public static updateScheduleItem(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
        requestBody: UpdateScheduleItemRequest,
    ): CancelablePromise<UpdateScheduleItemResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or schedule item not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Delete a trip day schedule item
     * Soft-deletes the selected schedule item from the Day while retaining linked place history.
     * @param tripId
     * @param tripDayId
     * @param scheduleItemId
     * @returns void
     * @throws ApiError
     */
    public static deleteScheduleItem(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}',
            path: {
                'tripId': tripId,
                'tripDayId': tripDayId,
                'scheduleItemId': scheduleItemId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip day, or schedule item not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
}
