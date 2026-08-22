/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateEventRequest } from '../models/CreateEventRequest';
import type { CreateEventResponse } from '../models/CreateEventResponse';
import type { GetEventResponse } from '../models/GetEventResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class EventsService {
    /**
     * Create an event
     * Creates an event under an existing saved meeting, a new saved meeting, or a hidden one-off meeting container.
     * @param requestBody
     * @returns CreateEventResponse Event created.
     * @throws ApiError
     */
    public static createEvent(
        requestBody: CreateEventRequest,
    ): CancelablePromise<CreateEventResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/events',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Existing meeting is not accessible to the current user.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get event detail
     * Returns event detail for an authenticated current event participant.
     * @param eventId
     * @returns GetEventResponse Event detail.
     * @throws ApiError
     */
    public static getEvent(
        eventId: string,
    ): CancelablePromise<GetEventResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{eventId}',
            path: {
                'eventId': eventId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Event not found or not visible to the current user.`,
                500: `Unexpected server error.`,
            },
        });
    }
}
