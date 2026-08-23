/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptTripInviteResponse } from '../models/AcceptTripInviteResponse';
import type { CreateExpenseReceiptDraftResponse } from '../models/CreateExpenseReceiptDraftResponse';
import type { CreateManualDayLodgingPlaceRequest } from '../models/CreateManualDayLodgingPlaceRequest';
import type { CreateManualScheduleItemRequest } from '../models/CreateManualScheduleItemRequest';
import type { CreateManualScheduleItemResponse } from '../models/CreateManualScheduleItemResponse';
import type { CreateManualTripPlaceRequest } from '../models/CreateManualTripPlaceRequest';
import type { CreateManualTripPlaceResponse } from '../models/CreateManualTripPlaceResponse';
import type { CreateQuickExpenseRequest } from '../models/CreateQuickExpenseRequest';
import type { CreateQuickExpenseResponse } from '../models/CreateQuickExpenseResponse';
import type { CreateRoutePreviewRequest } from '../models/CreateRoutePreviewRequest';
import type { CreateTripExpenseRequest } from '../models/CreateTripExpenseRequest';
import type { CreateTripExpenseResponse } from '../models/CreateTripExpenseResponse';
import type { CreateTripInviteResponse } from '../models/CreateTripInviteResponse';
import type { CreateTripRequest } from '../models/CreateTripRequest';
import type { CreateTripResponse } from '../models/CreateTripResponse';
import type { GetDayScheduleItemsResponse } from '../models/GetDayScheduleItemsResponse';
import type { GetExpenseResponse } from '../models/GetExpenseResponse';
import type { GetTripDetailResponse } from '../models/GetTripDetailResponse';
import type { GetTripSettlementResponse } from '../models/GetTripSettlementResponse';
import type { ListDayExpensesResponse } from '../models/ListDayExpensesResponse';
import type { ListTripExpensesResponse } from '../models/ListTripExpensesResponse';
import type { ListTripParticipantsResponse } from '../models/ListTripParticipantsResponse';
import type { ListTripPlacesResponse } from '../models/ListTripPlacesResponse';
import type { ListTripScheduleItemsResponse } from '../models/ListTripScheduleItemsResponse';
import type { ListTripsResponse } from '../models/ListTripsResponse';
import type { MarkScheduleItemArrivedResponse } from '../models/MarkScheduleItemArrivedResponse';
import type { MarkScheduleItemSkippedResponse } from '../models/MarkScheduleItemSkippedResponse';
import type { MoveScheduleItemToDayRequest } from '../models/MoveScheduleItemToDayRequest';
import type { MoveScheduleItemToDayResponse } from '../models/MoveScheduleItemToDayResponse';
import type { OpenExpenseReceiptResponse } from '../models/OpenExpenseReceiptResponse';
import type { ReceiptCaptureMode } from '../models/ReceiptCaptureMode';
import type { ReceiptOCRLanguage } from '../models/ReceiptOCRLanguage';
import type { ReorderScheduleItemsRequest } from '../models/ReorderScheduleItemsRequest';
import type { ReorderScheduleItemsResponse } from '../models/ReorderScheduleItemsResponse';
import type { ReplaceTripParticipantsRequest } from '../models/ReplaceTripParticipantsRequest';
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
import type { UploadExpenseReceiptResponse } from '../models/UploadExpenseReceiptResponse';
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
     * Accept a meeting or trip invite link
     * Accepts a reusable active meeting invite for the authenticated user, and falls back to legacy trip invite acceptance when no meeting invite token matches. Existing meeting members or trip participants receive an idempotent success response.
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
     * Returns the current/latest per-currency participant balances and deterministic suggested transfers for an authenticated current trip participant. This response is not a historical settlement-request snapshot.
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
     * Create an expense draft from Korean receipt OCR text and image capture
     * Stores one private receipt image, or header/total images for long receipts, validates client-provided Korean OCR text, asks the model for strict JSON normalization, and returns a draft that must be reviewed before saving an expense. This endpoint never creates an expense and never returns object keys or signed URLs.
     * @param tripId
     * @param formData
     * @returns CreateExpenseReceiptDraftResponse Receipt draft created.
     * @throws ApiError
     */
    public static createExpenseReceiptDraft(
        tripId: string,
        formData: {
            captureMode: ReceiptCaptureMode;
            ocrLanguage: ReceiptOCRLanguage;
            /**
             * JSON array of ReceiptOCRTextPart. Single capture requires role `single`; split capture requires roles `header` and `total`.
             */
            ocrTextParts: string;
            /**
             * Required when captureMode is `single`.
             */
            image?: Blob;
            /**
             * Required when captureMode is `split`.
             */
            headerImage?: Blob;
            /**
             * Required when captureMode is `split`.
             */
            totalImage?: Blob;
        },
    ): CancelablePromise<CreateExpenseReceiptDraftResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/expense-receipt-drafts',
            path: {
                'tripId': tripId,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                400: `Validation error or invalid extraction JSON.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip not found.`,
                413: `Receipt image exceeds 10 MiB.`,
                415: `Unsupported receipt image media type.`,
                422: `Korean receipt text could not be validated.`,
                429: `Receipt draft provider or cost rate limit reached.`,
                500: `Unexpected server error.`,
                502: `OCR or model provider unavailable, timed out, or returned invalid output.`,
                503: `Receipt object storage unavailable.`,
            },
        });
    }
    /**
     * Cancel an unused receipt draft
     * Marks an unused receipt draft as cancelled and schedules private object cleanup. Cancelling a missing, expired, or already-used draft is idempotent for clients.
     * @param tripId
     * @param receiptDraftId
     * @returns void
     * @throws ApiError
     */
    public static cancelExpenseReceiptDraft(
        tripId: string,
        receiptDraftId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/expense-receipt-drafts/{receiptDraftId}',
            path: {
                'tripId': tripId,
                'receiptDraftId': receiptDraftId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * List expenses for a trip
     * Returns read-only expense rows grouped by trip context in one request. Trip-level rows are returned separately, and day rows are ordered by day then newest expense first. Optional text search filters expense rows by expense fields and saved receipt extraction fields without returning extracted receipt text.
     * @param tripId
     * @param q Optional expense search text. Blank values are treated as no filter.
     * @returns ListTripExpensesResponse Trip expenses grouped by trip context.
     * @throws ApiError
     */
    public static listTripExpenses(
        tripId: string,
        q?: string,
    ): CancelablePromise<ListTripExpensesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/expenses',
            path: {
                'tripId': tripId,
            },
            query: {
                'q': q,
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
     * Create a general trip expense
     * Creates a trip-level, Day-level, or schedule-item expense from settlement entry. Payment date is independent from related context.
     * @param tripId
     * @param requestBody
     * @returns CreateTripExpenseResponse Expense created.
     * @throws ApiError
     */
    public static createTripExpense(
        tripId: string,
        requestBody: CreateTripExpenseRequest,
    ): CancelablePromise<CreateTripExpenseResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/expenses',
            path: {
                'tripId': tripId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, Day, schedule item, payer, or split participant not found.`,
                409: `Participant or schedule state changed during creation.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Upload or replace a saved expense receipt image
     * Stores one private receipt image for an existing expense. The image is stored in private object storage; list/detail responses never return object keys or signed URLs.
     * @param tripId
     * @param expenseId
     * @param requestBody
     * @returns UploadExpenseReceiptResponse Receipt uploaded or replaced.
     * @throws ApiError
     */
    public static uploadExpenseReceipt(
        tripId: string,
        expenseId: string,
        requestBody: Blob,
    ): CancelablePromise<UploadExpenseReceiptResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/expenses/{expenseId}/receipt',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            body: requestBody,
            mediaType: 'image/jpeg',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or expense not found.`,
                413: `Receipt image exceeds 10 MiB.`,
                415: `Unsupported receipt image media type.`,
                500: `Unexpected server error.`,
                503: `Receipt object storage unavailable.`,
            },
        });
    }
    /**
     * Delete a saved expense receipt image
     * Deletes receipt metadata and schedules private object cleanup. Deleting a missing receipt is a no-op.
     * @param tripId
     * @param expenseId
     * @returns void
     * @throws ApiError
     */
    public static deleteExpenseReceipt(
        tripId: string,
        expenseId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/expenses/{expenseId}/receipt',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a short-lived URL for an expense receipt
     * Authorizes the authenticated trip participant and returns a short-lived signed URL for an existing saved receipt image. The URL must not be persisted by clients.
     * @param tripId
     * @param expenseId
     * @returns OpenExpenseReceiptResponse Short-lived receipt URL.
     * @throws ApiError
     */
    public static openExpenseReceipt(
        tripId: string,
        expenseId: string,
    ): CancelablePromise<OpenExpenseReceiptResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/expenses/{expenseId}/receipt/open-url',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, expense, or receipt not found.`,
                500: `Unexpected server error.`,
                503: `Receipt object storage unavailable.`,
            },
        });
    }
    /**
     * Get a trip-level expense
     * Returns a trip-level expense created without a related Day or schedule item. Day and schedule-item expenses are fetched through the day-scoped expense endpoint.
     * @param tripId
     * @param expenseId
     * @returns GetExpenseResponse Trip-level expense detail.
     * @throws ApiError
     */
    public static getTripExpense(
        tripId: string,
        expenseId: string,
    ): CancelablePromise<GetExpenseResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip-level expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update a trip-level expense
     * Updates amount, payer, memo, title, and split information for a trip-level expense. Day and schedule-item expenses use the day-scoped endpoint.
     * @param tripId
     * @param expenseId
     * @param requestBody
     * @returns UpdateExpenseResponse Trip-level expense updated.
     * @throws ApiError
     */
    public static updateTripExpense(
        tripId: string,
        expenseId: string,
        requestBody: UpdateExpenseRequest,
    ): CancelablePromise<UpdateExpenseResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/trips/{tripId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip, trip-level expense, payer, or split participant not found.`,
                409: `Participant state changed during update.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Delete a trip-level expense
     * Deletes a trip-level expense. Day and schedule-item expenses use the day-scoped endpoint.
     * @param tripId
     * @param expenseId
     * @returns void
     * @throws ApiError
     */
    public static deleteTripExpense(
        tripId: string,
        expenseId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/expenses/{expenseId}',
            path: {
                'tripId': tripId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or trip-level expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * List trip participants
     * Returns the current accepted event/trip participants for a trip. Only authenticated current trip participants can access the list.
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
     * Replace saved meeting-backed trip participants
     * Replaces the current saved meeting member subset participating in this trip-backed event. Only the trip owner can replace participants. Existing expense payer/split snapshots are preserved when a participant is removed.
     * @param tripId
     * @param requestBody
     * @returns ListTripParticipantsResponse Updated current trip participants.
     * @throws ApiError
     */
    public static replaceTripParticipants(
        tripId: string,
        requestBody: ReplaceTripParticipantsRequest,
    ): CancelablePromise<ListTripParticipantsResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/participants',
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
                409: `Trip is not a saved meeting-backed event or the owner would be removed.`,
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
     * Create a manual trip place
     * Creates a manual trip-level place for an authenticated trip participant. Does not create a Day lodging target or schedule item.
     * @param tripId
     * @param requestBody
     * @returns CreateManualTripPlaceResponse Manual trip place created.
     * @throws ApiError
     */
    public static createManualTripPlace(
        tripId: string,
        requestBody: CreateManualTripPlaceRequest,
    ): CancelablePromise<CreateManualTripPlaceResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/places',
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
     * List schedule items for a trip
     * Returns read-only schedule items grouped by trip day in one request.
     * @param tripId
     * @returns ListTripScheduleItemsResponse Trip schedule items grouped by trip day.
     * @throws ApiError
     */
    public static listTripScheduleItems(
        tripId: string,
    ): CancelablePromise<ListTripScheduleItemsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/schedule-items',
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
     * Move a schedule item to another trip day
     * Moves one active schedule item from the source Day to the end of another active Day in the same trip, resets Day execution status, and re-anchors schedule-item expenses in one transaction.
     * @param tripId
     * @param tripDayId Source active trip Day id.
     * @param scheduleItemId
     * @param requestBody
     * @returns MoveScheduleItemToDayResponse Schedule item moved to the target Day.
     * @throws ApiError
     */
    public static moveScheduleItemToDay(
        tripId: string,
        tripDayId: string,
        scheduleItemId: string,
        requestBody: MoveScheduleItemToDayRequest,
    ): CancelablePromise<MoveScheduleItemToDayResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/move',
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
                404: `Trip, source Day, target Day, or schedule item not found.`,
                409: `Move conflict because the item version or Day ordering state is stale.`,
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
