/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateMeetingRequest } from '../models/CreateMeetingRequest';
import type { CreateMeetingResponse } from '../models/CreateMeetingResponse';
import type { GetMeetingResponse } from '../models/GetMeetingResponse';
import type { ListMeetingsResponse } from '../models/ListMeetingsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MeetingsService {
    /**
     * List my saved meetings
     * Returns saved meetings where the authenticated user is a meeting member. Hidden one-off containers are excluded.
     * @returns ListMeetingsResponse Saved meetings for the authenticated user.
     * @throws ApiError
     */
    public static listMeetings(): CancelablePromise<ListMeetingsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/meetings',
            errors: {
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Create a saved meeting
     * Creates a saved meeting and the authenticated user's owner member snapshot.
     * @param requestBody
     * @returns CreateMeetingResponse Meeting created.
     * @throws ApiError
     */
    public static createMeeting(
        requestBody: CreateMeetingRequest,
    ): CancelablePromise<CreateMeetingResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/meetings',
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
     * Get saved meeting detail
     * Returns a saved meeting for an authenticated current meeting member. Hidden one-off containers are not exposed through this endpoint.
     * @param meetingId
     * @returns GetMeetingResponse Meeting detail.
     * @throws ApiError
     */
    public static getMeeting(
        meetingId: string,
    ): CancelablePromise<GetMeetingResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/meetings/{meetingId}',
            path: {
                'meetingId': meetingId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Meeting not found or not visible to the current user.`,
                500: `Unexpected server error.`,
            },
        });
    }
}
