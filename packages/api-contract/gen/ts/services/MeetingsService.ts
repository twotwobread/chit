/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptTripInviteResponse } from '../models/AcceptTripInviteResponse';
import type { CreateMeetingInviteResponse } from '../models/CreateMeetingInviteResponse';
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
    /**
     * Create or retrieve the current meeting invite link
     * Creates a new invite link for a saved meeting owner, or returns the existing unexpired current invite link. Hidden one-off meetings are not exposed through this endpoint.
     * @param meetingId
     * @returns CreateMeetingInviteResponse Existing active meeting invite link returned.
     * @throws ApiError
     */
    public static createMeetingInvite(
        meetingId: string,
    ): CancelablePromise<CreateMeetingInviteResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/meetings/{meetingId}/invites',
            path: {
                'meetingId': meetingId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Meeting not found or not visible to the current user.`,
                409: `Invite token conflict after retry.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Leave a saved meeting
     * Removes the authenticated non-owner member from a saved meeting. Owners cannot leave until an owner transfer flow exists.
     * @param meetingId
     * @returns void
     * @throws ApiError
     */
    public static leaveMeeting(
        meetingId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/meetings/{meetingId}/members/me',
            path: {
                'meetingId': meetingId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                404: `Meeting not found or not visible to the current user.`,
                409: `Owner transfer is required before leaving.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Remove a saved meeting member
     * Removes a non-owner member from a saved meeting when requested by the authenticated meeting owner. Existing trip/event participation is not mutated.
     * @param meetingId
     * @param memberId
     * @returns void
     * @throws ApiError
     */
    public static removeMeetingMember(
        meetingId: string,
        memberId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/meetings/{meetingId}/members/{memberId}',
            path: {
                'meetingId': meetingId,
                'memberId': memberId,
            },
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                403: `Forbidden.`,
                404: `Meeting/member not found or not visible to the current user.`,
                409: `Owner cannot be removed before ownership transfer.`,
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
}
