/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeetingInvite } from './MeetingInvite';
export type CreateMeetingInviteResponse = {
    invite: MeetingInvite;
    /**
     * true when this request created a new invite, false when an existing unexpired current invite was reused.
     */
    created: boolean;
};
