/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDefaultTravelMode } from './TripDefaultTravelMode';
import type { TripDestination } from './TripDestination';
import type { TripEventContext } from './TripEventContext';
export type Trip = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    defaultTravelMode: TripDefaultTravelMode;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    /**
     * Meeting/event identity for this trip. Null only for compatibility while backfill migrations roll forward.
     */
    eventContext: TripEventContext | null;
    destinations: Array<TripDestination>;
};
