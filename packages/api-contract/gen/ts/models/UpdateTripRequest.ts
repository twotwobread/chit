/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDefaultTravelMode } from './TripDefaultTravelMode';
export type UpdateTripRequest = {
    name?: string;
    /**
     * Start date in YYYY-MM-DD format. May be past, current, or future.
     */
    startDate?: string;
    /**
     * End date in YYYY-MM-DD format. Must not be before the merged startDate.
     */
    endDate?: string;
    defaultCurrency?: SupportedCurrency;
    defaultTravelMode?: TripDefaultTravelMode;
    /**
     * Set true after showing the shrink impact summary when a date range change archives out-of-range days.
     */
    confirmOutOfRangeDayArchive?: boolean;
};
