/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDefaultTravelMode } from './TripDefaultTravelMode';
import type { TripDestination } from './TripDestination';
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
    destinations: Array<TripDestination>;
};
