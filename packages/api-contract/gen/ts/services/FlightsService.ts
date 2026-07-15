/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddTripFlightPassengersRequest } from '../models/AddTripFlightPassengersRequest';
import type { AddTripFlightPassengersResponse } from '../models/AddTripFlightPassengersResponse';
import type { CreateTripFlightRequest } from '../models/CreateTripFlightRequest';
import type { CreateTripFlightResponse } from '../models/CreateTripFlightResponse';
import type { GetTripFlightResponse } from '../models/GetTripFlightResponse';
import type { ListTripFlightsResponse } from '../models/ListTripFlightsResponse';
import type { OpenMyFlightBoardingPassResponse } from '../models/OpenMyFlightBoardingPassResponse';
import type { UpdateTripFlightRequest } from '../models/UpdateTripFlightRequest';
import type { UpdateTripFlightResponse } from '../models/UpdateTripFlightResponse';
import type { UploadMyFlightBoardingPassResponse } from '../models/UploadMyFlightBoardingPassResponse';
import type { UpsertMyFlightPersonalDetailRequest } from '../models/UpsertMyFlightPersonalDetailRequest';
import type { UpsertMyFlightPersonalDetailResponse } from '../models/UpsertMyFlightPersonalDetailResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FlightsService {
    /**
     * List trip flights
     * Returns shared trip flight information and only the authenticated passenger's own personal flight detail summary.
     * @param tripId
     * @returns ListTripFlightsResponse Trip flights.
     * @throws ApiError
     */
    public static listTripFlights(
        tripId: string,
    ): CancelablePromise<ListTripFlightsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/flights',
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
     * Create a trip flight
     * Creates shared flight metadata and passenger membership for a trip. Personal reservation fields are not created for other passengers.
     * @param tripId
     * @param requestBody
     * @returns CreateTripFlightResponse Flight created.
     * @throws ApiError
     */
    public static createTripFlight(
        tripId: string,
        requestBody: CreateTripFlightRequest,
    ): CancelablePromise<CreateTripFlightResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/flights',
            path: {
                'tripId': tripId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or passenger participant not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get trip flight detail
     * Returns shared flight detail and only the authenticated passenger's own personal flight detail.
     * @param tripId
     * @param flightId
     * @returns GetTripFlightResponse Flight detail.
     * @throws ApiError
     */
    public static getTripFlight(
        tripId: string,
        flightId: string,
    ): CancelablePromise<GetTripFlightResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/trips/{tripId}/flights/{flightId}',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Trip or flight not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update trip flight shared details
     * Updates shared flight metadata for an existing trip flight. Any current trip participant can update these shared fields. Personal reservation and boarding-pass details are not changed.
     * @param tripId
     * @param flightId
     * @param requestBody
     * @returns UpdateTripFlightResponse Flight updated.
     * @throws ApiError
     */
    public static updateTripFlight(
        tripId: string,
        flightId: string,
        requestBody: UpdateTripFlightRequest,
    ): CancelablePromise<UpdateTripFlightResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/flights/{flightId}',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a current trip participant.`,
                404: `Trip or flight not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Add passengers to a trip flight
     * Adds current trip participants to an existing shared flight. This changes passenger membership only and does not create personal reservation or boarding-pass details.
     * @param tripId
     * @param flightId
     * @param requestBody
     * @returns AddTripFlightPassengersResponse Passengers added.
     * @throws ApiError
     */
    public static addTripFlightPassengers(
        tripId: string,
        flightId: string,
        requestBody: AddTripFlightPassengersRequest,
    ): CancelablePromise<AddTripFlightPassengersResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/flights/{flightId}/passengers',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a current trip participant.`,
                404: `Trip or flight not found.`,
                409: `Duplicate passenger or stale participant state.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Upsert my flight personal detail
     * Upserts private reservation fields for the authenticated passenger only.
     * @param tripId
     * @param flightId
     * @param requestBody
     * @returns UpsertMyFlightPersonalDetailResponse Personal flight detail saved.
     * @throws ApiError
     */
    public static upsertMyFlightPersonalDetail(
        tripId: string,
        flightId: string,
        requestBody: UpsertMyFlightPersonalDetailRequest,
    ): CancelablePromise<UpsertMyFlightPersonalDetailResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/flights/{flightId}/my-detail',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a passenger for this flight.`,
                404: `Trip or flight not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Upload or replace my flight boarding-pass image
     * Stores one private boarding-pass/check-in image for the authenticated passenger. The image is stored in private object storage; list/detail responses never return object keys or signed URLs.
     * @param tripId
     * @param flightId
     * @param requestBody
     * @returns UploadMyFlightBoardingPassResponse Boarding pass uploaded or replaced.
     * @throws ApiError
     */
    public static uploadMyFlightBoardingPass(
        tripId: string,
        flightId: string,
        requestBody: Blob,
    ): CancelablePromise<UploadMyFlightBoardingPassResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/trips/{tripId}/flights/{flightId}/my-detail/boarding-pass',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            body: requestBody,
            mediaType: 'image/jpeg',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a passenger for this flight.`,
                404: `Trip or flight not found.`,
                413: `Boarding-pass image exceeds 10 MiB.`,
                415: `Unsupported boarding-pass image media type.`,
                500: `Unexpected server error.`,
                503: `Boarding-pass object storage unavailable.`,
            },
        });
    }
    /**
     * Delete my flight boarding-pass image
     * Deletes the authenticated passenger's boarding-pass metadata and schedules private object cleanup. Deleting a missing own attachment is a no-op.
     * @param tripId
     * @param flightId
     * @returns void
     * @throws ApiError
     */
    public static deleteMyFlightBoardingPass(
        tripId: string,
        flightId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/trips/{tripId}/flights/{flightId}/my-detail/boarding-pass',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a passenger for this flight.`,
                404: `Trip or flight not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a short-lived URL for my flight boarding pass
     * Authorizes the authenticated passenger and returns a short-lived signed URL for the passenger's own boarding-pass image. The URL must not be persisted by clients.
     * @param tripId
     * @param flightId
     * @returns OpenMyFlightBoardingPassResponse Short-lived boarding-pass URL.
     * @throws ApiError
     */
    public static openMyFlightBoardingPass(
        tripId: string,
        flightId: string,
    ): CancelablePromise<OpenMyFlightBoardingPassResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/trips/{tripId}/flights/{flightId}/my-detail/boarding-pass/open-url',
            path: {
                'tripId': tripId,
                'flightId': flightId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden; current user is not a passenger for this flight.`,
                404: `Trip, flight, or own boarding pass not found.`,
                500: `Unexpected server error.`,
                503: `Boarding-pass object storage unavailable.`,
            },
        });
    }
}
