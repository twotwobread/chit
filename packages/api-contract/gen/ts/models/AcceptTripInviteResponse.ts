/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InviteScope } from './InviteScope';
import type { TripParticipantRole } from './TripParticipantRole';
export type AcceptTripInviteResponse = {
    scope: InviteScope;
    meetingId?: string;
    meetingName?: string;
    tripId?: string;
    tripName?: string;
    role: TripParticipantRole;
    /**
     * false when this request created a new meeting member or trip participant; true when the user was already a member/participant.
     */
    alreadyAccepted: boolean;
};
