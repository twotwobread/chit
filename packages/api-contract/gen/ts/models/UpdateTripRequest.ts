/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
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
};

