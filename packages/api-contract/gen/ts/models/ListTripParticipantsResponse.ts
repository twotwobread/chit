/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripParticipantListItem } from './TripParticipantListItem';
export type ListTripParticipantsResponse = {
    /**
     * Authenticated user's current participant id for this trip, or null if no active participant can be resolved.
     */
    currentUserParticipantId: string | null;
    participants: Array<TripParticipantListItem>;
};
