/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDefaultTravelMode } from './TripDefaultTravelMode';
import type { TripEventContext } from './TripEventContext';
import type { TripParticipantRole } from './TripParticipantRole';
export type TripListItem = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    defaultTravelMode: TripDefaultTravelMode;
    joinedAt: string;
    createdAt: string;
    myRole: TripParticipantRole;
    participantCount: number;
    /**
     * Meeting/event identity for this trip. Null only for compatibility while backfill migrations roll forward.
     */
    eventContext: TripEventContext | null;
};
