/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateEventExpenseRequest } from '../models/CreateEventExpenseRequest';
import type { CreateEventExpenseResponse } from '../models/CreateEventExpenseResponse';
import type { CreateEventRequest } from '../models/CreateEventRequest';
import type { CreateEventResponse } from '../models/CreateEventResponse';
import type { GetEventExpenseResponse } from '../models/GetEventExpenseResponse';
import type { GetEventResponse } from '../models/GetEventResponse';
import type { GetEventSettlementResponse } from '../models/GetEventSettlementResponse';
import type { ListEventExpensesResponse } from '../models/ListEventExpensesResponse';
import type { UpdateEventExpenseRequest } from '../models/UpdateEventExpenseRequest';
import type { UpdateEventExpenseResponse } from '../models/UpdateEventExpenseResponse';
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
     * List expenses for an event
     * Returns event-scoped expense rows for a lightweight outing ledger.
     * @param eventId
     * @returns ListEventExpensesResponse Event expenses.
     * @throws ApiError
     */
    public static listEventExpenses(
        eventId: string,
    ): CancelablePromise<ListEventExpensesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{eventId}/expenses',
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
    /**
     * Create an event expense
     * Creates an outing event expense using event participants for payer and splits.
     * @param eventId
     * @param requestBody
     * @returns CreateEventExpenseResponse Event expense created.
     * @throws ApiError
     */
    public static createEventExpense(
        eventId: string,
        requestBody: CreateEventExpenseRequest,
    ): CancelablePromise<CreateEventExpenseResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/events/{eventId}/expenses',
            path: {
                'eventId': eventId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Event, payer, or split participant not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get an event expense
     * @param eventId
     * @param expenseId
     * @returns GetEventExpenseResponse Event expense detail.
     * @throws ApiError
     */
    public static getEventExpense(
        eventId: string,
        expenseId: string,
    ): CancelablePromise<GetEventExpenseResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{eventId}/expenses/{expenseId}',
            path: {
                'eventId': eventId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Event expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update an event expense
     * @param eventId
     * @param expenseId
     * @param requestBody
     * @returns UpdateEventExpenseResponse Event expense updated.
     * @throws ApiError
     */
    public static updateEventExpense(
        eventId: string,
        expenseId: string,
        requestBody: UpdateEventExpenseRequest,
    ): CancelablePromise<UpdateEventExpenseResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/events/{eventId}/expenses/{expenseId}',
            path: {
                'eventId': eventId,
                'expenseId': expenseId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Event expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Delete an event expense
     * @param eventId
     * @param expenseId
     * @returns void
     * @throws ApiError
     */
    public static deleteEventExpense(
        eventId: string,
        expenseId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/events/{eventId}/expenses/{expenseId}',
            path: {
                'eventId': eventId,
                'expenseId': expenseId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Event expense not found.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Get event settlement
     * Calculates settlement for one event using event participants and event-scoped expenses.
     * @param eventId
     * @returns GetEventSettlementResponse Event settlement.
     * @throws ApiError
     */
    public static getEventSettlement(
        eventId: string,
    ): CancelablePromise<GetEventSettlementResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{eventId}/settlement',
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
