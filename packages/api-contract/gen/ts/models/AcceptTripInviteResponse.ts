/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripParticipantRole } from './TripParticipantRole';
export type AcceptTripInviteResponse = {
    tripId: string;
    tripName: string;
    role: TripParticipantRole;
    /**
     * false when this request created a new member participant; true when the user was already a participant.
     */
    alreadyAccepted: boolean;
};

