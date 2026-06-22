/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Trip } from './Trip';
import type { TripDay } from './TripDay';
import type { TripParticipantSummary } from './TripParticipantSummary';
export type GetTripDetailResponse = {
    trip: Trip;
    participantSummary: TripParticipantSummary;
    days: Array<TripDay>;
};

