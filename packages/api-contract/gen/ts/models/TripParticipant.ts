/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripParticipantRole } from './TripParticipantRole';
export type TripParticipant = {
    id: string;
    tripId: string;
    userId: string;
    role: TripParticipantRole;
    displayName: string;
    joinedAt: string;
};
