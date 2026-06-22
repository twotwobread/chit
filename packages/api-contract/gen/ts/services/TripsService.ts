/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateTripRequest } from '../models/CreateTripRequest';
import type { CreateTripResponse } from '../models/CreateTripResponse';
import type { GetTripDetailResponse } from '../models/GetTripDetailResponse';
import type { ListTripsResponse } from '../models/ListTripsResponse';
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
}
