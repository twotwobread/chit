/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDefaultTravelMode } from './TripDefaultTravelMode';
import type { TripDestinationInput } from './TripDestinationInput';
export type CreateTripRequest = {
    name: string;
    /**
     * Start date in YYYY-MM-DD format. Must be today or later.
     */
    startDate: string;
    /**
     * End date in YYYY-MM-DD format. Must be today or later and not before startDate.
     */
    endDate: string;
    defaultCurrency: SupportedCurrency;
    defaultTravelMode?: TripDefaultTravelMode;
    destinations: Array<TripDestinationInput>;
};
