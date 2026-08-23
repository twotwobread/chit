/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MeetingInvite = {
    id: string;
    meetingId: string;
    /**
     * Opaque base64url token. UI copies or shares inviteUrl instead of raw token.
     */
    token: string;
    inviteUrl: string;
    /**
     * UTC ISO 8601 timestamp.
     */
    expiresAt: string;
    /**
     * UTC ISO 8601 timestamp.
     */
    createdAt: string;
    createdBy: string;
};
