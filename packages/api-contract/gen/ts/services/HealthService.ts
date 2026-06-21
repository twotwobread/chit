/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthResponse } from '../models/HealthResponse';
import type { ReadinessResponse } from '../models/ReadinessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthService {
    /**
     * Check API health
     * Returns the API liveness status.
     * @returns HealthResponse API is healthy.
     * @throws ApiError
     */
    public static getHealth(): CancelablePromise<HealthResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
            errors: {
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Check API readiness
     * Returns API readiness, including PostgreSQL migration/query readiness.
     * @returns ReadinessResponse API and database are ready.
     * @throws ApiError
     */
    public static getReady(): CancelablePromise<ReadinessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ready',
            errors: {
                500: `Unexpected server error.`,
                503: `API or database is not ready.`,
            },
        });
    }
}
